import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { OssBucketService } from './oss-bucket.service';
import { OssService } from './oss.service';
import { CreateOssBucketDto } from './dto/create-oss-bucket.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('oss-buckets')
@Roles('ADMIN')
export class OssBucketController {
  constructor(
    private service: OssBucketService,
    private ossService: OssService,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  /** 列出指定 OSS 配置下阿里云上所有 Bucket，用于关联已有 Bucket */
  @Get('remote')
  listRemote(@Query('configId') configId: string) {
    return this.ossService.listRemoteBuckets(configId);
  }

  /** 在阿里云上新建 Bucket 并写入数据库 */
  @Post()
  create(@Body() dto: CreateOssBucketDto) {
    return this.service.create(dto);
  }

  /** 关联阿里云上已有的 Bucket，仅写入数据库 */
  @Post('link')
  link(@Body() dto: CreateOssBucketDto) {
    return this.service.link(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
