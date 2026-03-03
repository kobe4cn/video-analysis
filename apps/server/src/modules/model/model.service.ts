import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';

@Injectable()
export class ModelService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const models = await this.prisma.model.findMany({
      where: { isActive: true },
      include: { provider: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return models.map((m) => ({
      id: m.id,
      name: m.name,
      displayName: m.displayName,
      providerId: m.providerId,
      providerName: m.provider.name,
      isActive: m.isActive,
      config: m.config,
    }));
  }

  async create(dto: CreateModelDto) {
    const { config, ...rest } = dto;
    return this.prisma.model.create({
      data: { ...rest, config: config as any },
    });
  }

  async update(id: string, dto: UpdateModelDto) {
    const model = await this.prisma.model.findUnique({ where: { id } });
    if (!model) throw new NotFoundException('模型不存在');
    const { config, ...rest } = dto;
    return this.prisma.model.update({
      where: { id },
      data: { ...rest, ...(config !== undefined && { config: config as any }) },
    });
  }

  async remove(id: string) {
    const model = await this.prisma.model.findUnique({ where: { id } });
    if (!model) throw new NotFoundException('模型不存在');
    await this.prisma.model.delete({ where: { id } });
    return { success: true };
  }
}
