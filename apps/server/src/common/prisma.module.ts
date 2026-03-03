import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// 全局模块，所有功能模块均可直接注入 PrismaService 而无需显式导入
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
