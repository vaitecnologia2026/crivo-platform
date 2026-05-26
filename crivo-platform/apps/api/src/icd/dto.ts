import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested, ArrayMinSize } from 'class-validator';

export class IcdAnswerDto {
  @IsInt()
  questionId!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  value!: number;
}

export class SubmitIcdDto {
  @IsUUID()
  leaderId!: string;

  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsArray()
  @ArrayMinSize(10)
  @ValidateNested({ each: true })
  @Type(() => IcdAnswerDto)
  answers!: IcdAnswerDto[];
}
