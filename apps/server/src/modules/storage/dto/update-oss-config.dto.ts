import { IsOptional, IsString } from 'class-validator';

export class UpdateOssConfigDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  accessKeyId?: string;

  @IsOptional()
  @IsString()
  accessKeySecret?: string;
}
