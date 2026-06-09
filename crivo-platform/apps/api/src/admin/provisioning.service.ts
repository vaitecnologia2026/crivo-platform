import { ConflictException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from './audit.service';
import { toTenantSummary } from './tenant.mapper';
import type { CreateTenantDto } from './dto';
import type { ProvisionResult } from '@crivo/types';

/** Normaliza um texto em slug DNS-safe (a-z, 0-9, hífen). */
function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/** Senha temporária legível (sem caracteres ambíguos). */
function generatePassword(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(16);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

@Injectable()
export class ProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Provisiona uma empresa-cliente completa, de forma atômica:
   *   1) Organization (tenant raiz, data plane)
   *   2) Tenant (registro no control plane, ligado por organizationId)
   *   3) Usuário ADMIN inicial da empresa
   *
   * Roda na conexão owner (bypass RLS): super admin não é escopado por tenant e
   * está criando o próprio tenant. Único lugar — além do login — onde o uso do
   * owner é legítimo (ver PrismaService).
   */
  async provision(dto: CreateTenantDto, actor?: AuditActor): Promise<ProvisionResult> {
    const db = this.prisma.admin;
    const slug = slugify(dto.slug?.trim() || dto.name);
    if (!slug) throw new ConflictException('Não foi possível derivar um slug do nome');

    const slugTaken = await db.tenant.findUnique({ where: { slug } });
    if (slugTaken) throw new ConflictException(`Slug "${slug}" já está em uso`);

    const generated = !dto.adminPassword;
    const password = dto.adminPassword ?? generatePassword();
    const adminEmail = dto.adminEmail.toLowerCase().trim();

    const tenant = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.name, plan: dto.plan ?? 'BASE' },
      });

      const created = await tx.tenant.create({
        data: {
          organizationId: org.id,
          slug,
          name: dto.name,
          plan: dto.plan ?? 'BASE',
          status: 'ACTIVE',
        },
      });

      await tx.user.create({
        data: {
          tenantId: org.id,
          email: adminEmail,
          name: dto.adminName,
          role: 'ADMIN',
          passwordHash: bcrypt.hashSync(password, 10),
        },
      });

      return created;
    });

    await this.audit.record({
      action: 'tenant.provision',
      actor,
      target: tenant.slug,
      tenantId: tenant.organizationId,
      meta: { plan: tenant.plan, adminEmail },
    });

    return {
      tenant: toTenantSummary(tenant),
      adminEmail,
      tempPassword: generated ? password : undefined,
    };
  }
}
