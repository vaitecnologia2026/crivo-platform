import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

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
  @ArrayMinSize(8) // ICD = 8 perguntas (4 Rs)
  @ValidateNested({ each: true })
  @Type(() => IcdAnswerDto)
  answers!: IcdAnswerDto[];
}

// ── Campanhas editáveis (Portal §7) ─────────────────────────────────────

export class CreateCampaignDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  sector?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsDateString()
  reminderAt?: string;

  @IsOptional()
  @IsBoolean()
  generatePublicLink?: boolean;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  sector?: string | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsDateString()
  reminderAt?: string | null;

  @IsOptional()
  @IsBoolean()
  regeneratePublicLink?: boolean;

  @IsOptional()
  @IsBoolean()
  clearPublicLink?: boolean;
}

export class ListCampaignsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sector?: string;
}
