import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { LIBRARY_KINDS, type LibraryKind } from '@crivo/types';

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
}
