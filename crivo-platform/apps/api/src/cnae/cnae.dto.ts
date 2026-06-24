import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { CnaeRiskLevel, DiagnosticMethod } from '@crivo/db';

export class ConsultCnpjDto {
  @IsString() @MaxLength(20)
  cnpj!: string;
}

/** Dados de entrada do motor (empresa + sinais operacionais do consultor). */
export class EvaluateCnaeDto {
  @IsOptional() @IsUUID()
  companyId?: string;

  @IsOptional() @IsString() @MaxLength(20)
  cnpj?: string;

  @IsOptional() @IsString() @MaxLength(200)
  razaoSocial?: string;

  @IsOptional() @IsString() @MaxLength(200)
  nomeFantasia?: string;

  @IsOptional() @IsString() @MaxLength(20)
  cnaePrincipalCodigo?: string;

  @IsOptional() @IsString() @MaxLength(300)
  cnaePrincipalDescricao?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  cnaesSecundarios?: string[];

  @IsOptional() @IsString() @MaxLength(60)
  situacaoCadastral?: string;

  @IsOptional() @IsString() @MaxLength(60)
  porte?: string;

  @IsOptional() @IsInt() @Min(0)
  numeroColaboradores?: number;

  @IsOptional() @IsBoolean() possuiMultiplasUnidades?: boolean;
  @IsOptional() @IsBoolean() possuiEquipeOperacional?: boolean;
  @IsOptional() @IsBoolean() possuiTurnos?: boolean;
  @IsOptional() @IsBoolean() possuiAtendimentoPublico?: boolean;
  @IsOptional() @IsBoolean() possuiTrabalhoExterno?: boolean;
  @IsOptional() @IsBoolean() possuiMetasComerciaisIntensas?: boolean;
  @IsOptional() @IsBoolean() possuiHistoricoAfastamentos?: boolean;
  @IsOptional() @IsBoolean() demandaNr1Completa?: boolean;

  @IsOptional() @IsString() @MaxLength(2000)
  observacoesDoConsultor?: string;
}

/** Edição de uma regra de divisão CNAE pelo administrador/especialista. */
export class UpdateCnaeDivisionDto {
  @IsOptional() @IsString() @MaxLength(200)
  officialName?: string;

  @IsOptional() @IsString() @MaxLength(4)
  cnaeSection?: string;

  @IsOptional() @IsEnum(CnaeRiskLevel)
  preliminaryRiskLevel?: CnaeRiskLevel;

  @IsOptional() @IsEnum(DiagnosticMethod)
  defaultMethod?: DiagnosticMethod;

  @IsOptional() @IsString() @MaxLength(500)
  defaultTechnicalOutput?: string;

  @IsOptional() @IsBoolean() pgrRequired?: boolean;
  @IsOptional() @IsBoolean() riskInventoryRequired?: boolean;
  @IsOptional() @IsBoolean() aepRequired?: boolean;
  @IsOptional() @IsBoolean() evidenceRequired?: boolean;
  @IsOptional() @IsBoolean() executiveReportRequired?: boolean;
  @IsOptional() @IsBoolean() actionPlanRequired?: boolean;

  @IsOptional() @IsArray() @IsString({ each: true })
  organizationalTriggerRules?: string[];

  @IsOptional() @IsString() @MaxLength(1000)
  technicalObservation?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class ReviewDecisionDto {
  @IsOptional() @IsString() @MaxLength(2000)
  reviewNotes?: string;
}
