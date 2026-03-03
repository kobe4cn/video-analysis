import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { OssService } from './oss.service';
import { CreateOssBucketDto } from './dto/create-oss-bucket.dto';

@Injectable()
export class OssBucketService {
  private readonly logger = new Logger(OssBucketService.name);

  constructor(
    private prisma: PrismaService,
    private ossService: OssService,
  ) {}

  async findAll() {
    const buckets = await this.prisma.ossBucket.findMany({
      include: {
        ossConfig: { select: { name: true } },
        _count: { select: { videos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return buckets.map((b) => ({
      id: b.id,
      name: b.name,
      ossConfigId: b.ossConfigId,
      ossConfigName: b.ossConfig.name,
      isDefault: b.isDefault,
      videoCount: b._count.videos,
      createdAt: b.createdAt,
    }));
  }

  async create(dto: CreateOssBucketDto) {
    // 第 1 阶段：在阿里云上创建 Bucket
    // 先操作远端，远端失败时无需任何本地清理
    try {
      await this.ossService.createBucket(dto.ossConfigId, dto.name);
    } catch (error) {
      this.logger.error(
        `阿里云 Bucket 创建失败: ${dto.name}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException(
        `阿里云 Bucket 创建失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }

    // 第 2 阶段：写入数据库
    // 阿里云侧已成功，如果数据库写入失败需要回滚阿里云上的 Bucket
    try {
      if (dto.isDefault) {
        await this.prisma.ossBucket.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }
      return await this.prisma.ossBucket.create({ data: dto });
    } catch (dbError) {
      this.logger.error(
        `数据库写入失败，尝试回滚阿里云 Bucket: ${dto.name}`,
        dbError instanceof Error ? dbError.stack : String(dbError),
      );

      // 尽力回滚：删除已创建的阿里云 Bucket
      try {
        await this.ossService.removeBucket(dto.ossConfigId, dto.name);
        this.logger.log(`回滚成功：阿里云 Bucket "${dto.name}" 已删除`);
      } catch (rollbackError) {
        // 回滚失败意味着阿里云上存在一个"孤儿" Bucket，需要人工介入
        this.logger.error(
          `回滚失败：阿里云 Bucket "${dto.name}" 需要手动清理`,
          rollbackError instanceof Error
            ? rollbackError.stack
            : String(rollbackError),
        );
      }

      throw new InternalServerErrorException(
        '数据库写入失败，Bucket 创建已回滚',
      );
    }
  }

  /** 关联阿里云上已有的 Bucket，仅写入数据库不在阿里云创建 */
  async link(dto: CreateOssBucketDto) {
    if (dto.isDefault) {
      await this.prisma.ossBucket.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.ossBucket.create({ data: dto });
  }

  async remove(id: string) {
    const bucket = await this.prisma.ossBucket.findUnique({
      where: { id },
      include: { ossConfig: true },
    });
    if (!bucket) throw new NotFoundException('Bucket 不存在');

    // Bucket 下仍有视频时阻止删除，防止阿里云 BucketNotEmpty 错误
    const videoCount = await this.prisma.video.count({
      where: { bucketId: id },
    });
    if (videoCount > 0) {
      throw new BadRequestException(
        `Bucket 下仍有 ${videoCount} 个视频，请先删除或迁移视频`,
      );
    }

    // 先删阿里云，再删数据库（与创建时"先远端后本地"策略一致）
    try {
      await this.ossService.removeBucket(bucket.ossConfigId, bucket.name);
    } catch (error) {
      this.logger.error(
        `阿里云 Bucket 删除失败: ${bucket.name}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException(
        `阿里云 Bucket 删除失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }

    await this.prisma.ossBucket.delete({ where: { id } });
    return { success: true };
  }
}
