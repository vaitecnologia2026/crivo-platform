import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
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

  @IsOptional() @IsArray() @IsString({ each: true })
  coreModules?: string[];

  // Enquadramento comercial da solução (Tela 03 — Incluir).
  @IsOptional() @IsBoolean() appearsOnLp?: boolean;
  @IsOptional() @IsBoolean() sellableStandalone?: boolean;
  @IsOptional() @IsBoolean() canBeAddon?: boolean;
  @IsOptional() @IsBoolean() allowsAi?: boolean;
  @IsOptional() @IsBoolean() allowsCustomAi?: boolean;

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(50)
  allowedAddons?: string[];

  // Instrumento de diagnóstico e config de IA: JSON livre (shape validado no service).
  @IsOptional() @IsObject()
  diagnostic?: Record<string, unknown> | null;

  @IsOptional() @IsObject()
  aiConfig?: Record<string, unknown> | null;

  @IsOptional() @IsBoolean()
  isLeadCapture?: boolean;

  @IsOptional() @IsEnum(DiagnosticMethod)
  method?: DiagnosticMethod | null;

  @IsOptional() @IsArray() @IsEnum(TechnicalOutput, { each: true })
  supportedOutputs?: TechnicalOutput[];
}

// ── CRM do super admin ──

export class SetLeadStageDto {
  @IsEnum(PlatformLeadStage)
  stage!: PlatformLeadStage;

  // Motivo de perda — só aplicado quando stage === 'PERDIDO' (validado no service).
  @IsOptional() @IsString() @MaxLength(60)
  lostReason?: string;
}

export class SetLeadNotesDto {
  @IsString() @MaxLength(4000)
  notes!: string;
}

export class SetLeadOriginDto {
  // Origem/canal — canônica (ITZ, EVENTO…) ou legada; string livre.
  @IsString() @MaxLength(60)
  origin!: string;
}

export class SetLeadInterestDto {
  // Solução de interesse — id de produto; null/omitido limpa.
  @IsOptional() @IsUUID()
  interestProductId?: string | null;
}

export class SetLeadNextActionDto {
  // Follow-up — data (ISO) e/ou nota; ambos opcionais/limpáveis.
  @IsOptional() @IsDateString()
  nextActionAt?: string | null;

  @IsOptional() @IsString() @MaxLength(240)
  nextActionNote?: string | null;
}

export class SetLeadCommercialDto {
  // Responsável comercial (CRIVO) pelo lead.
  @IsOptional() @IsString() @MaxLength(120)
  commercialOwner?: string | null;

  // Valor proposto em centavos.
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000)
  proposedValueCents?: number | null;

  // Quando a proposta foi enviada (ISO).
  @IsOptional() @IsDateString()
  proposalSentAt?: string | null;

  // Adicionais/módulos potenciais (códigos do catálogo).
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(40, { each: true })
  potentialAddons?: string[];
}

export class ConvertLeadDto {
  @IsString()
  productId!: string;
}

/** Cria um lead a partir de uma consulta de CNPJ (Dashboard). productId opcional → já converte. */
export class CreateLeadFromCnpjDto {
  @IsString() @MaxLength(20)
  cnpj!: string;

  @IsOptional() @IsInt() @Min(0)
  numeroColaboradores?: number;

  @IsOptional() @IsString() @MaxLength(160)
  name?: string;

  @IsOptional() @IsString() @MaxLength(200)
  email?: string;

  @IsOptional() @IsString()
  productId?: string;
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
  @IsInt() @Min(1) @Max(200)
  questionId!: number;

  @IsInt() @Min(1) @Max(5)
  value!: number;
}

// Lead da LP SEM diagnóstico (formulários de contato / e-book). Cai direto no
// funil do CRM (platform_leads) como NOVO. Espelha CreateDiagnosticLeadDto, sem answers.
export class CreateSimpleLeadDto {
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

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;
}

export class CreateDiagnosticLeadDto {
  @IsString() @MaxLength(160)
  name!: string;

  @IsOptional() @IsString() @MaxLength(20)
  cnpj?: string;

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

  @IsOptional() @IsString() @MaxLength(120)
  role?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  challenges?: string[];

  @IsOptional() @IsString() @MaxLength(200)
  challengeOther?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DiagnosticAnswerDto)
  answers!: DiagnosticAnswerDto[];
}
