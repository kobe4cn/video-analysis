import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'video-analysis' })],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
