import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class DimensionDto {
  @IsString() @MaxLength(80)
  slug!: string;

  @IsString() @MaxLength(160)
  label!: string;

  @IsOptional() @IsNumber() @Min(0)
  weight?: number;

  @IsOptional() @IsString() @MaxLength(80)
  parentSlug?: string | null;

  @IsOptional() @IsIn(['MEDIA_PONDERADA', 'MEDIA_SIMPLES', 'SOMA_NORMALIZADA'])
  aggregation?: 'MEDIA_PONDERADA' | 'MEDIA_SIMPLES' | 'SOMA_NORMALIZADA' | null;

  // Severidade (1–5) da Matriz de Risco psicossocial. Só faz sentido na ESCALA
  // (dimensão de topo). null/ausente = escala fora da matriz — ver o comentário
  // da coluna no schema. Não entra em nenhum cálculo de média ou pontuação.
  @IsOptional() @IsInt() @Min(1) @Max(5)
  severity?: number | null;
}

/** Fator de risco (Orientação NR-1 §8): a severidade pertence ao FATOR e às suas
 *  possíveis consequências. `dimensionSlug` diz de onde vem a PROBABILIDADE. */
class FactorDto {
  @IsString() @MaxLength(80)
  slug!: string;

  @IsString() @MaxLength(160)
  label!: string;

  @IsInt() @Min(1) @Max(5)
  severity!: number;

  @IsOptional() @IsString() @MaxLength(600)
  consequences?: string | null;

  @IsOptional() @IsString() @MaxLength(80)
  dimensionSlug?: string | null;

  // Biblioteca de Riscos/Fatores — Orientação Funcional 5.1.
  @IsOptional() @IsString() @MaxLength(40)
  code?: string | null;

  @IsOptional() @IsString() @MaxLength(600)
  definition?: string | null;

  @IsOptional() @IsString() @MaxLength(600)
  sourceContext?: string | null;

  @IsOptional() @IsString() @MaxLength(20)
  status?: string | null;

  @IsOptional() @IsString() @MaxLength(40)
  factorVersion?: string | null;
}

class QuestionDto {
  @IsString() @MaxLength(80)
  dimensionSlug!: string;

  /** Fatores que a pergunta alimenta (NR-1 §9). Vazio = fora da matriz de risco. */
  @IsOptional() @IsArray() @IsString({ each: true })
  factorSlugs?: string[];

  @IsString() @MaxLength(600)
  text!: string;

  @IsOptional() @IsNumber() @Min(0)
  weight?: number;

  @IsOptional() @IsBoolean()
  inverse?: boolean;

  @IsOptional() @IsBoolean()
  required?: boolean;

  // Motor v3.1 — item de CONTEXTO (coletado, fora do cálculo).
  @IsOptional() @IsBoolean()
  scored?: boolean;

  // Motor v3.1 — exibição CONDICIONAL (`show_when`): questionId 1-based.
  @IsOptional() @IsInt() @Min(1)
  showWhenQuestionId?: number | null;

  @IsOptional() @IsIn(['>=', '>', '<=', '<', '==', '!='])
  showWhenOperator?: string | null;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  showWhenValue?: number | null;
}

class BandDto {
  @IsIn(['MATURITY', 'RISK'])
  kind!: 'MATURITY' | 'RISK';

  @IsString() @MaxLength(40)
  code!: string;

  @IsString() @MaxLength(80)
  label!: string;

  // Motor v3.1: limites de faixa aceitam DECIMAL — as `illustrative_bands` dos
  // Anexos D/E são 0–24.9 / 25–49.9 / 50–74.9 / 75–100. Exigir inteiro aqui
  // impedia cadastrar a régua oficial (achado da verificação E2E em prod).
  @IsNumber() @Min(0) @Max(100)
  min!: number;

  @IsNumber() @Min(0) @Max(100)
  max!: number;

  @IsOptional() @IsString() @MaxLength(20)
  color?: string;
}

export class UpdateMethodologyDto {
  @IsOptional() @IsString() @MaxLength(120)
  label?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  scaleLabels?: string[];

  // Motor v3.1: precisão do resultado e cobertura mínima para liberar o oficial.
  @IsOptional() @IsInt() @Min(0) @Max(3)
  rounding?: number;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  minValidCompletionPercent?: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DimensionDto)
  dimensions?: DimensionDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FactorDto)
  factors?: FactorDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => QuestionDto)
  questions?: QuestionDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BandDto)
  bands?: BandDto[];
}

/** Só a COR de cada faixa, por id — para editar a versão ATIVA sem republicar
 *  (cor é apresentação, não altera min/max/pontuação). */
class BandColorDto {
  @IsString() @MaxLength(64)
  id!: string;

  @IsString() @MaxLength(20)
  color!: string;
}

export class UpdateBandColorsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => BandColorDto)
  bands!: BandColorDto[];
}
