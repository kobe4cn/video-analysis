import { IsString, IsNotEmpty, IsArray, ArrayMinSize, IsOptional } from 'class-validator';

export class CreateLinkTaskDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  skillId: string;

  @IsString()
  @IsNotEmpty()
  modelId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  urls: string[];

  /** 用于存储下载的视频文件，不传则自动选择默认或第一个可用 Bucket */
  @IsString()
  @IsOptional()
  bucketId?: string;
}
