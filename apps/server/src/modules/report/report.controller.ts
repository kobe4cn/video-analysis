import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReviseReportDto } from './dto/revise-report.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller()
export class ReportController {
  constructor(private reportService: ReportService) {}

  @Get('videos/:videoId/reports')
  findByVideoId(@Param('videoId') videoId: string) {
    return this.reportService.findByVideoId(videoId);
  }

  @Get('reports/:id')
  findOne(@Param('id') id: string) {
    return this.reportService.findOne(id);
  }

  @Get('reports/:id/versions')
  findVersions(@Param('id') id: string) {
    return this.reportService.findVersions(id);
  }

  @Get('reports/:id/versions/:versionId')
  findVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.reportService.findVersion(id, versionId);
  }

  @Post('reports/:id/revise')
  @Roles('OPERATOR')
  revise(
    @Param('id') id: string,
    @Body() dto: ReviseReportDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.reportService.revise(id, dto.additionalRequirements, userId);
  }
}
