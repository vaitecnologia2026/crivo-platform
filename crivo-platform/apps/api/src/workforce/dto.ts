import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  INSIGHT_ORIGINS,
  WORK_CONFIDENCES,
  WORK_CRITICALITIES,
  WORK_DECISIONS,
  WORK_PILOT_KINDS,
  WORK_PILOT_STATUSES,
  WORK_RISKS,
  WORK_VALIDATION_RESULTS,
  WORKFORCE_SCENARIOS,
  type InsightOrigin,
  type WorkConfidence,
  type WorkCriticality,
  type WorkDecision,
  type WorkPilotKind,
  type WorkPilotStatus,
  type WorkRisk,
  type WorkValidationResult,
  type WorkforceScenario,
} from '@crivo/types';

/** Processo mapeado. O limiar de cobertura de IA é da empresa (0-100). */
export class UpsertWorkProcessDto {
  @IsString() @MinLength(2) @MaxLength(200)
  name!: string;

  @IsString() @MinLength(1) @MaxLength(120)
  area!: string;

  @IsOptional() @IsUUID()
  unitId?: string | null;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  aiThresholdPct?: number;
}

/** Tarefa do trabalho real. Percentuais são julgamentos informados (0-100). */
export class UpsertWorkTaskDto {
  @IsUUID()
  processId!: string;

  @IsString() @MinLength(1) @MaxLength(160)
  role!: string;

  @IsString() @MinLength(1) @MaxLength(120)
  area!: string;

  @IsString() @MinLength(2) @MaxLength(300)
  name!: string;

  @IsString() @MaxLength(1000)
  input!: string;

  @IsString() @MaxLength(1000)
  output!: string;

  @IsInt() @Min(0)
  volumePerMonth!: number;

  @IsInt() @Min(0)
  durationMin!: number;

  @IsIn([...WORK_CRITICALITIES])
  criticality!: WorkCriticality;

  @IsInt() @Min(0) @Max(100)
  aiPotential!: number;

  @IsInt() @Min(0) @Max(100)
  humanEssentiality!: number;

  @IsIn([...WORK_RISKS])
  risk!: WorkRisk;

  @IsInt() @Min(0) @Max(100)
  readiness!: number;

  @IsIn([...WORKFORCE_SCENARIOS])
  scenario!: WorkforceScenario;

  // Narrativas de transição (aba "Cenários Pessoa × Processo × IA") — texto
  // livre opcional, complementam `scenario` sem substituí-lo.
  @IsOptional() @IsString() @MaxLength(2000)
  scenarioCurrent?: string | null;

  @IsOptional() @IsString() @MaxLength(2000)
  scenarioAssisted?: string | null;

  @IsOptional() @IsString() @MaxLength(2000)
  scenarioRedesigned?: string | null;

  @IsIn([...INSIGHT_ORIGINS])
  origin!: InsightOrigin;

  // Só RASCUNHO ↔ EM_VALIDACAO_CRIVO por aqui; VALIDADO_CRIVO nasce da
  // validação CRIVO e DECIDIDO da decisão do cliente — nunca de uma edição.
  @IsOptional() @IsIn(['RASCUNHO', 'EM_VALIDACAO_CRIVO'])
  stage?: 'RASCUNHO' | 'EM_VALIDACAO_CRIVO';
}

/** Decisão humana do cliente. A nota é opcional (o protótipo decide com um clique). */
export class DecideWorkTaskDto {
  @IsIn([...WORK_DECISIONS])
  decision!: WorkDecision;

  @IsOptional() @IsString() @MaxLength(2000)
  note?: string | null;
}

/** Validação CRIVO (Super Admin). A nota é OBRIGATÓRIA (validada aqui e no service). */
export class ValidateWorkTaskDto {
  @IsOptional() @IsIn([...WORK_VALIDATION_RESULTS])
  result?: WorkValidationResult;

  @IsString() @MinLength(1) @MaxLength(2000)
  note!: string;
}

export class WorkSkillInputDto {
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @IsInt() @Min(0) @Max(100)
  current!: number;

  @IsInt() @Min(0) @Max(100)
  target!: number;
}

/** PUT skills: o conjunto inteiro (quem não vier é removido). */
export class SaveWorkSkillsDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => WorkSkillInputDto)
  skills!: WorkSkillInputDto[];
}

export class UpsertWorkPilotDto {
  @IsOptional() @IsUUID()
  processId?: string | null;

  @IsIn([...WORK_PILOT_KINDS])
  kind!: WorkPilotKind;

  @IsString() @MinLength(2) @MaxLength(200)
  name!: string;

  @IsString() @MaxLength(500)
  baseline!: string;

  @IsString() @MaxLength(500)
  indicator!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  result?: string;

  @IsIn([...WORK_CONFIDENCES])
  confidence!: WorkConfidence;

  @IsOptional() @IsIn([...WORK_PILOT_STATUSES])
  status?: WorkPilotStatus;
}

export class UpdateWorkPilotDto {
  @IsOptional() @IsUUID()
  processId?: string | null;

  @IsOptional() @IsIn([...WORK_PILOT_KINDS])
  kind?: WorkPilotKind;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(500)
  baseline?: string;

  @IsOptional() @IsString() @MaxLength(500)
  indicator?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  result?: string;

  @IsOptional() @IsIn([...WORK_CONFIDENCES])
  confidence?: WorkConfidence;

  @IsOptional() @IsIn([...WORK_PILOT_STATUSES])
  status?: WorkPilotStatus;
}
