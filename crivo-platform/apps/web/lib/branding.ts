// White-label (F5): traduz o branding da empresa em overrides dos tokens
// --crivo-* do tema. Função PURA (testável) — a aplicação no DOM acontece em
// applyBranding. Campos null = mantém o padrão CRIVO (não sobrescreve).
import type { TenantBrandingData } from "@crivo/types";

/** Pares [customProperty, valor] a sobrescrever no :root. Pula campos nulos. */
export function brandingCssVars(b: TenantBrandingData | null): Array<[string, string]> {
  if (!b) return [];
  const vars: Array<[string, string]> = [];
  if (b.primaryColor) vars.push(["--crivo-azul-profundo", b.primaryColor]);
  if (b.accentColor) {
    vars.push(["--crivo-terra", b.accentColor]);
    vars.push(["--crivo-terra-dourado", b.accentColor]);
  }
  return vars;
}

/** Aplica os overrides no :root e devolve um cleanup que os remove. */
export function applyBranding(b: TenantBrandingData | null): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.documentElement;
  const vars = brandingCssVars(b);
  for (const [prop, value] of vars) root.style.setProperty(prop, value);
  return () => {
    for (const [prop] of vars) root.style.removeProperty(prop);
  };
}
