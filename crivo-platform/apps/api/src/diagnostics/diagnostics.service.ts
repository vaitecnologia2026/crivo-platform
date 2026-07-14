import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { MIN_LEADERS_FOR_DISCLOSURE, scoreWithMethodology } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { resolveActiveMethodology } from '../admin/methodology.service';
import { SubmitDiagnosticDto } from './dto';

type Actor = { id: string; email: string };

/** Slug público: base + 8 bytes de entropia (mesmo desenho do psicossocial). */
function makeSlug(base: string): string {
  const b =
    base
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'diagnostico';
  return `${b}-${randomBytes(8).toString('hex')}`;
}

/**
 * Aplicação de diagnósticos do CATÁLOGO (motor dinâmico — call 14/07).
 * Espelha o desenho do psicossocial: link público anônimo por tenant+instrumento
 * (/d/<slug>), pontuação pela metodologia ATIVA (pin MET1), respostas sem
 * identificação e agregação com supressão < MIN_LEADERS_FOR_DISCLOSURE.
 * Diagnósticos dinâmicos NÃO têm fallback hardcoded: sem versão ativa, sem link.
 */
@Injectable()
export class DiagnosticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** O superadm passa Tenant.id; o data-plane usa Organization.id (gotcha
   *  conhecido do control plane). Aceita ambos e resolve para o org id. */
  private async resolveOrgId(id: string): Promise<string> {
    // rls-allow: mapeamento control-plane Tenant.id → Organization.id.
    const tenant = await this.prisma.admin.tenant.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    return tenant?.organizationId ?? id;
  }

  /** Gera (idempotente) o link público de um instrumento para uma empresa. */
  async ensureLink(rawTenantId: string, instrumentSlug: string, _actor: Actor) {
    const tenantId = await this.resolveOrgId(rawTenantId);
    const instrument = await this.prisma.admin.diagnosticInstrument.findUnique({ where: { slug: instrumentSlug } });
    if (!instrument || !instrument.active) throw new BadRequestException('Instrumento inválido ou inativo.');
    const active = await resolveActiveMethodology(this.prisma, instrumentSlug);
    if (!active) {
      throw new BadRequestException('Publique uma versão da metodologia deste diagnóstico antes de gerar o link.');
    }
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.diagnosticLink.findUnique({
        where: { tenantId_instrumentSlug: { tenantId, instrumentSlug } },
      });
      if (existing) {
        if (!existing.active) {
          await tx.diagnosticLink.update({ where: { id: existing.id }, data: { active: true } });
        }
        return { slug: existing.slug };
      }
      const org = await tx.organization.findUnique({ where: { id: tenantId }, select: { name: true } });
      if (!org) throw new NotFoundException('Empresa não encontrada.');
      for (let i = 0; i < 5; i++) {
        const slug = makeSlug(`${instrument.slug}-${org.name}`);
        try {
          await tx.diagnosticLink.create({ data: { tenantId, instrumentSlug, slug } });
          return { slug };
        } catch {
          // colisão de unique — tenta outro sufixo
        }
      }
      throw new BadRequestException('Não foi possível gerar o link. Tente novamente.');
    });
  }

  /** Links de um instrumento (visão do super admin, com nome da empresa). */
  async listLinks(instrumentSlug: string) {
    // rls-allow: leitura do CONTROL PLANE (super admin) — só metadados do link + nome da empresa.
    const links = await this.prisma.admin.diagnosticLink.findMany({
      where: { instrumentSlug },
      include: { org: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const counts = await this.prisma.admin.diagnosticResponse.groupBy({
      by: ['tenantId'],
      where: { instrumentSlug },
      _count: { _all: true },
    });
    const byTenant = new Map(counts.map((c) => [c.tenantId, c._count._all]));
    return links.map((l) => ({
      id: l.id,
      tenantId: l.tenantId,
      tenantName: l.org.name,
      slug: l.slug,
      active: l.active,
      respondents: byTenant.get(l.tenantId) ?? 0,
      createdAt: l.createdAt,
    }));
  }

  /** Resolve slug público → empresa + instrumento + perguntas (sem auth). */
  async getPublicBySlug(slug: string) {
    // rls-allow: endpoint público anônimo (/d/<slug>) — resolve slug→link (select mínimo).
    const link = await this.prisma.admin.diagnosticLink.findUnique({
      where: { slug },
      include: { org: { select: { name: true } }, instrument: true },
    });
    if (!link || !link.active || !link.instrument.active) {
      throw new NotFoundException('Diagnóstico não encontrado ou link inválido.');
    }
    const active = await resolveActiveMethodology(this.prisma, link.instrumentSlug);
    if (!active) throw new NotFoundException('Este diagnóstico ainda não está disponível.');
    return {
      tenantName: link.org.name,
      instrumentName: link.instrument.name,
      bandKind: link.instrument.bandKind,
      questions: active.config.questions.map((q, i) => ({ id: i + 1, dimension: q.dimensionSlug, text: q.text })),
    };
  }

  /** Submissão pública anônima via slug (pontua pela metodologia ativa + pin MET1). */
  async submitPublic(slug: string, dto: SubmitDiagnosticDto) {
    // rls-allow: endpoint público anônimo; resolve slug→tenant e grava sob a RLS do tenant.
    const link = await this.prisma.admin.diagnosticLink.findUnique({ where: { slug } });
    if (!link || !link.active) throw new NotFoundException('Diagnóstico não encontrado ou link inválido.');
    const active = await resolveActiveMethodology(this.prisma, link.instrumentSlug);
    if (!active) throw new NotFoundException('Este diagnóstico ainda não está disponível.');

    let result;
    try {
      const s = scoreWithMethodology(dto.answers ?? [], active.config);
      const byDimension: Record<string, number> = {};
      const dimensionLabels: Record<string, string> = {};
      for (const d of s.byDimension) {
        byDimension[d.slug] = d.value;
        dimensionLabels[d.slug] = d.label;
      }
      result = {
        score: s.score,
        level: s.levelCode,
        levelLabel: s.levelLabel,
        byDimension,
        dimensionLabels,
        topAttention: s.topAttentions[0] ?? '',
      };
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Respostas inválidas');
    }
    const sector = dto.sector?.trim() || null;
    return this.prisma.forTenant(link.tenantId, async (tx) => {
      await tx.diagnosticResponse.create({
        data: {
          tenantId: link.tenantId,
          instrumentSlug: link.instrumentSlug,
          sector,
          answers: dto.answers as unknown as object,
          score: result.score,
          level: result.level,
          byDimension: result.byDimension as unknown as object,
          methodologyVersionId: active.versionId,
        },
      });
      return { ok: true as const, result };
    });
  }

  /** Agregado por empresa+instrumento com supressão (visão do super admin). */
  async results(rawTenantId: string, instrumentSlug: string) {
    const tenantId = await this.resolveOrgId(rawTenantId);
    const minRespondents = MIN_LEADERS_FOR_DISCLOSURE;
    const active = await resolveActiveMethodology(this.prisma, instrumentSlug);
    const dims = active ? active.config.dimensions.map((d) => ({ slug: d.slug, label: d.label })) : [];
    const bands = active?.config.bands ?? [];
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.diagnosticResponse.findMany({
        where: { instrumentSlug },
        select: { sector: true, score: true, byDimension: true, methodologyVersionId: true },
      });
      const total = rows.length;
      if (total < minRespondents) {
        return { minRespondents, totalRespondents: total, suppressed: true as const };
      }
      const score = Math.round(rows.reduce((s, r) => s + r.score, 0) / total);
      const byDimension: Record<string, number> = {};
      const dimensionLabels: Record<string, string> = {};
      for (const d of dims) {
        const vals = rows.map((r) => Number((r.byDimension as Record<string, number>)?.[d.slug] ?? 0));
        byDimension[d.slug] = Math.round(vals.reduce((s, x) => s + x, 0) / vals.length);
        dimensionLabels[d.slug] = d.label;
      }
      const band = bands.find((b) => score >= b.min && score <= b.max);
      const versions = Array.from(new Set(rows.map((r) => r.methodologyVersionId).filter(Boolean)));
      return {
        minRespondents,
        totalRespondents: total,
        suppressed: false as const,
        score,
        level: band?.code ?? '',
        levelLabel: band?.label ?? '',
        byDimension,
        dimensionLabels,
        methodologyMixed: versions.length > 1,
      };
    });
  }
}
