import { Controller, Get, Delete, Param, Query } from '@nestjs/common';
import { LinkVideoService } from './link-video.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('link-videos')
@Roles('OPERATOR')
export class LinkVideoController {
  constructor(private linkVideoService: LinkVideoService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.linkVideoService.findAll({
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      platform, status, search,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.linkVideoService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.linkVideoService.remove(id);
  }
}
