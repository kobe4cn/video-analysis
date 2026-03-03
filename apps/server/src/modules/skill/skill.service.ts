import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@Injectable()
export class SkillService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { page?: number; pageSize?: number; search?: string }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where = params.search
      ? { name: { contains: params.search, mode: 'insensitive' as const } }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.skill.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          version: true,
          isActive: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.skill.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException('Skill 不存在');
    return skill;
  }

  async create(dto: CreateSkillDto, userId: string) {
    return this.prisma.skill.create({
      data: { ...dto, createdBy: userId },
    });
  }

  // 更新时自动归档旧版本，通过事务确保归档与更新的原子性
  async update(id: string, dto: UpdateSkillDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.skill.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Skill 不存在');

      // 仅在 content 实际发生变更时才归档，避免无意义的版本膨胀
      const contentChanged = dto.content && dto.content !== current.content;
      if (contentChanged) {
        await tx.skillVersion.create({
          data: {
            skillId: id,
            version: current.version,
            content: current.content,
          },
        });
      }

      return tx.skill.update({
        where: { id },
        data: {
          ...dto,
          version: contentChanged ? current.version + 1 : current.version,
        },
      });
    });
  }

  async remove(id: string) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException('Skill 不存在');
    await this.prisma.skill.delete({ where: { id } });
    return { success: true };
  }

  async findVersions(id: string) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException('Skill 不存在');

    return this.prisma.skillVersion.findMany({
      where: { skillId: id },
      select: { id: true, version: true, createdAt: true },
      orderBy: { version: 'desc' },
    });
  }

  async findVersion(id: string, versionId: string) {
    const version = await this.prisma.skillVersion.findFirst({
      where: { id: versionId, skillId: id },
    });
    if (!version) throw new NotFoundException('版本不存在');
    return version;
  }
}
