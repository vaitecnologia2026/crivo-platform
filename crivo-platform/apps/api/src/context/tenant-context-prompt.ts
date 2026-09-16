/**
 * Contexto e Diretrizes (módulo 'contexto') — bloco de CONTEXTO DO CLIENTE
 * anexado ao prompt de sistema pela AiSettingsService.buildTenantDirectives.
 *
 * Função pura: recebe o que a consulta já filtrou (diretrizes APROVADAS e
 * documentos APROVADO_PUBLICADO vinculados ao caso de uso ativo) e devolve o
 * texto. Quem filtra é o service/leitor — aqui só se formata, com tetos de
 * tamanho para o prompt não explodir com um manual de 200 mil caracteres.
 *
 * Precedência (card informativo da tela): segurança CRIVO → prompt/caso global
 * → metodologia → contrato → diretrizes aprovadas → documentos autorizados →
 * dados permitidos → instrução do usuário. Este bloco entra DEPOIS do
 * Product.aiConfig (contrato) e nunca substitui o prompt técnico.
 */

export interface PromptDirective {
  id: string;
  title: string;
  text: string;
}

export interface PromptDocument {
  id: string;
  code: string;
  title: string;
  kind: string;
  version: string;
  purpose: string;
  url: string | null;
  extractedText: string | null;
}

/** Teto de texto POR documento e TOTAL no prompt (caracteres). */
export const MAX_DOCUMENT_CHARS = 15_000;
export const MAX_TOTAL_DOCUMENT_CHARS = 60_000;

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n[trecho truncado — documento completo no portal]`;
}

/**
 * Monta o bloco. Retorna '' quando não há nada aprovado — assim a saída de
 * buildTenantDirectives fica IDÊNTICA à anterior para quem não cadastrou nada.
 */
export function formatTenantContext(directives: PromptDirective[], documents: PromptDocument[]): string {
  const parts: string[] = [];

  if (directives.length > 0) {
    const lines = directives.map((d) => `- ${d.title.trim()}: ${d.text.trim()}`);
    parts.push(
      '\n\nDIRETRIZES INSTITUCIONAIS APROVADAS PELA EMPRESA (contexto do cliente; ' +
        'não substituem o método técnico do CRIVO nem a palavra final do especialista humano):\n' +
        lines.join('\n'),
    );
  }

  if (documents.length > 0) {
    let budget = MAX_TOTAL_DOCUMENT_CHARS;
    const blocks: string[] = [];
    for (const doc of documents) {
      const head = `[Documento autorizado ${doc.code} · ${doc.kind} · ${doc.version}: ${doc.title.trim()} — finalidade: ${doc.purpose.trim()}]`;
      const body = doc.extractedText?.trim();
      if (!body) {
        // Documento por URL/sem texto extraído: só a referência — a IA não
        // navega até lá, e fingir que leu seria inventar conteúdo.
        blocks.push(doc.url ? `${head}\n(referência externa: ${doc.url} — conteúdo não incorporado)` : `${head}\n(sem texto incorporado)`);
        continue;
      }
      if (budget <= 0) {
        blocks.push(`${head}\n(omitido: limite de contexto atingido)`);
        continue;
      }
      const clipped = clip(body, Math.min(MAX_DOCUMENT_CHARS, budget));
      budget -= clipped.length;
      blocks.push(`${head}\n${clipped}`);
    }
    parts.push(
      '\n\nDOCUMENTOS AUTORIZADOS PELA EMPRESA PARA ESTE CASO DE USO (use como referência; ' +
        'cite o código do documento quando se apoiar nele):\n' +
        blocks.join('\n\n'),
    );
  }

  return parts.join('');
}
