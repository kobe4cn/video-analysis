import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { VideoService } from './video.service';
import { UploadTokenDto } from './dto/upload-token.dto';
import { UploadCompleteDto } from './dto/upload-complete.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

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
