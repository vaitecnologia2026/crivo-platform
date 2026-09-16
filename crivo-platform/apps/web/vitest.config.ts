import { defineConfig } from 'vitest/config';

// Só as funções PURAS de lib/ (sem DOM nem Next): a lógica que dá para
// prender em teste sem levantar navegador — ex.: montagem das abas do XLSX.
export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'android/**', 'ios/**'],
  },
});
