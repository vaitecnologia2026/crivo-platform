import { defineConfig } from 'vitest/config';

// Roda só os testes de FONTE (evita o `dist/**.test.js` compilado pelo build).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});
