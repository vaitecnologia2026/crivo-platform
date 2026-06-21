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
import { PSYCHOSOCIAL_QUESTIONS } from '@crivo/types';

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
  @ArrayMaxSize(PSYCHOSOCIAL_QUESTIONS.length)
  @ValidateNested({ each: true })
  @Type(() => PsychosocialAnswerDto)
  answers!: PsychosocialAnswerDto[];
}
