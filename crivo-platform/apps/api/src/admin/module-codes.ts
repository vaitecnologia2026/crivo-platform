import { BadRequestException } from '@nestjs/common';
import { MODULES } from '@crivo/types';

const KNOWN = new Set<string>(MODULES.map((m) => m.code));

/**
 * Fresta de liberação (blueprint Módulos): Product.modules/coreModules e
 * Addon.activatedModules eram texto livre — um código do protótipo ('mod-ia',
 * 'mod-dossie') era salvo sem erro e depois ignorado em silêncio pelo contrato
 * (contracts.service filtra por MODULES ao ligar tenant_modules). A equipe
 * achava que tinha liberado algo que nunca chegava ao portal. Aqui o erro
 * aparece no salvamento, listando o que não existe no catálogo.
 *
 * Só valida o que veio no DTO (undefined = não mexeu): registro antigo com
 * código legado não quebra ao editar outro campo.
 */
export function assertModuleCodes(codes: string[] | undefined, field: string): void {
  if (!codes) return;
  const invalid = codes.filter((c) => !KNOWN.has(c));
  if (invalid.length === 0) return;
  throw new BadRequestException(
    `${field}: código(s) fora do catálogo de módulos — ${invalid.join(', ')}. ` +
      `Válidos: ${[...KNOWN].join(', ')}`,
  );
}
