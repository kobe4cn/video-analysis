import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateOssConfigDto } from './dto/create-oss-config.dto';
import { UpdateOssConfigDto } from './dto/update-oss-config.dto';

@Injectable()
export class OssConfigService {
  constructor(private prisma: PrismaService) {}

  // 对 AK 做脱敏处理，仅保留首尾各 4 位，防止管理后台泄露完整密钥
  private maskKey(key: string): string {
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  }

  async findAll() {
    const configs = await this.prisma.ossConfig.findMany({
      include: { _count: { select: { buckets: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return configs.map((c) => ({
      id: c.id,
      name: c.name,
      provider: c.provider,
      region: c.region,
      accessKeyId: this.maskKey(c.accessKeyId),
      bucketCount: c._count.buckets,
      createdAt: c.createdAt,
    }));
  }

  async create(dto: CreateOssConfigDto) {
    return this.prisma.ossConfig.create({
      data: {
        ...dto,
        provider: dto.provider || 'aliyun',
      },
    });
  }

  async update(id: string, dto: UpdateOssConfigDto) {
    const config = await this.prisma.ossConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('OSS 配置不存在');
    return this.prisma.ossConfig.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const config = await this.prisma.ossConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('OSS 配置不存在');
    await this.prisma.ossConfig.delete({ where: { id } });
    return { success: true };
  }
}
