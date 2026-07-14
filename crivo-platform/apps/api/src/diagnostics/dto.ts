import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class DiagnosticAnswerDto {
  @IsInt()
  @Min(1)
  @Max(500)
  questionId!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  value!: number;
}

export class SubmitDiagnosticDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sector?: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DiagnosticAnswerDto)
  answers!: DiagnosticAnswerDto[];
}

export class EnsureDiagnosticLinkDto {
  @IsUUID()
  tenantId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_][A-Za-z0-9_-]{2,39}$/)
  instrumentSlug!: string;
}
