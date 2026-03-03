import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateOssBucketDto {
  @IsString()
  name: string;

  @IsString()
  ossConfigId: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
