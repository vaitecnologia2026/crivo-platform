import { defineConfig } from 'vitest/config';

// Roda só os testes de FONTE. Sem isto, o vitest também varre `dist/` (o
// tsconfig.build emite `*.test.ts` compilado lá) e tenta rodar o `.js`
// CommonJS, quebrando a suíte depois de um `pnpm build`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});
