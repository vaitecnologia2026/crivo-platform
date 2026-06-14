import { IsArray, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EssentialRecordKind } from '@crivo/db';

class AnswerDto {
  @IsInt() questionId!: number;
  @IsInt() @Min(1) value!: number;
}

export class SubmitSelfAssessmentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}

export class CreateEssentialRecordDto {
  @IsEnum(EssentialRecordKind)
  kind!: EssentialRecordKind;

  @IsString() @MaxLength(200)
  title!: string;

  @IsOptional() @IsString()
  recordDate?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  participants?: string;

  @IsOptional() @IsString() @MaxLength(4000)
  notes?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  points?: string;
}
