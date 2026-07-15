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

  @IsInt() @Min(0) @Max(100)
  min!: number;

  @IsInt() @Min(0) @Max(100)
  max!: number;

  @IsOptional() @IsString() @MaxLength(20)
  color?: string;
}

export class UpdateMethodologyDto {
  @IsOptional() @IsString() @MaxLength(120)
  label?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DimensionDto)
  dimensions?: DimensionDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => QuestionDto)
  questions?: QuestionDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BandDto)
  bands?: BandDto[];
}
