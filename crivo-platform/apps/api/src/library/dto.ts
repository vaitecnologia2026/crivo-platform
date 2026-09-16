import { IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { LIBRARY_KINDS, LIBRARY_LEVELS, type LibraryKind, type LibraryLevel } from '@crivo/types';

/** Carga máxima aceita: 100 h (6000 min) — acima disso é erro de digitação. */
export const LIBRARY_MAX_DURATION_MIN = 6000;

export class CreateLibraryItemDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(LIBRARY_KINDS)
  kind!: LibraryKind;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  url?: string;

  /** Carga em minutos (a UI formata "45 min"/"8h"). null limpa. */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt() @Min(1) @Max(LIBRARY_MAX_DURATION_MIN)
  durationMin?: number | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(LIBRARY_LEVELS)
  level?: LibraryLevel | null;
}

export class UpdateLibraryItemDto {
  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsIn(LIBRARY_KINDS)
  kind?: LibraryKind;

  @IsOptional() @IsUrl() @MaxLength(500)
  url?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt() @Min(1) @Max(LIBRARY_MAX_DURATION_MIN)
  durationMin?: number | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(LIBRARY_LEVELS)
  level?: LibraryLevel | null;
}
