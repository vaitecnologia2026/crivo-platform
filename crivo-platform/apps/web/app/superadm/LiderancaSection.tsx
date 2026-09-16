"use client";

/**
 * Liderança — grupo "Módulos" do Super Admin (protótipo Lovable do Super Admin).
 * Fase 1: seção registrada no menu; o conteúdo real entra na fatia própria.
 * Sem dado demonstrativo: até lá a seção diz o que vai mostrar e de onde.
 */
export function LiderancaSection() {
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>Liderança</h3>
          <span className="card__sub">Workspace administrativo do módulo Liderança (Mapa Executivo, ICD CRIVO™ e CRIVO Pocket™): ciclos ICD por empresa e agregados com supressão n ≥ 5. Liberação em Contratos e Liberações.</span>
        </div>
      </div>
      <p className="dash-state">Em implantação — esta seção passa a ler dados reais na próxima publicação.</p>
    </div>
  );
}
