import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
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

export class SetModuleDto {
  @IsBoolean()
  enabled!: boolean;
}

export class SetPlanDto {
  @IsEnum(Plan)
  plan!: Plan;
}

export class UpdateBrandingDto {
  @IsOptional() @IsUrl() @MaxLength(500)
  logoUrl?: string;

  @IsOptional() @IsUrl() @MaxLength(500)
  faviconUrl?: string;

  @IsOptional() @IsHexColor()
  primaryColor?: string;

  @IsOptional() @IsHexColor()
  accentColor?: string;

  @IsOptional() @IsEmail() @MaxLength(200)
  emailFrom?: string;

  @IsOptional() @IsString() @MaxLength(40)
  whatsapp?: string;

  @IsOptional() @IsString() @MaxLength(280)
  footerText?: string;
}
