import { Type } from 'class-transformer';
import {
  IsArray,
  IsBooleanString,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  DECISION_IMPACTS,
  DECISION_TYPES,
  DECISION_POCKET_USES,
  DECISION_PRESSURE_FACTORS,
  DECISION_REVISION_PERIODS,
  DECISION_STATUSES,
} from '@crivo/types';

class SustentationActionInput {
  @IsString()
  @MinLength(3)
  @MaxLength(400)
  action!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  responsible!: string;

  @IsDateString()
  deadline!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  expectedResult?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  evidenceUrl?: string;
}

export class CreateDecisionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsEnum(DECISION_IMPACTS)
  impact!: (typeof DECISION_IMPACTS)[number];

  @IsEnum(DECISION_TYPES)
  type!: (typeof DECISION_TYPES)[number];

  @IsEnum(DECISION_POCKET_USES)
  pocketUse!: (typeof DECISION_POCKET_USES)[number];

  @IsEnum(DECISION_PRESSURE_FACTORS)
  pressureFactor!: (typeof DECISION_PRESSURE_FACTORS)[number];

  @IsEnum(DECISION_REVISION_PERIODS)
  revisionPeriod!: (typeof DECISION_REVISION_PERIODS)[number];

  @IsDateString()
  decidedAt!: string;

  @IsArray()
  @IsUUID('all', { each: true })
  audienceIds!: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SustentationActionInput)
  sustentationAction?: SustentationActionInput;
}

/** Update reaproveita o Create — campos opcionais via partial nas rotas. */
export class UpdateDecisionDto extends CreateDecisionDto {
  @IsOptional()
  @IsEnum(DECISION_STATUSES)
  status?: (typeof DECISION_STATUSES)[number];
}

export class ListDecisionsQueryDto {
  @IsOptional()
  @IsEnum(DECISION_STATUSES)
  status?: (typeof DECISION_STATUSES)[number];

  @IsOptional()
  @IsEnum(DECISION_IMPACTS)
  impact?: (typeof DECISION_IMPACTS)[number];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Filtra por intervalo de decidedAt (ISO datetime). */
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  /** ?mine=true filtra ao líder logado (default na Área do Líder). */
  @IsOptional()
  @IsBooleanString()
  mine?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

export class CreateAudienceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

// Anexo ICD §7 — uma resposta a uma afirmação P1-P8.
class IcdAxisAnswerInput {
  /** "P1" .. "P8". */
  @IsString()
  @MinLength(2)
  @MaxLength(3)
  id!: string;

  /** 1–5 (escala de concordância, §8). */
  @IsInt()
  @Min(1)
  @Max(5)
  value!: number;
}

/** Anexo ICD §7 — 8 respostas (P1-P8) à decisão registrada. */
export class SubmitDecisionIcdDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IcdAxisAnswerInput)
  answers!: IcdAxisAnswerInput[];
}
