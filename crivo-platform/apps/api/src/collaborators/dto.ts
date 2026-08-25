import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PSYCHOSOCIAL_QUESTIONS } from '@crivo/types';

/** Campos comuns do cadastro (CPF é validado no service com isValidCpf). */
export class CreateCollaboratorDto {
  @IsString() @MaxLength(160)
  name!: string;

  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(120)
  sector?: string;

  @IsOptional() @IsString() @MaxLength(160)
  email?: string;

  @IsString() @MaxLength(20)
  cpf!: string;
}

export class UpdateCollaboratorDto {
  @IsOptional() @IsString() @MaxLength(160)
  name?: string;

  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(120)
  sector?: string;

  @IsOptional() @IsString() @MaxLength(160)
  email?: string;

  @IsOptional() @IsString() @MaxLength(20)
  cpf?: string;
}

/** Importação em lote (CSV já parseado no front). */
export class ImportCollaboratorsDto {
  @IsArray() @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => CreateCollaboratorDto)
  rows!: CreateCollaboratorDto[];
}

/** Gate de CPF no acesso ao link público. */
export class VerifyCpfDto {
  @IsString() @MaxLength(20)
  cpf!: string;
}

class CollaboratorAnswerDto {
  @IsInt()
  questionId!: number;

  @IsInt() @Min(1) @Max(5)
  value!: number;
}

/** Submissão pelo link do colaborador — CPF revalidado + respostas. O SETOR NÃO
 *  vem do cliente: é fixado a partir do cadastro (evita divergência e mantém a
 *  agregação por setor confiável). */
export class SubmitByTokenDto {
  @IsString() @MaxLength(20)
  cpf!: string;

  @IsArray() @ArrayMaxSize(PSYCHOSOCIAL_QUESTIONS.length) @ValidateNested({ each: true }) @Type(() => CollaboratorAnswerDto)
  answers!: CollaboratorAnswerDto[];
}
