import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ReportService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('video-analysis') private analysisQueue: Queue,
  ) {}

  // 供任务处理器和报告修订共用的核心方法，负责首次创建或追加新版本
  async createOrUpdateReport(params: {
    videoId: string;
    content: string;
    skillId?: string;
    modelId?: string;
    prompt?: string;
  }): Promise<{ id: string; version: number }> {
    const existing = await this.prisma.report.findFirst({
      where: { videoId: params.videoId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!existing) {
      // 首次创建：报告主体 + 第一条版本记录在同一事务中生成
      const report = await this.prisma.$transaction(async (tx) => {
        const newReport = await tx.report.create({
          data: {
            videoId: params.videoId,
            content: params.content,
            version: 1,
          },
        });

        await tx.reportVersion.create({
          data: {
            reportId: newReport.id,
            version: 1,
            content: params.content,
            skillId: params.skillId,
            modelId: params.modelId,
            prompt: params.prompt,
          },
        });

        return newReport;
      });

      return { id: report.id, version: report.version };
    }

    // 已有报告：先归档当前内容为历史版本，再用新内容覆盖主体
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.reportVersion.create({
        data: {
          reportId: existing.id,
          version: existing.version,
          content: existing.content,
          skillId: params.skillId,
          modelId: params.modelId,
          prompt: params.prompt,
        },
      });

      const updatedReport = await tx.report.update({
        where: { id: existing.id },
        data: {
          content: params.content,
          version: existing.version + 1,
        },
      });

      return updatedReport;
    });

    return { id: updated.id, version: updated.version };
  }

  async findByVideoId(videoId: string) {
    const report = await this.prisma.report.findFirst({
      where: { videoId },
      orderBy: { updatedAt: 'desc' },
      include: {
        video: { select: { title: true } },
      },
    });
    if (!report) throw new NotFoundException('该视频暂无报告');
    return {
      id: report.id,
      videoId: report.videoId,
      videoTitle: report.video?.title ?? '未知视频',
      content: report.content,
      version: report.version,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    };
  }

  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { video: { select: { title: true } } },
    });
    if (!report) throw new NotFoundException('报告不存在');
    return {
      id: report.id,
      videoId: report.videoId,
      videoTitle: report.video?.title ?? '未知视频',
      content: report.content,
      version: report.version,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    };
  }

  async findVersions(reportId: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('报告不存在');

    return this.prisma.reportVersion.findMany({
      where: { reportId },
      select: { id: true, version: true, createdAt: true },
      orderBy: { version: 'desc' },
    });
  }

  async findVersion(reportId: string, versionId: string) {
    const version = await this.prisma.reportVersion.findFirst({
      where: { id: versionId, reportId },
    });
    if (!version) throw new NotFoundException('版本不存在');
    return version;
  }

  /** 修正报告：基于原报告的视频、skill、model 创建新的分析任务，附带额外要求 */
  async revise(reportId: string, additionalRequirements: string, userId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { video: true },
    });
    if (!report) throw new NotFoundException('报告不存在');

    // 从最近一次版本记录中获取原始 skill 和 model，以保持分析一致性
    const latestVersion = await this.prisma.reportVersion.findFirst({
      where: { reportId },
      orderBy: { version: 'desc' },
    });

    // 若没有版本记录（仅 v1），则从关联的 TaskVideo → Task 中获取
    let skillId = latestVersion?.skillId;
    let modelId = latestVersion?.modelId;

    if (!skillId || !modelId) {
      const taskVideo = await this.prisma.taskVideo.findFirst({
        where: { reportId },
        include: { task: true },
        orderBy: { completedAt: 'desc' },
      });
      if (taskVideo) {
        skillId = skillId || taskVideo.task.skillId;
        modelId = modelId || taskVideo.task.modelId;
      }
    }

    if (!skillId || !modelId) {
      throw new NotFoundException('无法确定原始分析使用的 Skill 或 Model');
    }

    // 获取 skill 内容用于组装修正 prompt
    const skill = await this.prisma.skill.findUniqueOrThrow({
      where: { id: skillId },
    });

    // 创建修正任务，复用原始 skill 和 model
    const task = await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.create({
        data: {
          name: `修正报告: ${report.video?.title ?? '未知视频'}`,
          skillId,
          modelId,
          createdBy: userId,
        },
      });

      await tx.taskVideo.create({
        data: {
          taskId: t.id,
          videoId: report.videoId!,
        },
      });

      return t;
    });

    // 组装完整的修正 prompt：当前报告 + 用户额外要求 + skill 报告生成要求
    const revisionPrompt = `请基于当前的报告内容：\n${report.content}\n\n结合新的要求：${additionalRequirements}\n\n和报告生成要求：\n${skill.content}\n\n对于视频的内容重新进行分析和修正报告。`;

    await this.analysisQueue.add('analyze', {
      taskId: task.id,
      revisionPrompt,
    });

    return { taskId: task.id, status: 'PENDING' };
  }
}
