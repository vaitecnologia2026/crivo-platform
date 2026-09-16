"use client";

/**
 * Governança de IA — grupo "Módulos" do Super Admin (protótipo Lovable do Super Admin).
 * Fase 1: seção registrada no menu; o conteúdo real entra na fatia própria.
 * Sem dado demonstrativo: até lá a seção diz o que vai mostrar e de onde.
 */
export function AiGovernanceSection() {
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>Governança de IA</h3>
          <span className="card__sub">Acompanhamento, por empresa, dos casos de uso, riscos, aprovações, incidentes e políticas que o cliente governa no portal (Programas › Governança de IA).</span>
        </div>
      </div>
      <p className="dash-state">Em implantação — esta seção passa a ler dados reais na próxima publicação.</p>
    </div>
  );
}
