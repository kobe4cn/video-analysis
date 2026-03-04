import { Module } from '@nestjs/common';
import { LinkVideoController } from './link-video.controller';
import { LinkVideoService } from './link-video.service';

@Module({
  controllers: [LinkVideoController],
  providers: [LinkVideoService],
  exports: [LinkVideoService],
})
export class LinkVideoModule {}
