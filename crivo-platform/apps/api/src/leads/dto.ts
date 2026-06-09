import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LeadStage } from '@crivo/db';

export class CreateLeadDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  segment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  origin?: string;

  @IsOptional()
  @IsEnum(LeadStage)
  stage?: LeadStage;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsEnum(LeadStage)
  stage?: LeadStage;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
