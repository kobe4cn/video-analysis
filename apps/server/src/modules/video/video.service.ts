import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OssService } from '../storage/oss.service';
import { UploadTokenDto } from './dto/upload-token.dto';
import { UploadCompleteDto } from './dto/upload-complete.dto';

@Injectable()
export class VideoService {
  constructor(
    private prisma: PrismaService,
    private ossService: OssService,
  ) {}

  async findAll(params: { page?: number; pageSize?: number; search?: string }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where = params.search
      ? { title: { contains: params.search, mode: 'insensitive' as const } }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        include: {
          reports: { select: { id: true }, take: 1, orderBy: { updatedAt: 'desc' } },
          user: { select: { name: true } },
          bucket: { select: { name: true } },
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.video.count({ where }),
    ]);

    return {
      items: items.map((v) => ({
        id: v.id,
        title: v.title,
        fileName: v.fileName,
        ossUrl: v.ossUrl,
        fileSize: Number(v.fileSize),
        duration: v.duration,
        bucketId: v.bucketId,
        bucketName: v.bucket.name,
        uploadedBy: v.user.name,
        hasReport: v.reports.length > 0,
        latestReportId: v.reports[0]?.id || null,
        createdAt: v.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: {
        reports: {
          select: { id: true, version: true, createdAt: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        },
        user: { select: { name: true } },
        bucket: { select: { name: true } },
      },
    });
    if (!video) throw new NotFoundException('视频不存在');

    return {
      id: video.id,
      title: video.title,
      fileName: video.fileName,
      ossUrl: video.ossUrl,
      fileSize: Number(video.fileSize),
      duration: video.duration,
      bucketId: video.bucketId,
      bucketName: video.bucket.name,
      uploadedBy: video.user.name,
      reports: video.reports,
      createdAt: video.createdAt.toISOString(),
    };
  }

  async getUploadToken(dto: UploadTokenDto) {
    let bucketId = dto.bucketId;
    if (!bucketId) {
      const defaultBucket = await this.prisma.ossBucket.findFirst({
        where: { isDefault: true },
      });
      if (!defaultBucket) {
        throw new NotFoundException('未配置默认存储桶，请先在设置中配置');
      }
      bucketId = defaultBucket.id;
    }

    return this.ossService.generateSignedUploadUrl(
      bucketId,
      dto.fileName,
      dto.contentType,
    );
  }

  async completeUpload(dto: UploadCompleteDto, userId: string) {
    const ossUrl = await this.ossService.getPublicUrl(dto.bucketId, dto.ossKey);

    return this.prisma.video.create({
      data: {
        title: dto.title,
        fileName: dto.fileName,
        ossKey: dto.ossKey,
        ossUrl,
        fileSize: BigInt(dto.fileSize),
        duration: dto.duration,
        bucketId: dto.bucketId,
        uploadedBy: userId,
      },
    });
  }

  async remove(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      select: { id: true, ossKey: true, bucketId: true },
    });
    if (!video) throw new NotFoundException('视频不存在');

    // 先尝试删除 OSS 对象，即使失败也继续删除数据库记录（文件可能已不存在）
    try {
      await this.ossService.deleteObject(video.bucketId, video.ossKey);
    } catch {}

    await this.prisma.video.delete({ where: { id } });
    return { success: true };
  }

  async getDownloadUrl(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      select: { ossKey: true, bucketId: true },
    });
    if (!video) throw new NotFoundException('视频不存在');

    const url = await this.ossService.getSignedUrl(video.bucketId, video.ossKey);
    return { url };
  }
}
