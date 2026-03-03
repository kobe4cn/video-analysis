import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateModelProviderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
