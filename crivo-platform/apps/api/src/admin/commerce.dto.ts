import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Plan, ProductStatus, PlatformLeadStage } from '@crivo/db';

// ── Produtos ──

export class UpsertProductDto {
  @IsOptional() @IsString() @MaxLength(80)
  slug?: string;

  @IsString() @MaxLength(160)
  name!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string | null;

  @IsOptional() @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional() @IsEnum(Plan)
  plan?: Plan | null;

  @IsOptional() @IsInt() @Min(0)
  monthlyPriceCents?: number;

  @IsOptional() @IsInt() @Min(0)
  setupPriceCents?: number;

  @IsOptional() @IsInt() @Min(0)
  maxUsers?: number;

  @IsOptional() @IsInt() @Min(0)
  maxLeaders?: number;

  @IsOptional() @IsString() @MaxLength(160)
  companyType?: string | null;

  @IsOptional() @IsArray() @IsString({ each: true })
  modules?: string[];

  // Instrumento de diagnóstico e config de IA: JSON livre (shape validado no service).
  @IsOptional() @IsObject()
  diagnostic?: Record<string, unknown> | null;

  @IsOptional() @IsObject()
  aiConfig?: Record<string, unknown> | null;

  @IsOptional() @IsBoolean()
  isLeadCapture?: boolean;
}

// ── CRM do super admin ──

export class SetLeadStageDto {
  @IsEnum(PlatformLeadStage)
  stage!: PlatformLeadStage;
}

export class SetLeadNotesDto {
  @IsString() @MaxLength(4000)
  notes!: string;
}

// ── Diagnóstico Inicial público (LP) ──

class DiagnosticAnswerDto {
  @IsInt()
  questionId!: number;

  @IsInt() @Min(1)
  value!: number;
}

export class CreateDiagnosticLeadDto {
  @IsString() @MaxLength(160)
  name!: string;

  @IsOptional() @IsString() @MaxLength(160)
  company?: string;

  @IsOptional() @IsString() @MaxLength(200)
  email?: string;

  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(120)
  segment?: string;

  @IsOptional() @IsString() @MaxLength(40)
  employeesCount?: string;

  @IsOptional() @IsString() @MaxLength(60)
  origin?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagnosticAnswerDto)
  answers!: DiagnosticAnswerDto[];
}
