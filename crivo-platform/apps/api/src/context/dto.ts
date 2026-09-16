import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import {
  TENANT_DIRECTIVE_STATUSES,
  TENANT_DOCUMENT_STATUSES,
  type TenantDirectiveStatus,
  type TenantDocumentStatus,
} from '@crivo/types';

/** Formulário "Nova diretriz" / edição. */
export class UpsertTenantDirectiveDto {
  @IsString() @MinLength(2) @MaxLength(160)
  title!: string;

  @IsString() @MinLength(2) @MaxLength(8000)
  text!: string;
}

/** Transição de status da diretriz; a justificativa só é exigida ao revogar (regra no service). */
export class ChangeTenantDirectiveStatusDto {
  @IsIn([...TENANT_DIRECTIVE_STATUSES])
  status!: TenantDirectiveStatus;

  @IsOptional() @IsString() @MaxLength(2000)
  justification?: string | null;
}

/** Transição de status do documento (Rascunho ↔ Em revisão → Aprovado/Publicado). */
export class ChangeTenantDocumentStatusDto {
  @IsIn([...TENANT_DOCUMENT_STATUSES])
  status!: TenantDocumentStatus;

  @IsOptional() @IsString() @MaxLength(2000)
  justification?: string | null;
}

/** Revogação — justificativa obrigatória (o service recusa vazio/só espaço). */
export class RevokeTenantDocumentDto {
  @IsString() @MaxLength(2000)
  justification!: string;
}

/** Terminologia e regras do cliente. */
export class UpsertTenantTermDto {
  @IsString() @MinLength(1) @MaxLength(120)
  term!: string;

  @IsString() @MinLength(1) @MaxLength(2000)
  definition!: string;

  @IsString() @MinLength(1) @MaxLength(200)
  context!: string;
}

/** PUT /context/ai-use-cases/:useCase — documentos permitidos + toggle. */
export class UpdateTenantAiUseCaseContextDto {
  @IsArray() @ArrayMaxSize(50) @IsUUID('4', { each: true })
  documentIds!: string[];

  @IsBoolean()
  active!: boolean;
}

// Observação: "Adicionar documento" e "Substituir" chegam como multipart
// (arquivo + campos texto) OU JSON (só `url`). O ValidationPipe não valida
// corpo sem classe, então o service normaliza e valida os campos
// (parseDocumentInput) — uma regra só para os dois formatos.
