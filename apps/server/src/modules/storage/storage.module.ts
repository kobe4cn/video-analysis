import { Module } from '@nestjs/common';
import { OssConfigController } from './oss-config.controller';
import { OssConfigService } from './oss-config.service';
import { OssBucketController } from './oss-bucket.controller';
import { OssBucketService } from './oss-bucket.service';
import { OssService } from './oss.service';

@Module({
  controllers: [OssConfigController, OssBucketController],
  providers: [OssConfigService, OssBucketService, OssService],
  exports: [OssService, OssBucketService],
})
export class StorageModule {}
