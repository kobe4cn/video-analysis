import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { OssBucketService } from './oss-bucket.service';
import { CreateOssBucketDto } from './dto/create-oss-bucket.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('oss-buckets')
@Roles('ADMIN')
export class OssBucketController {
  constructor(private service: OssBucketService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateOssBucketDto) {
    return this.service.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
