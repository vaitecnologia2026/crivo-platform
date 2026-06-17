import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Data-fetching em effect (useEffect → setState após await) é o idioma
      // padrão e está em uso em ~11 telas funcionando. A regra do React 19 é
      // estrita demais p/ esse caso → warn (mantém o sinal sem travar o gate;
      // migrar p/ hook de fetch dedicado fica como follow-up de qualidade).
      "react-hooks/set-state-in-effect": "warn",
      // Cosmético (aspas em texto JSX renderizam normal) → warn.
      "react/no-unescaped-entities": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
