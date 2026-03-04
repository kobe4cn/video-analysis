import { IsString, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';

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
}
