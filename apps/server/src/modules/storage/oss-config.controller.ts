import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { OssConfigService } from './oss-config.service';
import { CreateOssConfigDto } from './dto/create-oss-config.dto';
import { UpdateOssConfigDto } from './dto/update-oss-config.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('oss-configs')
@Roles('ADMIN')
export class OssConfigController {
  constructor(private service: OssConfigService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateOssConfigDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOssConfigDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
