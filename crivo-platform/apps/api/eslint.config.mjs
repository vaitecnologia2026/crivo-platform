import tseslint from "typescript-eslint";

// Flat config (ESLint 9) para a API NestJS. Usa o preset recomendado do
// typescript-eslint; relaxa regras incompatíveis com o estilo Nest (DI/decorators).
export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "api/**"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
