import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { TaskProcessor } from './task.processor';
import { LlmModule } from '../llm/llm.module';
import { ReportModule } from '../report/report.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'video-analysis' }),
    LlmModule,
    ReportModule,
    NotificationModule,
  ],
  controllers: [TaskController],
  providers: [TaskService, TaskProcessor],
})
export class TaskModule {}
