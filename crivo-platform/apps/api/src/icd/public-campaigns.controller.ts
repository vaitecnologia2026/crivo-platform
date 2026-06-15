import { Controller, Get, Param } from '@nestjs/common';
import { IcdService } from './icd.service';

/**
 * Endpoint PÚBLICO (Portal §7) — sem AuthGuard. Resolve um slug de campanha
 * para a info necessária para o respondente acessar via link sem login.
 * Não expõe estatísticas internas (ICD médio, respondentes) — só o que faz
 * sentido para o convidado: nome, descrição, setor, status e empresa.
 */
@Controller('public/campaigns')
export class PublicCampaignsController {
  constructor(private readonly icd: IcdService) {}

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.icd.getPublicBySlug(slug);
  }
}
