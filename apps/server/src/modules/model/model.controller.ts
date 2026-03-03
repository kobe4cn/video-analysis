import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ModelService } from './model.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('models')
export class ModelController {
  constructor(private service: ModelService) {}

  // Operator 及以上角色可查看模型列表（用于创建任务时选择模型）
  @Get()
  @Roles('OPERATOR')
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateModelDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateModelDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
