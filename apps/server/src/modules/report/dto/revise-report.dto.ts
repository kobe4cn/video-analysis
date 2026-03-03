import { IsString } from 'class-validator';

export class ReviseReportDto {
  @IsString()
  additionalRequirements: string;
}
