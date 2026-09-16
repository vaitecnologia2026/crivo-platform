import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { INVISIBLE_COST_NATURES } from '@crivo/types';

const CONFIDENCES = ['ALTA', 'MEDIA', 'BAIXA'];

class CostItemDto {
  @IsString() @MaxLength(40)
  key!: string;

  @IsString() @MaxLength(120)
  label!: string;

  @IsOptional() @IsString() @MaxLength(120)
  indicator?: string;

  @IsNumber()
  variation!: number;

  @IsNumber()
  volume!: number;

  @IsNumber()
  unitCost!: number;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;

  // ── Governança por componente (ficha do protótipo). Só metadados: o
  // cálculo (computeInvisibleCosts) continua lendo variação × volume × custo.
  @IsOptional() @IsIn(INVISIBLE_COST_NATURES as unknown as string[])
  nature?: string;

  @IsOptional() @IsString() @MaxLength(160)
  source?: string;

  @IsOptional() @IsString() @MaxLength(400)
  formula?: string;

  @IsOptional() @IsString() @MaxLength(60)
  period?: string;

  @IsOptional() @IsString() @MaxLength(120)
  owner?: string;

  @IsOptional() @IsString() @MaxLength(20)
  version?: string;

  /** Data ISO curta (AAAA-MM-DD) — é o que o input type=date manda. */
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'validatedAt deve ser AAAA-MM-DD' })
  validatedAt?: string;

  @IsOptional() @IsIn(CONFIDENCES)
  confidence?: string;
}

class ScenariosDto {
  @IsNumber() @Min(0)
  conservador!: number;

  @IsNumber() @Min(0)
  moderado!: number;

  @IsNumber() @Min(0)
  otimista!: number;
}

export class SaveInvisibleCostsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => CostItemDto)
  items!: CostItemDto[];

  @ValidateNested() @Type(() => ScenariosDto)
  scenarios!: ScenariosDto;

  @IsOptional() @IsIn(CONFIDENCES)
  confidence?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}

/** "Congelar como ciclo": só o rótulo — itens/cenários/totais vêm da
 *  estimativa SALVA do tenant, nunca do corpo (evita histórico inventado). */
export class CreateCostSnapshotDto {
  @IsString() @MinLength(1) @MaxLength(60)
  label!: string;
}
