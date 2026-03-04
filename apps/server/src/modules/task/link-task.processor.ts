import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../common/prisma.service';
import { LlmService } from '../llm/llm.service';
import { ReportService } from '../report/report.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { ScraperService } from '../scraper/scraper.service';
import { OssService } from '../storage/oss.service';

@Processor('link-video-analysis')
export class LinkTaskProcessor {
  private readonly logger = new Logger(LinkTaskProcessor.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
    private reportService: ReportService,
    private notificationGateway: NotificationGateway,
    private scraperService: ScraperService,
    private ossService: OssService,
  ) {}

  @Process('analyze-links')
  async handleLinkAnalysis(job: Job<{ taskId: string; bucketId: string }>) {
    const { taskId, bucketId } = job.data;
    this.logger.log(`Processing link task: ${taskId}`);

    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        taskLinkVideos: { include: { linkVideo: true } },
        skill: true,
      },
    });

    let completed = 0;
    let failed = 0;
    const total = task.taskLinkVideos.length;

    for (const tlv of task.taskLinkVideos) {
      const linkVideo = tlv.linkVideo;
      try {
        await this.prisma.taskLinkVideo.update({
          where: { id: tlv.id },
          data: { status: 'PROCESSING', startedAt: new Date() },
        });

        this.notificationGateway.emitTaskProgress({
          taskId,
          progress: Math.round((completed / total) * 100),
          currentVideoId: linkVideo.id,
          currentVideoTitle: linkVideo.title || linkVideo.url,
        });

        // 阶段 1: 抓取平台互动数据
        await this.prisma.linkVideo.update({
          where: { id: linkVideo.id },
          data: { status: 'SCRAPING' },
        });

        const scrapedData = await this.scraperService.scrapeVideoData(linkVideo.url, linkVideo.platform);

        await this.prisma.linkVideo.update({
          where: { id: linkVideo.id },
          data: {
            title: scrapedData.title,
            author: scrapedData.author,
            likes: scrapedData.likes,
            collects: scrapedData.collects,
            comments: scrapedData.comments,
            shares: scrapedData.shares,
          },
        });

        // 阶段 2: 通过 kukutool 提取视频直链
        this.logger.log(`[${linkVideo.id}] 开始提取视频直链...`);
        const extracted = await this.scraperService.extractVideoFileUrl(linkVideo.url, linkVideo.platform);

        await this.prisma.linkVideo.update({
          where: { id: linkVideo.id },
          data: {
            videoFileUrl: extracted.videoFileUrl,
            coverUrl: extracted.coverUrl,
          },
        });

        // 下载视频到 OSS：kukutool 只提取 URL，下载由 OssService 完成
        let ossVideoUrl: string | null = null;
        if (extracted.videoFileUrl) {
          this.logger.log(`[${linkVideo.id}] 开始下载视频并上传到 OSS (bucketId=${bucketId})`);
          try {
            const fileName = `${linkVideo.id}_${Date.now()}.mp4`;
            const { key, ossUrl } = await this.ossService.downloadAndUpload(
              bucketId,
              extracted.videoFileUrl,
              fileName,
            );

            await this.prisma.linkVideo.update({
              where: { id: linkVideo.id },
              data: { ossKey: key, ossUrl, bucketId },
            });
            ossVideoUrl = ossUrl;
            this.logger.log(`[${linkVideo.id}] 视频已持久化到 OSS: ${key}`);
          } catch (uploadErr) {
            this.logger.error(
              `[${linkVideo.id}] 视频下载上传 OSS 失败: ${(uploadErr as Error).message}`,
            );
          }
        } else {
          this.logger.warn(`[${linkVideo.id}] kukutool 未能提取到视频直链，将使用原始页面 URL 进行分析`);
        }

        await this.prisma.linkVideo.update({
          where: { id: linkVideo.id },
          data: { status: 'ANALYZING' },
        });

        // 阶段 3: AI 分析（优先使用 OSS URL，回退到提取的原始 URL）
        const platformContext = this.buildPlatformContext(scrapedData, linkVideo.platform);
        const videoUrlForAnalysis = ossVideoUrl || extracted.videoFileUrl;
        let reportContent: string;

        if (videoUrlForAnalysis) {
          reportContent = await this.llmService.analyzeVideo({
            modelId: task.modelId,
            videoUrl: videoUrlForAnalysis,
            prompt: `${task.skill.content}\n\n## 平台数据参考\n${platformContext}`,
          });
        } else {
          // 降级：无视频直链时仅基于平台数据分析
          reportContent = await this.llmService.analyzeVideo({
            modelId: task.modelId,
            videoUrl: linkVideo.url,
            prompt: `${task.skill.content}\n\n## 平台数据参考\n${platformContext}\n\n注意：视频直链提取失败，请基于视频页面 URL 和平台数据进行分析。`,
          });
        }

        const report = await this.reportService.createOrUpdateLinkVideoReport({
          linkVideoId: linkVideo.id,
          content: reportContent,
          skillId: task.skillId,
          modelId: task.modelId,
        });

        // 解除旧 TaskLinkVideo 对该 Report 的关联，避免 unique 约束冲突
        await this.prisma.taskLinkVideo.updateMany({
          where: { reportId: report.id },
          data: { reportId: null },
        });

        await this.prisma.taskLinkVideo.update({
          where: { id: tlv.id },
          data: { status: 'COMPLETED', reportId: report.id, completedAt: new Date() },
        });

        await this.prisma.linkVideo.update({
          where: { id: linkVideo.id },
          data: { status: 'COMPLETED' },
        });

        completed++;
        this.notificationGateway.emitTaskVideoCompleted({
          taskId, taskVideoId: tlv.id, videoId: linkVideo.id, reportId: report.id,
        });
      } catch (err) {
        failed++;
        const errorMessage = (err as Error).message;
        this.logger.error(`链接视频分析失败 ${linkVideo.url}: ${errorMessage}`);

        await this.prisma.taskLinkVideo.update({
          where: { id: tlv.id },
          data: { status: 'FAILED', error: errorMessage, completedAt: new Date() },
        });
        await this.prisma.linkVideo.update({
          where: { id: linkVideo.id },
          data: { status: 'FAILED', error: errorMessage },
        });

        this.notificationGateway.emitTaskVideoFailed({
          taskId, taskVideoId: tlv.id, videoId: linkVideo.id, error: errorMessage,
        });
      }

      await this.prisma.task.update({
        where: { id: taskId },
        data: { progress: Math.round(((completed + failed) / total) * 100) },
      });
    }

    const finalStatus = failed === total ? 'FAILED' : failed > 0 ? 'PARTIAL' : 'COMPLETED';
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: finalStatus, progress: 100, completedAt: new Date() },
    });

    this.notificationGateway.emitTaskCompleted(taskId);
    this.logger.log(`Link task ${taskId} completed: ${completed} success, ${failed} failed`);
  }

  private buildPlatformContext(
    data: { title: string | null; author: string | null; likes: number | null; collects: number | null; comments: number | null; shares: number | null },
    platform: string,
  ): string {
    const lines: string[] = [];
    lines.push(`平台: ${platform === 'XIAOHONGSHU' ? '小红书' : '抖音'}`);
    if (data.title) lines.push(`标题: ${data.title}`);
    if (data.author) lines.push(`博主: ${data.author}`);
    if (data.likes !== null) lines.push(`点赞: ${data.likes}`);
    if (data.collects !== null) lines.push(`收藏: ${data.collects}`);
    if (data.comments !== null) lines.push(`评论: ${data.comments}`);
    if (data.shares !== null) lines.push(`分享: ${data.shares}`);
    return lines.join('\n');
  }
}
