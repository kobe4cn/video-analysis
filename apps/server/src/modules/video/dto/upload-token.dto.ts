import { IsString, IsNumber, IsOptional } from 'class-validator';

export class UploadTokenDto {
  @IsString()
  fileName: string;

  @IsNumber()
  fileSize: number;

  @IsOptional()
  @IsString()
  bucketId?: string;
}
