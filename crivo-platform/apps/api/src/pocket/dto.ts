import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { POCKET_MOMENTS } from '@crivo/types';

export class CreatePocketSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(400)
  context?: string;

  @IsOptional()
  @IsEnum(POCKET_MOMENTS)
  momentOfUse?: (typeof POCKET_MOMENTS)[number];

  /** Vínculo opcional com Decisão registrada (Anexo §8). */
  @IsOptional()
  @IsUUID()
  decisionId?: string;
}

/** Upsert: cada pergunta C1-O2 só pode ter 1 reflexão por sessão (constraint
 *  UNIQUE no banco). Se o líder revisar, atualiza a reflexão anterior. */
export class UpsertReflectionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(3)
  questionCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
