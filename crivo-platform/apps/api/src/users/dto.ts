import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '@crivo/db';

export class CreateUserDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsEnum(Role)
  role!: Role;

  // Ausente → o sistema gera e retorna uma senha temporária (1 única vez).
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password?: string;

  // Telas (rotas) liberadas para o usuário. Ausente/null = sem restrição.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  screenAccess?: string[] | null;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  screenAccess?: string[] | null;
}
