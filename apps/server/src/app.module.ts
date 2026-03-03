import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma.module';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env 位于 monorepo 根目录，需通过相对路径向上定位
      envFilePath: join(__dirname, '../../../../.env'),
    }),
    PrismaModule,
  ],
})
export class AppModule {}
