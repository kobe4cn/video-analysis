import { IsString, IsNumber, IsOptional } from 'class-validator';

export class UploadCompleteDto {
  @IsString()
  ossKey: string;

  @IsString()
  fileName: string;

  @IsString()
  title: string;

  @IsNumber()
  fileSize: number;

  @IsString()
  bucketId: string;

  @IsOptional()
  @IsNumber()
  duration?: number;
}
