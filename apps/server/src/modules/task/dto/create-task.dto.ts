import { IsString, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';

export class CreateTaskDto {
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
  videoIds: string[];
}
