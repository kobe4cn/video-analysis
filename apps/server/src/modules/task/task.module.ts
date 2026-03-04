import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { TaskProcessor } from './task.processor';
import { LinkTaskProcessor } from './link-task.processor';
import { LlmModule } from '../llm/llm.module';
import { ReportModule } from '../report/report.module';
import { NotificationModule } from '../notification/notification.module';
import { ScraperModule } from '../scraper/scraper.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'video-analysis' }),
    BullModule.registerQueue({ name: 'link-video-analysis' }),
    LlmModule,
    ReportModule,
    NotificationModule,
    ScraperModule,
  ],
  controllers: [TaskController],
  providers: [TaskService, TaskProcessor, LinkTaskProcessor],
})
export class TaskModule {}
