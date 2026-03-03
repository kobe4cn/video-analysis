import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { SkillService } from './skill.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('skills')
@Roles('OPERATOR')
export class SkillController {
  constructor(private skillService: SkillService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.skillService.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      search,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.skillService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSkillDto, @CurrentUser('id') userId: string) {
    return this.skillService.create(dto, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSkillDto) {
    return this.skillService.update(id, dto);
  }

  // 删除操作需要 ADMIN 权限，防止误删导致关联任务失效
  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.skillService.remove(id);
  }

  @Get(':id/versions')
  findVersions(@Param('id') id: string) {
    return this.skillService.findVersions(id);
  }

  @Get(':id/versions/:versionId')
  findVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.skillService.findVersion(id, versionId);
  }
}
