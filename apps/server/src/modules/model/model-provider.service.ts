import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateModelProviderDto } from './dto/create-model-provider.dto';
import { UpdateModelProviderDto } from './dto/update-model-provider.dto';

@Injectable()
export class ModelProviderService {
  constructor(private prisma: PrismaService) {}

  // API Key 脱敏：只显示前4位和后4位，防止敏感信息泄露
  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) return '****';
    return apiKey.slice(0, 4) + '****' + apiKey.slice(-4);
  }

  async findAll() {
    const providers = await this.prisma.modelProvider.findMany({
      include: { _count: { select: { models: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return providers.map((p) => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      apiKey: this.maskApiKey(p.apiKey),
      isActive: p.isActive,
      modelCount: p._count.models,
      createdAt: p.createdAt,
    }));
  }

  async create(dto: CreateModelProviderDto) {
    return this.prisma.modelProvider.create({ data: dto });
  }

  async update(id: string, dto: UpdateModelProviderDto) {
    const provider = await this.prisma.modelProvider.findUnique({
      where: { id },
    });
    if (!provider) throw new NotFoundException('供应商不存在');
    return this.prisma.modelProvider.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const provider = await this.prisma.modelProvider.findUnique({
      where: { id },
    });
    if (!provider) throw new NotFoundException('供应商不存在');
    await this.prisma.modelProvider.delete({ where: { id } });
    return { success: true };
  }

  async findModels(providerId: string) {
    return this.prisma.model.findMany({
      where: { providerId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
