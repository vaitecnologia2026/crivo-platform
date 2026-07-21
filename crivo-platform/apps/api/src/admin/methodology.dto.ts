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
}

class QuestionDto {
  @IsString() @MaxLength(80)
  dimensionSlug!: string;

  @IsString() @MaxLength(600)
  text!: string;

  @IsOptional() @IsNumber() @Min(0)
  weight?: number;

  @IsOptional() @IsBoolean()
  inverse?: boolean;

  @IsOptional() @IsBoolean()
  required?: boolean;
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

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DimensionDto)
  dimensions?: DimensionDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => QuestionDto)
  questions?: QuestionDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BandDto)
  bands?: BandDto[];
}
