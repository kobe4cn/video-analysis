import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OssService } from '../storage/oss.service';
import { UploadTokenDto } from './dto/upload-token.dto';
import { UploadCompleteDto } from './dto/upload-complete.dto';
import { unlink } from 'fs/promises';

@Injectable()
export class VideoService {
  constructor(
    private prisma: PrismaService,
    private ossService: OssService,
  ) {}

  // ─── 文件夹管理 ───

  async createFolder(name: string, userId: string) {
    return this.prisma.videoFolder.create({
      data: { name, createdBy: userId },
    });
  }

  async findAllFolders() {
    const folders = await this.prisma.videoFolder.findMany({
      include: { _count: { select: { videos: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return folders.map((f) => ({
      id: f.id,
      name: f.name,
      videoCount: f._count.videos,
      createdAt: f.createdAt.toISOString(),
    }));
  }

  async renameFolder(id: string, name: string) {
    const folder = await this.prisma.videoFolder.findUnique({ where: { id } });
    if (!folder) throw new NotFoundException('文件夹不存在');
    return this.prisma.videoFolder.update({
      where: { id },
      data: { name },
    });
  }

  async removeFolder(id: string) {
    const folder = await this.prisma.videoFolder.findUnique({
      where: { id },
      include: { _count: { select: { videos: true } } },
    });
    if (!folder) throw new NotFoundException('文件夹不存在');
    if (folder._count.videos > 0) {
      throw new BadRequestException('文件夹内仍有视频，无法删除');
    }
    await this.prisma.videoFolder.delete({ where: { id } });
    return { success: true };
  }

  // ─── 视频管理 ───

  async findAll(params: { page?: number; pageSize?: number; search?: string; folderId?: string }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.search) {
      where.title = { contains: params.search, mode: 'insensitive' };
    }
    // folderId=root 表示查询未归类到任何文件夹的视频
    if (params.folderId === 'root') {
      where.folderId = null;
    } else if (params.folderId) {
      where.folderId = params.folderId;
    }

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

  /**
   * 接收 Multer 临时文件，中转上传到 OSS 并创建视频记录。
   * 无需前端配置 CORS，所有 OSS 交互在服务端完成。
   */
  async uploadVideo(
    file: Express.Multer.File,
    title: string,
    bucketId: string,
    userId: string,
    folderId?: string,
  ) {
    if (!bucketId) {
      const defaultBucket = await this.prisma.ossBucket.findFirst({
        where: { isDefault: true },
      });
      if (!defaultBucket) {
        throw new NotFoundException('未配置默认存储桶，请先在设置中配置');
      }
      bucketId = defaultBucket.id;
    }

    // Multer 默认以 latin1 编码 originalname，中文会乱码，需还原为 UTF-8
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    // 查询文件夹名称用于构建 OSS 路径
    let folderPath: string | undefined;
    if (folderId) {
      const folder = await this.prisma.videoFolder.findUnique({ where: { id: folderId } });
      if (!folder) throw new NotFoundException('文件夹不存在');
      folderPath = folder.name;
    }

    try {
      const { key, ossUrl } = await this.ossService.uploadFile(
        bucketId,
        fileName,
        file.path,
        folderPath,
      );

      const video = await this.prisma.video.create({
        data: {
          title: title || fileName.replace(/\.[^/.]+$/, ''),
          fileName,
          ossKey: key,
          ossUrl,
          fileSize: BigInt(file.size),
          bucketId,
          uploadedBy: userId,
          folderId: folderId || null,
        },
      });

      return {
        id: video.id,
        title: video.title,
        fileName: video.fileName,
        ossUrl: video.ossUrl,
        fileSize: Number(video.fileSize),
      };
    } finally {
      try { await unlink(file.path); } catch {}
    }
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
