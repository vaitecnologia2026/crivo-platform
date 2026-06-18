import {
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
  @ValidateNested({ each: true })
  @Type(() => PsychosocialAnswerDto)
  answers!: PsychosocialAnswerDto[];
}
