import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ModelModule } from './modules/model/model.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { StorageModule } from './modules/storage/storage.module';
import { VideoModule } from './modules/video/video.module';
import { SkillModule } from './modules/skill/skill.module';
import { ReportModule } from './modules/report/report.module';
import { NotificationModule } from './modules/notification/notification.module';
import { TaskModule } from './modules/task/task.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { LinkVideoModule } from './modules/link-video/link-video.module';
import { ScraperModule } from './modules/scraper/scraper.module';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env 位于 monorepo 根目录；编译后 __dirname = dist/，需向上 3 层
      envFilePath: join(__dirname, '../../../.env'),
      // 容器环境中由 K8s ConfigMap/Secret 注入环境变量，不需要 .env 文件
      ignoreEnvFile: !!process.env.KUBERNETES_SERVICE_HOST,
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    ModelModule,
    StorageModule,
    VideoModule,
    SkillModule,
    ReportModule,
    NotificationModule,
    TaskModule,
    ScraperModule,
    LinkVideoModule,
    DashboardModule,
  ],
  providers: [
    // 全局启用 JWT 认证，未标注 @Public() 的端点默认需要登录
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // 全局启用角色守卫，配合 @Roles() 装饰器进行权限控制
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
