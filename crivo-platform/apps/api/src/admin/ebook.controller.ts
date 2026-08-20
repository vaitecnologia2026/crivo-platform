import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import type { PlatformAdmin } from '@crivo/types';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { EbookService, EBOOK_FALLBACK_URL } from './ebook.service';

class UploadEbookDto {
  @IsString() @MaxLength(160)
  name!: string;

  @IsString() @MaxLength(240)
  fileName!: string;

  @IsString() @MaxLength(120)
  mimeType!: string;

  @IsString()
  data!: string; // base64 do arquivo
}

/**
 * Governança · E-book — importa o e-book complementar que é disparado ao lead
 * por e-mail (anexo) e WhatsApp (link). Rotas sob /admin/ebook (após o prefixo
 * /api). Super admin only.
 */
@Controller('admin/ebook')
@UseGuards(SuperAdminGuard)
export class EbookController {
  constructor(private readonly svc: EbookService) {}

  /** O e-book corrente (ou null, se nada foi importado ainda). */
  @Get()
  current() {
    return this.svc.current();
  }

  /** Importa o e-book, substituindo o anterior. */
  @Post()
  upload(@Body() dto: UploadEbookDto, @CurrentAdmin() admin: PlatformAdmin) {
    return this.svc.upload(dto, { id: admin.id, email: admin.email });
  }
}

/**
 * Rota PÚBLICA do e-book — é o endereço que vai no texto do WhatsApp do lead e
 * é de onde o site baixa o PDF para anexar no e-mail. Sem guard de propósito:
 * quem abre é o lead, que não tem sessão.
 *
 * Enquanto nenhum e-book foi importado, redireciona para o PDF estático da LP,
 * de modo que o link NUNCA quebra — nem antes da primeira importação, nem se a
 * linha for removida do banco.
 */
@Controller('public')
export class PublicEbookController {
  constructor(private readonly svc: EbookService) {}

  @Get('ebook')
  async download(@Res({ passthrough: true }) res: Response): Promise<StreamableFile | void> {
    const file = await this.svc.currentFile();
    if (!file) {
      res.redirect(302, EBOOK_FALLBACK_URL);
      return;
    }
    res.set({
      'Content-Type': file.mimeType,
      // inline: abre no navegador/WhatsApp em vez de forçar download.
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.fileName)}"`,
      'Content-Length': String(file.data.length),
    });
    return new StreamableFile(file.data);
  }
}
