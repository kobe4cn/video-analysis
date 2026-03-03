import { IsString, IsOptional } from 'class-validator';

export class CreateModelDto {
  @IsString()
  name: string;

  @IsString()
  displayName: string;

  @IsString()
  providerId: string;

  @IsOptional()
  config?: Record<string, unknown>;
}
