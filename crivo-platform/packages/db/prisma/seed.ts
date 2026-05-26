import { PrismaClient, Role, Plan } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hash = (s: string) => bcrypt.hashSync(s, 10);

async function main() {
  // 1) Tenant raiz
  const org = await prisma.organization.create({
    data: { name: 'CRIVO Demo — O2 Legacy', plan: Plan.ENTERPRISE },
  });

  // 2) Empresa do tenant (agora com tenantId válido)
  await prisma.company.create({
    data: { tenantId: org.id, name: 'O2 Legacy & Consulting' },
  });

  // 3) Usuário CEO de demonstração
  await prisma.user.create({
    data: {
      tenantId: org.id,
      email: 'ceo@crivo.demo',
      name: 'CEO Demo',
      role: Role.CEO,
      passwordHash: hash('crivo123'),
    },
  });

  console.log('Seed concluído. Org:', org.id, '· login: ceo@crivo.demo / crivo123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
