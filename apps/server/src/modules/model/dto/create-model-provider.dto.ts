import { IsString } from 'class-validator';

export class CreateModelProviderDto {
  @IsString()
  name: string;

  @IsString()
  baseUrl: string;

  @IsString()
  apiKey: string;
}
