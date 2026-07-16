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
// Módulos control-plane inteiros: admin (provisionamento/super admin), iam
// (identidade, papéis, permissões — atravessam tenants no login/RBAC por design)
// e cnae (regras de divisão CNAE globais + histórico de decisão; controller 100%
// SuperAdminGuard, sem coluna de tenant — não há query de negócio por tenant aqui)
// e notifications (config global de gatilhos + tokens push; tabelas owner-only
// registradas no sql/rls.sql, push_tokens filtrado por tenantId/userId no app).
const ALLOW_DIRS = ['admin/', 'iam/', 'cnae/', 'notifications/'];

const PATTERN = /\bprisma\.admin\b/;
// Marcador inline para um bypass legítimo e REVISADO (tabela control-plane ou
// endpoint público sem tenant no contexto). Use `// rls-allow: <motivo>` na
// própria linha do uso ou na linha imediatamente acima. Qualquer prisma.admin
// NOVO sem o marcador continua falhando o gate.
const ALLOW_MARK = /rls-allow/;

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
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!PATTERN.test(line)) return;
    // Bypass revisado: marcador `rls-allow` na própria linha ou na linha acima.
    if (ALLOW_MARK.test(line) || (i > 0 && ALLOW_MARK.test(lines[i - 1]))) return;
    violations.push(`${rel}:${i + 1}  ${line.trim()}`);
  });
}

if (violations.length) {
  console.error('✗ Uso de prisma.admin (bypass RLS) fora de IAM/Admin — risco de vazamento cross-tenant:');
  violations.forEach((v) => console.error('  ' + v));
  console.error('\nUse prisma.forTenant(tenantId, ...) em queries de negócio.');
  process.exit(1);
}
console.log('✓ Nenhum uso indevido de prisma.admin fora de IAM/Admin.');
