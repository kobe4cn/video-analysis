import { IsString, IsOptional } from 'class-validator';

export class CreateOssConfigDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsString()
  region: string;

  @IsString()
  accessKeyId: string;

  @IsString()
  accessKeySecret: string;
}
