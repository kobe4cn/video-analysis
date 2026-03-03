import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [videoCount, taskCount, reportCount, skillCount, recentTasks, recentReports] = await Promise.all([
      this.prisma.video.count(),
      this.prisma.task.count(),
      this.prisma.report.count(),
      this.prisma.skill.count({ where: { isActive: true } }),
      this.prisma.task.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          skill: { select: { name: true } },
          _count: { select: { taskVideos: true } },
        },
      }),
      this.prisma.report.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: { video: { select: { title: true } } },
      }),
    ]);

    return {
      videoCount,
      taskCount,
      reportCount,
      skillCount,
      recentTasks: recentTasks.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        skillName: t.skill.name,
        videoCount: t._count.taskVideos,
        progress: t.progress,
        createdAt: t.createdAt.toISOString(),
      })),
      recentReports: recentReports.map((r) => ({
        id: r.id,
        videoTitle: r.video.title,
        version: r.version,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }
}
