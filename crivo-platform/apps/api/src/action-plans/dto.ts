import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ActionStatus } from '@crivo/db';
import { RISK_LEVELS_3, INVENTORY_RISK_LEVELS } from '@crivo/types';

export class CreateActionPlanDto {
  @IsString() @MaxLength(200)
  title!: string;

  @IsOptional() @IsString() @MaxLength(60)
  source?: string;
}

export class CreateActionItemDto {
  @IsString() @MaxLength(500)
  point!: string;

  @IsString() @MaxLength(1000)
  action!: string;

  @IsOptional() @IsString() @MaxLength(60)
  origin?: string;

  @IsOptional() @IsString() @MaxLength(160)
  responsible?: string;

  @IsOptional() @IsString()
  dueDate?: string | null;

  @IsOptional() @IsString() @MaxLength(300)
  expectedEvidence?: string;

  @IsOptional() @IsString() @MaxLength(200)
  exposedGroup?: string;

  @IsOptional() @IsIn(RISK_LEVELS_3 as unknown as string[])
  severity?: string;

  @IsOptional() @IsIn(RISK_LEVELS_3 as unknown as string[])
  probability?: string;

  @IsOptional() @IsIn(INVENTORY_RISK_LEVELS as unknown as string[])
  riskLevel?: string;
}

export class UpdateActionItemDto {
  @IsOptional() @IsString() @MaxLength(500)
  point?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  action?: string;

  @IsOptional() @IsString() @MaxLength(60)
  origin?: string;

  @IsOptional() @IsString() @MaxLength(160)
  responsible?: string;

  @IsOptional() @IsString()
  dueDate?: string | null;

  @IsOptional() @IsEnum(ActionStatus)
  status?: ActionStatus;

  @IsOptional() @IsString() @MaxLength(300)
  expectedEvidence?: string;

  @IsOptional() @IsString()
  reviewDate?: string | null;

  @IsOptional() @IsString() @MaxLength(200)
  exposedGroup?: string;

  @IsOptional() @IsIn(RISK_LEVELS_3 as unknown as string[])
  severity?: string;

  @IsOptional() @IsIn(RISK_LEVELS_3 as unknown as string[])
  probability?: string;

  @IsOptional() @IsIn(INVENTORY_RISK_LEVELS as unknown as string[])
  riskLevel?: string;
}

export class CreateEvidenceDto {
  @IsString() @MaxLength(40)
  kind!: string;

  @IsString() @MaxLength(200)
  title!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  url?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}
