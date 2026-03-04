import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { CreateLinkTaskDto } from './dto/create-link-task.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('tasks')
@Roles('OPERATOR')
export class TaskController {
  constructor(private taskService: TaskService) {}

  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser('id') userId: string) {
    return this.taskService.create(dto, userId);
  }

  @Post('link')
  createLink(@Body() dto: CreateLinkTaskDto, @CurrentUser('id') userId: string) {
    return this.taskService.createLinkTask(dto, userId);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.taskService.findAll({
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      status,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.taskService.findOne(id);
  }

  @Delete(':id')
  cancel(@Param('id') id: string) {
    return this.taskService.cancel(id);
  }
}
