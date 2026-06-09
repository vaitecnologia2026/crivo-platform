// Gate anti-R1 (F2): proíbe o uso da conexão owner (prisma.admin / bypass RLS)
// fora dos lugares legítimos (IAM e Admin). Qualquer query de negócio DEVE usar
// prisma.forTenant() para que a RLS seja aplicada. Roda em `pnpm check:rls-bypass`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath decodifica %20 etc. (o caminho do projeto contém espaços).
const SRC = fileURLToPath(new URL('../src/', import.meta.url));

// Onde o uso do owner é legítimo (login cross-tenant, provisionamento, definição).
const ALLOW = [
  'iam/auth.service.ts',
  'prisma/prisma.service.ts',
];
const ALLOW_DIRS = ['admin/']; // todo o módulo de control plane

const PATTERN = /\bprisma\.admin\b/;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
  });
}

const violations = [];
for (const file of walk(SRC)) {
  const rel = relative(SRC, file);
  if (ALLOW.includes(rel) || ALLOW_DIRS.some((d) => rel.startsWith(d))) continue;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (PATTERN.test(line)) violations.push(`${rel}:${i + 1}  ${line.trim()}`);
    });
}

if (violations.length) {
  console.error('✗ Uso de prisma.admin (bypass RLS) fora de IAM/Admin — risco de vazamento cross-tenant:');
  violations.forEach((v) => console.error('  ' + v));
  console.error('\nUse prisma.forTenant(tenantId, ...) em queries de negócio.');
  process.exit(1);
}
console.log('✓ Nenhum uso indevido de prisma.admin fora de IAM/Admin.');
