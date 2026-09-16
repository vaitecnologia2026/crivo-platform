import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  AI_DECISIONS,
  AI_INCIDENT_SEVERITIES,
  AI_INCIDENT_STATUSES,
  AI_LINK_KINDS,
  AI_POLICY_STATUSES,
  AI_RISK_LEVELS,
  type AiDecision,
  type AiIncidentSeverity,
  type AiIncidentStatus,
  type AiLinkKind,
  type AiPolicyStatus,
  type AiRiskLevel,
} from '@crivo/types';

/** Cadastro/edição de um caso de uso (formulário "Novo caso" do portal). */
export class UpsertAiUseCaseDto {
  @IsString() @MinLength(2) @MaxLength(200)
  name!: string;

  @IsString() @MinLength(2) @MaxLength(2000)
  purpose!: string;

  @IsString() @MinLength(1) @MaxLength(120)
  area!: string;

  @IsString() @MinLength(2) @MaxLength(160)
  ownerName!: string;

  @IsOptional() @IsUUID()
  ownerUserId?: string | null;

  @IsString() @MinLength(1) @MaxLength(200)
  technology!: string;

  @IsOptional() @IsString() @MaxLength(200)
  vendor?: string | null;

  @IsString() @MinLength(1) @MaxLength(2000)
  dataUsed!: string;

  @IsString() @MinLength(1) @MaxLength(500)
  audience!: string;

  @IsIn([...AI_RISK_LEVELS])
  inherentRisk!: AiRiskLevel;

  @IsIn([...AI_RISK_LEVELS])
  residualRisk!: AiRiskLevel;

  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(200, { each: true })
  controls?: string[];

  @IsOptional() @IsString() @MaxLength(2000)
  justification?: string | null;

  @IsOptional() @IsISO8601()
  nextReviewAt?: string | null;

  // Só RASCUNHO ↔ EM_AVALIACAO por aqui; os demais status nascem de uma
  // decisão humana (POST :id/decision) — nunca de uma edição.
  @IsOptional() @IsIn(['RASCUNHO', 'EM_AVALIACAO'])
  status?: 'RASCUNHO' | 'EM_AVALIACAO';
}

/** Decisão humana. A justificativa é OBRIGATÓRIA (validada aqui e no service). */
export class DecideAiUseCaseDto {
  @IsIn([...AI_DECISIONS])
  decision!: AiDecision;

  @IsString() @MinLength(1) @MaxLength(2000)
  justification!: string;

  @IsOptional() @IsISO8601()
  nextReviewAt?: string | null;
}

export class AddAiUseCaseLinkDto {
  @IsIn([...AI_LINK_KINDS])
  kind!: AiLinkKind;

  @IsUUID()
  targetId!: string;
}

export class CreateAiIncidentDto {
  @IsOptional() @IsUUID()
  useCaseId?: string | null;

  @IsIn([...AI_INCIDENT_SEVERITIES])
  severity!: AiIncidentSeverity;

  @IsISO8601()
  occurredAt!: string;

  @IsString() @MinLength(2) @MaxLength(4000)
  description!: string;
}

export class UpdateAiIncidentDto {
  @IsOptional() @IsIn([...AI_INCIDENT_SEVERITIES])
  severity?: AiIncidentSeverity;

  @IsOptional() @IsISO8601()
  occurredAt?: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(4000)
  description?: string;

  @IsOptional() @IsIn([...AI_INCIDENT_STATUSES])
  status?: AiIncidentStatus;
}

export class CreateAiPolicyDto {
  @IsString() @MinLength(2) @MaxLength(200)
  title!: string;

  @IsString() @MinLength(1) @MaxLength(40)
  version!: string;

  @IsOptional() @IsIn([...AI_POLICY_STATUSES])
  status?: AiPolicyStatus;

  @IsOptional() @IsISO8601()
  publishedAt?: string | null;

  @IsOptional() @IsString() @MaxLength(1000)
  url?: string | null;
}

export class UpdateAiPolicyDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(40)
  version?: string;

  @IsOptional() @IsIn([...AI_POLICY_STATUSES])
  status?: AiPolicyStatus;

  @IsOptional() @IsISO8601()
  publishedAt?: string | null;

  @IsOptional() @IsString() @MaxLength(1000)
  url?: string | null;
}
