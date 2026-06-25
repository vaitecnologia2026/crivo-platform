import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsNumber,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class PeoplePeriodDto {
  @IsString() @MaxLength(20)
  period!: string;

  @IsOptional() @IsNumber()
  headcount?: number | null;

  @IsObject()
  values!: Record<string, number | null>;
}

export class SavePeopleAnalyticsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => PeoplePeriodDto)
  periods!: PeoplePeriodDto[];
}

export class AnalyzePeopleDto {
  @IsOptional() @IsString() @MaxLength(3000)
  context?: string;
}
