import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreateOssBucketDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, {
    message:
      'Bucket 名称仅允许小写字母、数字和连字符（-），长度 3-63 个字符，且不能以连字符开头或结尾',
  })
  name: string;

  @IsString()
  ossConfigId: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
