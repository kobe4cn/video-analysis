import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ModelProviderService } from './model-provider.service';
import { CreateModelProviderDto } from './dto/create-model-provider.dto';
import { UpdateModelProviderDto } from './dto/update-model-provider.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('model-providers')
@Roles('ADMIN')
export class ModelProviderController {
  constructor(private service: ModelProviderService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateModelProviderDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateModelProviderDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get(':id/models')
  findModels(@Param('id') id: string) {
    return this.service.findModels(id);
  }
}
