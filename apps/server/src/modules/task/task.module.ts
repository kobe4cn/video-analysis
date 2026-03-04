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
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'video-analysis',
      defaultJobOptions: {
        // 单个视频 LLM 分析最多 10 分钟，超时自动标记失败
        timeout: 10 * 60 * 1000,
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }),
    BullModule.registerQueue({
      name: 'link-video-analysis',
      defaultJobOptions: {
        // 链接任务涉及抓取+下载+分析，单链接给 15 分钟
        timeout: 15 * 60 * 1000,
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }),
    LlmModule,
    ReportModule,
    NotificationModule,
    ScraperModule,
    StorageModule,
  ],
  controllers: [TaskController],
  providers: [TaskService, TaskProcessor, LinkTaskProcessor],
})
export class TaskModule {}
