import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsNumber,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PEOPLE_CATALOG_CONFIDENCES,
  PEOPLE_CATALOG_NATURES,
  PEOPLE_CATALOG_STATUSES,
} from '@crivo/types';

/** Recorte de headcount por área — opcional por período. A supressão n<5 é
 *  aplicada no RENDER (a empresa pode informar qualquer n; a tela não exibe). */
class HeadcountByAreaDto {
  @IsString() @MaxLength(80)
  area!: string;

  @IsNumber() @Min(0)
  n!: number;
}

class PeoplePeriodDto {
  @IsString() @MaxLength(20)
  period!: string;

  @IsOptional() @IsNumber()
  headcount?: number | null;

  @IsObject()
  values!: Record<string, number | null>;

  @IsOptional() @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => HeadcountByAreaDto)
  headcountByArea?: HeadcountByAreaDto[] | null;
}

export class SavePeopleAnalyticsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => PeoplePeriodDto)
  periods!: PeoplePeriodDto[];
}

export class AnalyzePeopleDto {
  @IsOptional() @IsString() @MaxLength(3000)
  context?: string;
}

/** Entrada do catálogo de indicadores (metadados de governança). A natureza
 *  SCORE_METODOLOGICO passa na validação de forma para ser recusada com
 *  mensagem clara no serviço (read-only: vem do ICD/NR-1). */
export class PeopleCatalogEntryDto {
  @IsString() @MaxLength(40) @Matches(/^[a-z0-9][a-z0-9_-]*$/i, { message: 'key: só letras, números, _ e -' })
  key!: string;

  @IsString() @MaxLength(120)
  name!: string;

  @IsString() @MaxLength(60)
  category!: string;

  @IsOptional() @IsString() @MaxLength(400)
  formula?: string | null;

  @IsOptional() @IsString() @MaxLength(30)
  unit?: string | null;

  @IsOptional() @IsString() @MaxLength(120)
  source?: string | null;

  @IsOptional() @IsString() @MaxLength(60)
  period?: string | null;

  @IsOptional() @IsString() @MaxLength(40)
  frequency?: string | null;

  @IsOptional() @IsString() @MaxLength(120)
  owner?: string | null;

  @IsOptional() @IsString() @MaxLength(20)
  version?: string | null;

  @IsOptional() @IsIn(PEOPLE_CATALOG_CONFIDENCES as unknown as string[])
  confidence?: string | null;

  @IsOptional() @IsString() @MaxLength(160)
  slices?: string | null;

  @IsIn(PEOPLE_CATALOG_STATUSES as unknown as string[])
  status!: string;

  @IsIn(PEOPLE_CATALOG_NATURES as unknown as string[])
  nature!: string;
}

export class SavePeopleCatalogDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => PeopleCatalogEntryDto)
  entries!: PeopleCatalogEntryDto[];
}
