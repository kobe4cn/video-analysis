import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../../common/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { CreateLinkTaskDto } from './dto/create-link-task.dto';

@Injectable()
export class TaskService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('video-analysis') private analysisQueue: Queue,
    @InjectQueue('link-video-analysis') private linkAnalysisQueue: Queue,
  ) {}

  /** 创建分析任务并将其加入 Bull 队列异步处理 */
  async create(dto: CreateTaskDto, userId: string) {
    // 在事务中同时创建 Task 主体和关联的 TaskVideo 记录，保证数据一致性
    const task = await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.create({
        data: {
          name: dto.name,
          skillId: dto.skillId,
          modelId: dto.modelId,
          createdBy: userId,
        },
      });

      await tx.taskVideo.createMany({
        data: dto.videoIds.map((videoId) => ({
          taskId: t.id,
          videoId,
        })),
      });

      return t;
    });

    // 入队后立即返回，分析过程由 TaskProcessor 异步完成
    await this.analysisQueue.add('analyze', { taskId: task.id });

    return { id: task.id, status: task.status };
  }

  /** 创建链接视频解析任务：自动识别平台、创建 LinkVideo 记录并入队 */
  async createLinkTask(dto: CreateLinkTaskDto, userId: string) {
    const task = await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.create({
        data: {
          name: dto.name,
          type: 'LINK',
          skillId: dto.skillId,
          modelId: dto.modelId,
          createdBy: userId,
        },
      });

      for (const url of dto.urls) {
        const platform = this.detectPlatform(url);
        const linkVideo = await tx.linkVideo.create({
          data: {
            url,
            platform: platform || 'XIAOHONGSHU',
            createdBy: userId,
          },
        });
        await tx.taskLinkVideo.create({
          data: { taskId: t.id, linkVideoId: linkVideo.id },
        });
      }

      return t;
    });

    await this.linkAnalysisQueue.add('analyze-links', { taskId: task.id });
    return { id: task.id, status: task.status, linkVideoCount: dto.urls.length };
  }

  private detectPlatform(url: string): 'XIAOHONGSHU' | 'DOUYIN' | null {
    if (/xiaohongshu\.com|xhslink\.com/i.test(url)) return 'XIAOHONGSHU';
    if (/douyin\.com|iesdouyin\.com/i.test(url)) return 'DOUYIN';
    return null;
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    status?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where = params.status
      ? { status: params.status as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          skill: { select: { name: true } },
          model: { select: { displayName: true } },
          user: { select: { name: true } },
          _count: { select: { taskVideos: true, taskLinkVideos: true } },
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        status: t.status,
        skillName: t.skill.name,
        modelName: t.model.displayName,
        createdBy: t.user.name,
        videoCount: t._count.taskVideos + t._count.taskLinkVideos,
        progress: t.progress,
        startedAt: t.startedAt?.toISOString() || null,
        completedAt: t.completedAt?.toISOString() || null,
        createdAt: t.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        skill: { select: { name: true } },
        model: { select: { displayName: true } },
        user: { select: { name: true } },
        taskVideos: {
          include: {
            video: { select: { title: true, ossUrl: true } },
            report: { select: { id: true, version: true } },
          },
        },
        taskLinkVideos: {
          include: {
            linkVideo: { select: { title: true, url: true, platform: true, status: true, likes: true, collects: true, comments: true, shares: true } },
            report: { select: { id: true, version: true } },
          },
        },
      },
    });
    if (!task) throw new NotFoundException('任务不存在');

    return {
      id: task.id,
      name: task.name,
      type: task.type,
      status: task.status,
      skillName: task.skill.name,
      modelName: task.model.displayName,
      createdBy: task.user.name,
      progress: task.progress,
      startedAt: task.startedAt?.toISOString() || null,
      completedAt: task.completedAt?.toISOString() || null,
      createdAt: task.createdAt.toISOString(),
      videos: task.taskVideos.map((tv) => ({
        id: tv.id,
        videoId: tv.videoId,
        videoTitle: tv.video.title,
        status: tv.status,
        reportId: tv.report?.id || null,
        reportVersion: tv.report?.version || null,
        error: tv.error,
        startedAt: tv.startedAt?.toISOString() || null,
        completedAt: tv.completedAt?.toISOString() || null,
      })),
      linkVideos: task.taskLinkVideos.map((tlv) => ({
        id: tlv.id,
        linkVideoId: tlv.linkVideoId,
        url: tlv.linkVideo.url,
        platform: tlv.linkVideo.platform,
        title: tlv.linkVideo.title,
        linkVideoStatus: tlv.linkVideo.status,
        status: tlv.status,
        reportId: tlv.report?.id || null,
        reportVersion: tlv.report?.version || null,
        error: tlv.error,
        likes: tlv.linkVideo.likes,
        collects: tlv.linkVideo.collects,
        comments: tlv.linkVideo.comments,
        shares: tlv.linkVideo.shares,
        startedAt: tlv.startedAt?.toISOString() || null,
        completedAt: tlv.completedAt?.toISOString() || null,
      })),
    };
  }

  /** 取消任务，仅 PENDING 状态可以取消，避免打断正在处理的分析流程 */
  async cancel(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.status !== 'PENDING') {
      throw new BadRequestException('仅待处理状态的任务可以取消');
    }

    await this.prisma.task.update({
      where: { id },
      data: { status: 'FAILED', completedAt: new Date() },
    });
    return { success: true };
  }
}
