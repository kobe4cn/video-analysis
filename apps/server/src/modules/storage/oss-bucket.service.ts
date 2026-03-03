import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateOssBucketDto } from './dto/create-oss-bucket.dto';

@Injectable()
export class OssBucketService {
  constructor(private prisma: PrismaService) {}

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
    // 同一时刻只允许一个默认 Bucket，设置新默认前需取消已有的
    if (dto.isDefault) {
      await this.prisma.ossBucket.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.ossBucket.create({ data: dto });
  }

  async remove(id: string) {
    const bucket = await this.prisma.ossBucket.findUnique({ where: { id } });
    if (!bucket) throw new NotFoundException('Bucket 不存在');
    await this.prisma.ossBucket.delete({ where: { id } });
    return { success: true };
  }
}
