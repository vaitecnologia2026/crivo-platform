import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IcdService } from './icd.service';
import { SubmitPsychosocialDto } from '../psychosocial/dto';

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
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  getBySlug(@Param('slug') slug: string) {
    return this.icd.getPublicBySlug(slug);
  }

  /**
   * Submissão ANÔNIMA pela campanha — a peça que faltava para o link público
   * cumprir o que a caixa "respondentes acessam sem login" promete. Mesmo limite
   * de taxa do /q/<slug>: leitura é barata, escrita não.
   */
  @Post(':slug')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  submit(@Param('slug') slug: string, @Body() dto: SubmitPsychosocialDto) {
    return this.icd.submitPublicByCampaignSlug(slug, dto);
  }
}
