import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';

// Decisão do cliente 18/09: botão Inativar/Ativar na solução (sem excluir).

function build(existing: Record<string, unknown>) {
  const update = vi.fn(async () => ({}));
  const prisma = {
    admin: {
      product: {
        findUnique: vi.fn(async () => existing),
        update,
      },
    },
  };
  const audit = { record: vi.fn(async () => undefined) };
  const svc = new ProductsService(prisma as never, audit as never);
  vi.spyOn(svc, 'get').mockResolvedValue({ id: 'p1', status: 'INACTIVE' } as never);
  return { svc, update, audit };
}

describe('ProductsService.setStatus', () => {
  it('inativa e registra de/para na auditoria', async () => {
    const { svc, update, audit } = build({ id: 'p1', name: 'CRIVO Plus', status: 'ACTIVE', isLeadCapture: false });
    await svc.setStatus('p1', 'INACTIVE', { id: 'a', email: 'adm@crivo' });
    expect(update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { status: 'INACTIVE' } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'product.status', meta: { name: 'CRIVO Plus', from: 'ACTIVE', to: 'INACTIVE' } }));
  });

  it('a solução de captura (MAPA) não pode ser inativada', async () => {
    const { svc, update } = build({ id: 'p0', name: 'MAPA Executivo CRIVO', status: 'ACTIVE', isLeadCapture: true });
    await expect(svc.setStatus('p0', 'INACTIVE', { id: 'a', email: 'adm@crivo' })).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
