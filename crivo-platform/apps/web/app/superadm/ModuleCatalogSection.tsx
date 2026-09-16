"use client";

/**
 * Módulos Técnicos — grupo "Catálogo Comercial" do Super Admin (protótipo Lovable do Super Admin).
 * Fase 1: seção registrada no menu; o conteúdo real entra na fatia própria.
 * Sem dado demonstrativo: até lá a seção diz o que vai mostrar e de onde.
 */
export function ModuleCatalogSection() {
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>Módulos Técnicos</h3>
          <span className="card__sub">Registro interno das capacidades funcionais que compõem as soluções e os adicionais — derivado do catálogo MODULES, com as soluções/adicionais que usam cada módulo e as empresas com o módulo ativo.</span>
        </div>
      </div>
      <p className="dash-state">Em implantação — esta seção passa a ler dados reais na próxima publicação.</p>
    </div>
  );
}
