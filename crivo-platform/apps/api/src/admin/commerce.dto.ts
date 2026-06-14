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
import {
  Plan,
  ProductStatus,
  PlatformLeadStage,
  ContractModel,
  ContractStatus,
  DiagnosticMethod,
  TechnicalOutput,
} from '@crivo/db';

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

export class ConvertLeadDto {
  @IsString()
  productId!: string;
}

// ── Configuração de IA ──

export class UpsertAiSettingsDto {
  @IsOptional() @IsString() @MaxLength(300)
  apiKey?: string;

  @IsOptional() @IsString() @MaxLength(60)
  model?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsArray() @IsString({ each: true })
  enabledModules?: string[];
}

export class AiTestDto {
  @IsOptional() @IsString() @MaxLength(300)
  apiKey?: string;
}

// ── Contrato por empresa ──

export class UpsertContractDto {
  @IsOptional() @IsString()
  productId?: string | null;

  @IsOptional() @IsEnum(ContractModel)
  model?: ContractModel;

  @IsOptional() @IsEnum(ContractStatus)
  status?: ContractStatus;

  @IsOptional() @IsEnum(DiagnosticMethod)
  method?: DiagnosticMethod | null;

  @IsOptional() @IsEnum(TechnicalOutput)
  technicalOutput?: TechnicalOutput;

  @IsOptional() @IsString()
  startDate?: string | null;

  @IsOptional() @IsString()
  endDate?: string | null;

  @IsOptional() @IsInt() @Min(0)
  accessDays?: number | null;

  @IsOptional() @IsInt() @Min(0)
  rounds?: number;

  @IsOptional() @IsInt() @Min(0)
  maxRespondents?: number;

  @IsOptional() @IsInt() @Min(0)
  maxLeaders?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  optionalModules?: string[];

  @IsOptional() @IsString() @MaxLength(160)
  responsible?: string | null;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string | null;
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
