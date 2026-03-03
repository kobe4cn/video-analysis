import {
  Controller, Get, Post, Delete, Param, Body, Query,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { VideoService } from './video.service';
import { UploadTokenDto } from './dto/upload-token.dto';
import { UploadCompleteDto } from './dto/upload-complete.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const UPLOAD_DIR = join(tmpdir(), 'video-uploads');
try { mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}

@Controller('videos')
export class VideoController {
  constructor(private videoService: VideoService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.videoService.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      search,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.videoService.findOne(id);
  }

  /** 文件上传端点：前端通过 FormData 发送文件，后端中转上传到 OSS */
  @Post('upload')
  @Roles('OPERATOR')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({ destination: UPLOAD_DIR }),
      limits: { fileSize: 5 * 1024 * 1024 * 1024 },
    }),
  )
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Body('bucketId') bucketId: string,
    @CurrentUser('id') userId: string,
  ) {
    if (!file) throw new BadRequestException('未选择文件');
    return this.videoService.uploadVideo(file, title, bucketId, userId);
  }

  @Post('upload-token')
  @Roles('OPERATOR')
  getUploadToken(@Body() dto: UploadTokenDto) {
    return this.videoService.getUploadToken(dto);
  }

  @Post('complete')
  @Roles('OPERATOR')
  completeUpload(
    @Body() dto: UploadCompleteDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.videoService.completeUpload(dto, userId);
  }

  @Delete(':id')
  @Roles('OPERATOR')
  remove(@Param('id') id: string) {
    return this.videoService.remove(id);
  }

  @Get(':id/download-url')
  getDownloadUrl(@Param('id') id: string) {
    return this.videoService.getDownloadUrl(id);
  }
}
