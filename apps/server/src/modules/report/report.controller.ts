import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReviseReportDto } from './dto/revise-report.dto';
import { Roles } from '../auth/decorators/roles.decorator';

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

  // 报告修订：实际的异步处理将在 Task 模块的 Bull 队列中实现（Task 14）
  @Post('reports/:id/revise')
  @Roles('OPERATOR')
  revise(@Param('id') id: string, @Body() dto: ReviseReportDto) {
    return {
      message: '报告修复请求已提交',
      reportId: id,
      additionalRequirements: dto.additionalRequirements,
    };
  }
}
