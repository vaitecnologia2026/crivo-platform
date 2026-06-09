import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLeadDto, UpdateLeadDto } from './dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Intake público (da LP): cria um lead no tenant configurado, validando um
   * segredo compartilhado. Opt-in — só funciona com LEAD_INTAKE_SECRET e
   * LEAD_INTAKE_TENANT definidos no ambiente. Fecha o loop captação → pipeline.
   */
  intake(secret: string | undefined, dto: CreateLeadDto) {
    const expected = process.env.LEAD_INTAKE_SECRET;
    const tenantId = process.env.LEAD_INTAKE_TENANT;
    if (!expected || !tenantId) {
      throw new ServiceUnavailableException('Intake de leads não configurado');
    }
    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Segredo de intake inválido');
    }
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.lead.create({ data: { tenantId, ...dto, origin: dto.origin ?? 'lp' } }),
    );
  }

  /** Lista os leads do tenant (mais recentes primeiro). */
  list(tenantId: string) {
    return this.prisma.forTenant(tenantId, (tx) => tx.lead.findMany({ orderBy: { createdAt: 'desc' } }));
  }

  /** Cria um lead no pipeline do tenant. */
  create(tenantId: string, dto: CreateLeadDto) {
    return this.prisma.forTenant(tenantId, (tx) => tx.lead.create({ data: { tenantId, ...dto } }));
  }

  /** Atualiza estágio/notas de um lead (validando que pertence ao tenant). */
  update(tenantId: string, id: string, dto: UpdateLeadDto) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.lead.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException('Lead não encontrado');
      return tx.lead.update({ where: { id }, data: dto });
    });
  }
}
