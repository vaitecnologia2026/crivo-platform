import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PsychosocialAnswerDto {
  @IsInt()
  questionId!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  value!: number;
}

export class SubmitPsychosocialDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sector?: string;

  @IsArray()
  // Teto de sanidade, NÃO o tamanho do questionário: o número de perguntas vem
  // da metodologia publicada no Motor. Com o limite amarrado ao questionário
  // EMBUTIDO (12), o Organizacional de 40 perguntas era recusado com 400 —
  // ninguém conseguia enviar resposta. Mesmo teto do motor de diagnósticos.
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PsychosocialAnswerDto)
  answers!: PsychosocialAnswerDto[];
}
