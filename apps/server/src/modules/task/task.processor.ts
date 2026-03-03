import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../common/prisma.service';
import { LlmService } from '../llm/llm.service';
import { ReportService } from '../report/report.service';
import { NotificationGateway } from '../notification/notification.gateway';

@Processor('video-analysis')
export class TaskProcessor {
  private readonly logger = new Logger(TaskProcessor.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
    private reportService: ReportService,
    private notificationGateway: NotificationGateway,
  ) {}

  /** 逐个处理任务中的每个视频分析，失败的视频不会阻塞后续视频的处理 */
  @Process('analyze')
  async handleAnalysis(job: Job<{ taskId: string }>) {
    const { taskId } = job.data;
    this.logger.log(`Processing task: ${taskId}`);

    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        taskVideos: { include: { video: true } },
        skill: true,
      },
    });

    let completed = 0;
    let failed = 0;
    const total = task.taskVideos.length;

    for (const taskVideo of task.taskVideos) {
      try {
        await this.prisma.taskVideo.update({
          where: { id: taskVideo.id },
          data: { status: 'PROCESSING', startedAt: new Date() },
        });

        this.notificationGateway.emitTaskProgress({
          taskId,
          progress: Math.round((completed / total) * 100),
          currentVideoId: taskVideo.videoId,
          currentVideoTitle: taskVideo.video.title,
        });

        // 调用 LLM 分析视频，skill.content 作为分析 prompt
        const content = await this.llmService.analyzeVideo({
          modelId: task.modelId,
          videoUrl: taskVideo.video.ossUrl,
          prompt: task.skill.content,
        });

        const report = await this.reportService.createOrUpdateReport({
          videoId: taskVideo.videoId,
          content,
          skillId: task.skillId,
          modelId: task.modelId,
        });

        await this.prisma.taskVideo.update({
          where: { id: taskVideo.id },
          data: {
            status: 'COMPLETED',
            reportId: report.id,
            completedAt: new Date(),
          },
        });

        completed++;
        this.notificationGateway.emitTaskVideoCompleted({
          taskId,
          taskVideoId: taskVideo.id,
          videoId: taskVideo.videoId,
          reportId: report.id,
        });
      } catch (err) {
        failed++;
        const errorMessage = (err as Error).message;
        this.logger.error(
          `Failed to analyze video ${taskVideo.videoId}: ${errorMessage}`,
        );

        await this.prisma.taskVideo.update({
          where: { id: taskVideo.id },
          data: {
            status: 'FAILED',
            error: errorMessage,
            completedAt: new Date(),
          },
        });

        this.notificationGateway.emitTaskVideoFailed({
          taskId,
          taskVideoId: taskVideo.id,
          videoId: taskVideo.videoId,
          error: errorMessage,
        });
      }

      // 每处理完一个视频就更新整体进度
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          progress: Math.round(((completed + failed) / total) * 100),
        },
      });
    }

    // 根据成功/失败情况决定最终状态：全部失败 → FAILED，部分失败 → PARTIAL，全部成功 → COMPLETED
    const finalStatus =
      failed === total ? 'FAILED' : failed > 0 ? 'PARTIAL' : 'COMPLETED';
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: finalStatus,
        progress: 100,
        completedAt: new Date(),
      },
    });

    this.notificationGateway.emitTaskCompleted(taskId);
    this.logger.log(
      `Task ${taskId} completed: ${completed} success, ${failed} failed`,
    );
  }
}
