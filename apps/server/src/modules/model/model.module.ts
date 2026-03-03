import { Module } from '@nestjs/common';
import { ModelProviderController } from './model-provider.controller';
import { ModelProviderService } from './model-provider.service';
import { ModelController } from './model.controller';
import { ModelService } from './model.service';

@Module({
  controllers: [ModelProviderController, ModelController],
  providers: [ModelProviderService, ModelService],
  exports: [ModelProviderService, ModelService],
})
export class ModelModule {}
