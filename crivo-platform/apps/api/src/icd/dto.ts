import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
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

class CampaignAnswerDto {
  @IsInt()
  questionId!: number;

  @IsInt() @Min(1) @Max(5)
  value!: number;
}

/**
 * Resposta pela campanha pública (QR/link): agora NOMINAL. O CPF identifica a
 * pessoa no cadastro de colaboradores — antes o link não pedia nada e aceitava
 * resposta repetida, inflando média e o piso de anonimato (que conta PESSOAS).
 */
export class CampaignCpfDto {
  @IsString() @MaxLength(20)
  cpf!: string;
}

/** Envio pela campanha pública: CPF + respostas. */
export class SubmitCampaignDto extends CampaignCpfDto {
  @IsOptional() @IsString() @MaxLength(120)
  sector?: string;

  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => CampaignAnswerDto)
  answers!: CampaignAnswerDto[];
}
