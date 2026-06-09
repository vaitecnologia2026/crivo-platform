import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Plan } from '@crivo/db';

export class PlatformLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(200)
  password!: string;
}

export class CreateTenantDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  // Slug do subdomínio (<slug>.crivolegacy.com.br). Derivado do nome se ausente.
  @IsOptional()
  @IsString()
  @MaxLength(63)
  slug?: string;

  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;

  @IsString()
  @MaxLength(160)
  adminName!: string;

  @IsEmail()
  adminEmail!: string;

  // Quando ausente, o sistema gera uma senha temporária e a retorna 1 única vez.
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  adminPassword?: string;
}
