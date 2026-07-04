import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { decryptSecret, encryptSecret, hintOf } from './secret-crypto';

export type IntegrationProvider = 'clicksign' | 'asaas' | 'mercadopago';
const PROVIDERS: IntegrationProvider[] = ['clicksign', 'asaas', 'mercadopago'];
type Actor = { id: string; email: string };

/**
 * Integrações externas (Clicksign = assinatura, Asaas/Mercado Pago = cobrança) +
 * modelos de contrato. Credenciais cifradas (secret-crypto). As chamadas saem da
 * API (Railway permite HTTPS de saída).
 */
@Injectable()
export class IntegrationsService {
  private readonly log = new Logger('Integrations');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Configuração ───────────────────────────────────────────────────────────
  async status() {
    const rows = await this.prisma.admin.platformIntegration.findMany();
    return PROVIDERS.map((provider) => {
      const r = rows.find((x) => x.provider === provider);
      return {
        provider,
        enabled: !!r?.enabled,
        hasCredential: !!r?.credentialEnc,
        hint: r?.credentialHint ?? null,
        sandbox: !!r?.sandbox,
      };
    });
  }

  async saveConfig(
    provider: IntegrationProvider,
    dto: { credential?: string; enabled?: boolean; sandbox?: boolean; purpose?: string; confirmProduction?: boolean },
    actor: Actor,
  ) {
    if (!PROVIDERS.includes(provider)) throw new BadRequestException('Provedor inválido.');
    const enabled = dto.enabled ?? false;
    const sandbox = dto.sandbox ?? false;
    const isProdActivation = enabled && !sandbox;

    // Tela 07 · critério de aceite: ativar em PRODUÇÃO exige confirmação + finalidade.
    if (isProdActivation) {
      if (!dto.confirmProduction) {
        throw new BadRequestException('Ativar em produção exige confirmação explícita.');
      }
      if (!dto.purpose?.trim()) {
        throw new BadRequestException('Informe a finalidade da ativação em produção.');
      }
    }

    const data: Record<string, unknown> = { provider, enabled, sandbox };
    if (dto.credential !== undefined) {
      if (dto.credential.trim() === '') {
        Object.assign(data, { credentialEnc: null, credentialIv: null, credentialTag: null, credentialHint: null });
      } else {
        const e = encryptSecret(dto.credential.trim());
        Object.assign(data, {
          credentialEnc: e.enc,
          credentialIv: e.iv,
          credentialTag: e.tag,
          credentialHint: hintOf(dto.credential.trim()),
        });
      }
    }
    await this.prisma.admin.platformIntegration.upsert({
      where: { provider },
      create: data as never,
      update: data as never,
    });

    // Tela 07 · "não permitir integração sem log": registra usuário/data/finalidade/status.
    const action = isProdActivation
      ? 'integration.enable.production'
      : enabled
        ? 'integration.enable'
        : 'integration.save';
    await this.audit.record({
      action,
      actor,
      target: provider,
      meta: {
        enabled,
        environment: sandbox ? 'sandbox' : 'producao',
        purpose: dto.purpose?.trim() || null,
        credentialChanged: dto.credential !== undefined,
      },
    });
    return this.status();
  }

  /** Tela 07 [4] · testa a credencial contra o provedor (GET leve autenticado). */
  async testConnection(provider: IntegrationProvider, actor: Actor): Promise<{ ok: boolean; message: string }> {
    if (!PROVIDERS.includes(provider)) throw new BadRequestException('Provedor inválido.');
    const { key, sandbox } = await this.rawCredential(provider);
    let url: string;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (provider === 'clicksign') {
      url = `https://app.clicksign.com/api/v1/account?access_token=${encodeURIComponent(key)}`;
    } else if (provider === 'asaas') {
      const base = sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';
      url = `${base}/myAccount`;
      headers.access_token = key;
    } else {
      url = 'https://api.mercadopago.com/users/me';
      headers.Authorization = `Bearer ${key}`;
    }
    let ok = false;
    let message = '';
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      ok = res.ok;
      message = res.ok ? 'Conexão OK.' : `Falha ${res.status}: ${(await res.text().catch(() => ''))?.slice(0, 160)}`;
    } catch (e) {
      message = e instanceof Error ? e.message : 'Erro de conexão.';
    }
    await this.audit.record({ action: 'integration.test', actor, target: provider, meta: { ok, environment: sandbox ? 'sandbox' : 'producao' } });
    return { ok, message };
  }

  /** Credencial em claro para USO interno (com o flag enabled). */
  private async credential(provider: IntegrationProvider): Promise<{ key: string; sandbox: boolean }> {
    const r = await this.prisma.admin.platformIntegration.findUnique({ where: { provider } });
    if (!r?.enabled) throw new BadRequestException(`Integração ${provider} desativada.`);
    return this.decode(r, provider);
  }

  /** Credencial em claro SEM exigir enabled (para o teste de conexão pré-ativação). */
  private async rawCredential(provider: IntegrationProvider): Promise<{ key: string; sandbox: boolean }> {
    const r = await this.prisma.admin.platformIntegration.findUnique({ where: { provider } });
    if (!r) throw new BadRequestException(`Integração ${provider} sem credencial.`);
    return this.decode(r, provider);
  }

  private decode(
    r: { credentialEnc: string | null; credentialIv: string | null; credentialTag: string | null; sandbox: boolean },
    provider: IntegrationProvider,
  ): { key: string; sandbox: boolean } {
    if (!r.credentialEnc || !r.credentialIv || !r.credentialTag)
      throw new BadRequestException(`Integração ${provider} sem credencial.`);
    return {
      key: decryptSecret({ enc: r.credentialEnc, iv: r.credentialIv, tag: r.credentialTag }),
      sandbox: r.sandbox,
    };
  }

  // ── Modelos de contrato ─────────────────────────────────────────────────────
  listTemplates() {
    return this.prisma.admin.contractTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, fileName: true, mimeType: true, createdAt: true },
    });
  }

  async uploadTemplate(dto: { name: string; fileName: string; mimeType: string; data: string }) {
    if (!dto.data) throw new BadRequestException('Arquivo vazio.');
    const t = await this.prisma.admin.contractTemplate.create({
      data: { name: dto.name, fileName: dto.fileName, mimeType: dto.mimeType, data: dto.data },
      select: { id: true, name: true, fileName: true, mimeType: true, createdAt: true },
    });
    return t;
  }

  async deleteTemplate(id: string) {
    await this.prisma.admin.contractTemplate.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Modelo não encontrado.');
    });
    return { ok: true };
  }

  private async templateData(id: string) {
    const t = await this.prisma.admin.contractTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Modelo de contrato não encontrado.');
    return t;
  }

  // ── Envio para assinatura (Clicksign API v1) ────────────────────────────────
  async sendForSignature(input: { name: string; email: string; templateId: string; message?: string }) {
    const { key } = await this.credential('clicksign');
    const tpl = await this.templateData(input.templateId);
    const base = 'https://app.clicksign.com/api/v1';
    const q = `access_token=${encodeURIComponent(key)}`;

    // 1) documento (base64)
    const docRes = await fetch(`${base}/documents?${q}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        document: {
          path: `/${tpl.fileName || 'contrato.pdf'}`,
          content_base64: `data:${tpl.mimeType};base64,${tpl.data}`,
        },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!docRes.ok) throw new BadRequestException(`Clicksign (documento): ${await docRes.text().catch(() => docRes.status)}`);
    const docKey = ((await docRes.json()) as { document?: { key?: string } }).document?.key;
    if (!docKey) throw new BadRequestException('Clicksign não retornou o documento.');

    // 2) signatário
    const signerRes = await fetch(`${base}/signers?${q}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ signer: { email: input.email, name: input.name, auths: ['email'] } }),
      signal: AbortSignal.timeout(20000),
    });
    if (!signerRes.ok) throw new BadRequestException(`Clicksign (signatário): ${await signerRes.text().catch(() => signerRes.status)}`);
    const signerKey = ((await signerRes.json()) as { signer?: { key?: string } }).signer?.key;
    if (!signerKey) throw new BadRequestException('Clicksign não retornou o signatário.');

    // 3) vincula (lista) + 4) notifica por e-mail
    const listRes = await fetch(`${base}/lists?${q}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ list: { document_key: docKey, signer_key: signerKey, sign_as: 'sign', message: input.message ?? 'Segue o contrato CRIVO para assinatura.' } }),
      signal: AbortSignal.timeout(20000),
    });
    if (!listRes.ok) throw new BadRequestException(`Clicksign (envio): ${await listRes.text().catch(() => listRes.status)}`);
    const reqKey = ((await listRes.json()) as { list?: { request_signature_key?: string } }).list?.request_signature_key;
    if (reqKey) {
      await fetch(`${base}/notifications?${q}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ request_signature_key: reqKey, message: input.message ?? 'Segue o contrato CRIVO para assinatura.' }),
        signal: AbortSignal.timeout(15000),
      }).catch(() => undefined);
    }
    return { ok: true, provider: 'clicksign', documentKey: docKey, sentTo: input.email };
  }

  // ── Cobrança (Asaas / Mercado Pago) ─────────────────────────────────────────
  async createCharge(
    provider: 'asaas' | 'mercadopago',
    input: { name: string; email: string; cpfCnpj?: string; value: number; description?: string },
  ) {
    if (provider === 'asaas') return this.asaasCharge(input);
    return this.mercadoPagoCharge(input);
  }

  private async asaasCharge(input: { name: string; email: string; cpfCnpj?: string; value: number; description?: string }) {
    const { key, sandbox } = await this.credential('asaas');
    const base = sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';
    const headers = { 'Content-Type': 'application/json', access_token: key };

    const custRes = await fetch(`${base}/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: input.name, email: input.email, cpfCnpj: (input.cpfCnpj ?? '').replace(/\D/g, '') || undefined }),
      signal: AbortSignal.timeout(20000),
    });
    if (!custRes.ok) throw new BadRequestException(`Asaas (cliente): ${await custRes.text().catch(() => custRes.status)}`);
    const customerId = ((await custRes.json()) as { id?: string }).id;
    if (!customerId) throw new BadRequestException('Asaas não retornou o cliente.');

    const due = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const payRes = await fetch(`${base}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ customer: customerId, billingType: 'UNDEFINED', value: input.value, dueDate: due, description: input.description ?? 'Contrato CRIVO' }),
      signal: AbortSignal.timeout(20000),
    });
    if (!payRes.ok) throw new BadRequestException(`Asaas (cobrança): ${await payRes.text().catch(() => payRes.status)}`);
    const pay = (await payRes.json()) as { invoiceUrl?: string; bankSlipUrl?: string };
    return { ok: true, provider: 'asaas', url: pay.invoiceUrl ?? pay.bankSlipUrl ?? null };
  }

  private async mercadoPagoCharge(input: { name: string; email: string; value: number; description?: string }) {
    const { key } = await this.credential('mercadopago');
    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        items: [{ title: input.description ?? 'Contrato CRIVO', quantity: 1, unit_price: input.value, currency_id: 'BRL' }],
        payer: { email: input.email, name: input.name },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new BadRequestException(`Mercado Pago: ${await res.text().catch(() => res.status)}`);
    const pref = (await res.json()) as { init_point?: string; sandbox_init_point?: string };
    return { ok: true, provider: 'mercadopago', url: pref.init_point ?? pref.sandbox_init_point ?? null };
  }
}
