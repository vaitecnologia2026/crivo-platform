/**
 * IA2 (Caderno §10) — diretrizes APROVADAS do cliente para a IA personalizada.
 *
 * A IA personalizada por cliente pode ter valores, políticas e regras aprovadas
 * usadas pelo Mentor/App — SEM que o cliente edite o prompt técnico. Este módulo
 * transforma o `Product.aiConfig` (camada de dados que já existia) num bloco de
 * CONTEXTO anexado ao prompt técnico fixo. Nunca usa `aiConfig.prompt` (isso seria
 * deixar o cliente sobrescrever o prompt técnico — proibido pelo caderno).
 */

/** Normaliza um campo que pode vir como string ou lista de strings. */
function asText(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  if (Array.isArray(v)) {
    const parts = v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
    return parts.length ? parts.join('; ') : null;
  }
  return null;
}

/**
 * Monta o bloco de diretrizes do cliente a partir do `aiConfig`. Só considera os
 * campos de POLÍTICA/CONTEXTO (objetivo, regras, base de conhecimento, limitações)
 * — jamais o `prompt` técnico. Retorna '' quando não há nada aprovado.
 */
export function formatAiDirectives(aiConfig: unknown): string {
  if (!aiConfig || typeof aiConfig !== 'object' || Array.isArray(aiConfig)) return '';
  const cfg = aiConfig as Record<string, unknown>;
  const objective = asText(cfg.objective);
  const rules = asText(cfg.rules);
  const knowledge = asText(cfg.knowledgeBase);
  const limitations = asText(cfg.limitations);

  const lines: string[] = [];
  if (objective) lines.push(`- Objetivo do cliente: ${objective}`);
  if (rules) lines.push(`- Regras aprovadas: ${rules}`);
  if (knowledge) lines.push(`- Base de conhecimento do cliente: ${knowledge}`);
  if (limitations) lines.push(`- Limitações definidas: ${limitations}`);
  if (lines.length === 0) return '';

  return (
    '\n\nDIRETRIZES APROVADAS DO CLIENTE (contexto para personalizar a resposta; ' +
    'NÃO substituem o método técnico do CRIVO nem a palavra final do especialista humano):\n' +
    lines.join('\n')
  );
}
