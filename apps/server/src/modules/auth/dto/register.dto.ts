import { IsEmail, IsString, MinLength, IsEnum } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsEnum(['ADMIN', 'OPERATOR', 'USER'])
  role: 'ADMIN' | 'OPERATOR' | 'USER';
}
