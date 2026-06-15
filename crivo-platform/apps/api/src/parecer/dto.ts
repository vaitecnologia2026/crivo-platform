import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Autoria do Parecer Consultivo (Briefing §6). Todos os campos opcionais no
 *  upsert: o consultor preenche aos poucos antes de publicar. */
export class UpsertParecerDto {
  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(4000)
  context?: string | null;

  @IsOptional() @IsString() @MaxLength(4000)
  signals?: string | null;

  @IsOptional() @IsString() @MaxLength(4000)
  hypotheses?: string | null;

  @IsOptional() @IsString() @MaxLength(4000)
  priorities?: string | null;

  @IsOptional() @IsString() @MaxLength(4000)
  recommendations?: string | null;

  @IsOptional() @IsString()
  devolutivaAt?: string | null;
}
