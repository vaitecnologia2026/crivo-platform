import { BadRequestException, Injectable } from '@nestjs/common';
import type { EbookAssetSummary } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from './audit.service';

/**
 * PDF estático publicado na LP — é para onde a rota pública redireciona
 * enquanto NENHUM e-book foi importado.
 *
 * É uma CONSTANTE de propósito, e não `process.env.EBOOK_URL`: assim que o
 * operador apontar EBOOK_URL para a rota pública (que é o objetivo — fazer o
 * site disparar o arquivo importado), ler a env aqui faria a rota redirecionar
 * para si mesma, em laço infinito.
 */
export const EBOOK_FALLBACK_URL = 'https://crivolegacy.com.br/ebook-crivo.pdf';

/**
 * Endereço público e estável do e-book. É este link que vai no texto do
 * WhatsApp e é dele que o site baixa o PDF para anexar no e-mail.
 *
 * Deriva de PORTAL_URL porque o nginx já publica `/api/` do domínio do portal
 * apontando para a API — não exige nenhuma variável de ambiente nova.
 */
export function ebookPublicUrl(): string {
  const base = (process.env.PORTAL_URL ?? 'https://app.crivolegacy.com.br').replace(/\/+$/, '');
  return `${base}/api/public/ebook`;
}

/** base64 de 8 MiB — mesmo teto do modelo de contrato (integrations.service). */
const MAX_BASE64 = 11_184_812;

/** Tipos aceitos na importação. PDF é o formato do e-book publicado hoje. */
const ALLOWED_MIME = ['application/pdf'];

/**
 * E-book complementar disparado ao lead (Governança · E-book).
 *
 * Guarda UM único arquivo: importar de novo substitui o anterior. Enquanto nada
 * foi importado, o sistema segue usando o PDF estático da LP — nenhum disparo
 * muda de comportamento só porque a tabela passou a existir.
 */
@Injectable()
export class EbookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** O e-book corrente SEM o conteúdo do arquivo (para a tela do painel). */
  async current(): Promise<EbookAssetSummary | null> {
    const row = await this.prisma.admin.ebookAsset.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return row ? this.toSummary(row) : null;
  }

  /** O e-book corrente COM os bytes — usado pela rota pública e pelo e-mail. */
  async currentFile(): Promise<{ fileName: string; mimeType: string; data: Buffer } | null> {
    const row = await this.prisma.admin.ebookAsset.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    if (!row) return null;
    return {
      fileName: row.fileName,
      mimeType: row.mimeType,
      data: Buffer.from(row.data, 'base64'),
    };
  }

  /**
   * Importa (ou SUBSTITUI) o e-book. A troca acontece dentro de uma transação:
   * ou o arquivo novo entra e o antigo sai, ou nada muda — nunca fica sem
   * e-book por causa de uma falha no meio do caminho.
   */
  async upload(
    dto: { name: string; fileName: string; mimeType: string; data: string },
    actor: AuditActor,
  ): Promise<EbookAssetSummary> {
    if (!dto.data) throw new BadRequestException('Arquivo vazio.');
    // Cap SERVER-side: o limite do navegador é contornável, e sem este teto um
    // payload gigante viraria linha permanente no Postgres.
    if (dto.data.length > MAX_BASE64) throw new BadRequestException('Arquivo excede 8 MB.');
    if (!ALLOWED_MIME.includes(dto.mimeType)) {
      throw new BadRequestException('Formato não aceito. Envie o e-book em PDF.');
    }
    // Tamanho real do arquivo a partir do base64 (o painel mostra este número).
    const sizeBytes = Buffer.from(dto.data, 'base64').length;
    if (sizeBytes === 0) throw new BadRequestException('Arquivo vazio.');

    const saved = await this.prisma.admin.$transaction(async (tx) => {
      await tx.ebookAsset.deleteMany({});
      return tx.ebookAsset.create({
        data: {
          name: dto.name,
          fileName: dto.fileName,
          mimeType: dto.mimeType,
          sizeBytes,
          data: dto.data,
        },
        select: {
          id: true,
          name: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    await this.audit.record({
      action: 'ebook.import',
      actor,
      target: dto.fileName,
      meta: { name: dto.name, sizeBytes, mimeType: dto.mimeType },
    });

    return this.toSummary(saved);
  }

  private toSummary(row: {
    id: string;
    name: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
    updatedAt: Date;
  }): EbookAssetSummary {
    return {
      id: row.id,
      name: row.name,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      publicUrl: ebookPublicUrl(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
