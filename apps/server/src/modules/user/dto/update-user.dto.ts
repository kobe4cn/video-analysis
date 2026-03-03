import { IsOptional, IsEnum, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(['ADMIN', 'OPERATOR', 'USER'])
  role?: 'ADMIN' | 'OPERATOR' | 'USER';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
