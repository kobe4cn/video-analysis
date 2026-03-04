import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class LinkVideoService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number;
    pageSize?: number;
    platform?: string;
    status?: string;
    search?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (params.platform) where.platform = params.platform;
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { url: { contains: params.search, mode: 'insensitive' } },
        { author: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.linkVideo.findMany({
        where,
        include: {
          user: { select: { name: true } },
          _count: { select: { reports: true } },
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.linkVideo.count({ where }),
    ]);
    return {
      items: items.map((lv) => ({
        id: lv.id,
        url: lv.url,
        platform: lv.platform,
        title: lv.title,
        author: lv.author,
        likes: lv.likes,
        collects: lv.collects,
        comments: lv.comments,
        shares: lv.shares,
        status: lv.status,
        error: lv.error,
        reportCount: lv._count.reports,
        createdBy: lv.user.name,
        createdAt: lv.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const lv = await this.prisma.linkVideo.findUnique({
      where: { id },
      include: {
        user: { select: { name: true } },
        reports: {
          select: { id: true, version: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!lv) throw new NotFoundException('链接视频不存在');
    return {
      id: lv.id, url: lv.url, platform: lv.platform,
      title: lv.title, author: lv.author,
      videoFileUrl: lv.videoFileUrl, coverUrl: lv.coverUrl,
      likes: lv.likes, collects: lv.collects, comments: lv.comments, shares: lv.shares,
      status: lv.status, error: lv.error,
      createdBy: lv.user.name, reports: lv.reports,
      createdAt: lv.createdAt.toISOString(), updatedAt: lv.updatedAt.toISOString(),
    };
  }

  async remove(id: string) {
    const lv = await this.prisma.linkVideo.findUnique({ where: { id } });
    if (!lv) throw new NotFoundException('链接视频不存在');
    await this.prisma.linkVideo.delete({ where: { id } });
    return { success: true };
  }
}
