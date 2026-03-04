import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../../common/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { CreateLinkTaskDto } from './dto/create-link-task.dto';

@Injectable()
export class TaskService implements OnModuleInit {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('video-analysis') private analysisQueue: Queue,
    @InjectQueue('link-video-analysis') private linkAnalysisQueue: Queue,
  ) {}

  /**
   * 服务启动时清理上次崩溃遗留的孤儿任务。
   * 服务器重启后 Bull worker 不再持有这些 job，PROCESSING 状态的任务永远不会完成。
   */
  async onModuleInit() {
    const orphanedTasks = await this.prisma.task.findMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      select: { id: true, status: true },
    });

    if (orphanedTasks.length === 0) return;

    this.logger.warn(
      `发现 ${orphanedTasks.length} 个遗留未完成任务，标记为 FAILED`,
    );

    const orphanedIds = orphanedTasks.map((t) => t.id);

    await this.prisma.task.updateMany({
      where: { id: { in: orphanedIds } },
      data: { status: 'FAILED', completedAt: new Date() },
    });
    await this.prisma.taskVideo.updateMany({
      where: { taskId: { in: orphanedIds }, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { status: 'FAILED', error: '服务重启，任务中断', completedAt: new Date() },
    });
    await this.prisma.taskLinkVideo.updateMany({
      where: { taskId: { in: orphanedIds }, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { status: 'FAILED', error: '服务重启，任务中断', completedAt: new Date() },
    });

    this.logger.log(`已清理 ${orphanedIds.length} 个遗留任务`);
  }

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
    // 确定视频存储 Bucket：优先使用指定 → 默认 → 第一个可用
    let bucketId = dto.bucketId;
    if (!bucketId) {
      const defaultBucket = await this.prisma.ossBucket.findFirst({
        where: { isDefault: true },
        select: { id: true },
      });
      if (!defaultBucket) {
        const firstBucket = await this.prisma.ossBucket.findFirst({
          select: { id: true },
        });
        bucketId = firstBucket?.id;
      } else {
        bucketId = defaultBucket.id;
      }
    }

    if (!bucketId) {
      throw new BadRequestException('系统未配置 OSS Bucket，请先在存储设置中添加 Bucket');
    }

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

    // bucketId 通过 job data 传递给 processor，避免 processor 再去猜测使用哪个 Bucket
    await this.linkAnalysisQueue.add('analyze-links', { taskId: task.id, bucketId });
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

  /**
   * 停止任务：PENDING 或 PROCESSING 状态均可停止。
   * 从 Bull 队列中移除对应 job，将任务及其未完成的子项标记为 FAILED。
   */
  async cancel(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('任务不存在');
    if (!['PENDING', 'PROCESSING'].includes(task.status)) {
      throw new BadRequestException('仅待处理或处理中状态的任务可以停止');
    }

    // 从对应的 Bull 队列中尝试移除 job
    const queue = task.type === 'LINK' ? this.linkAnalysisQueue : this.analysisQueue;
    const jobs = await queue.getJobs(['active', 'waiting', 'delayed']);
    for (const job of jobs) {
      if (job.data?.taskId === id) {
        await job.moveToFailed(new Error('用户手动停止'), true).catch(() => {});
        await job.remove().catch(() => {});
      }
    }

    // 将任务标记为 FAILED，未完成的子视频也一并标记
    await this.prisma.task.update({
      where: { id },
      data: { status: 'FAILED', completedAt: new Date() },
    });
    await this.prisma.taskVideo.updateMany({
      where: { taskId: id, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { status: 'FAILED', error: '任务已手动停止', completedAt: new Date() },
    });
    await this.prisma.taskLinkVideo.updateMany({
      where: { taskId: id, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { status: 'FAILED', error: '任务已手动停止', completedAt: new Date() },
    });

    return { success: true };
  }
}
