import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

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
      videoTitle: report.video.title,
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
      videoTitle: report.video.title,
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
}
