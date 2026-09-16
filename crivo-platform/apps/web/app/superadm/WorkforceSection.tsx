"use client";

/**
 * Workforce Intelligence — grupo "Módulos" do Super Admin (protótipo Lovable do Super Admin).
 * Fase 1: seção registrada no menu; o conteúdo real entra na fatia própria.
 * Sem dado demonstrativo: até lá a seção diz o que vai mostrar e de onde.
 */
export function WorkforceSection() {
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>Workforce Intelligence</h3>
          <span className="card__sub">Processos, tarefas, skills, cenários e pilotos por empresa — o que a equipe CRIVO alimenta e valida e o cliente decide no portal (Programas › Workforce Intelligence).</span>
        </div>
      </div>
      <p className="dash-state">Em implantação — esta seção passa a ler dados reais na próxima publicação.</p>
    </div>
  );
}
