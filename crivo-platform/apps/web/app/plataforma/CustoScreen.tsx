"use client";

import { useState } from "react";

/**
 * Custo Invisível (Briefing §12) — estimador do custo oculto do risco
 * psicossocial. Self-contained (sem backend): o consultor/cliente informa os
 * parâmetros e a tela estima o custo anual por turnover, absenteísmo e
 * presenteísmo. É uma ESTIMATIVA gerencial de sensibilização, não um número
 * contábil — daí a nota de responsabilidade.
 */
const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function CustoScreen() {
  const [f, setF] = useState({
    headcount: 100,
    custoMensal: 4500, // custo médio mensal por colaborador (salário + encargos)
    turnover: 18, // % ao ano
    absenteismoDias: 6, // dias/colaborador/ano
    produtividadePerda: 8, // % de perda (presenteísmo)
    fatorReposicao: 2, // meses de custo para repor 1 saída
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((s) => ({ ...s, [k]: Number(v) || 0 }));

  const reposicao = f.headcount * (f.turnover / 100) * f.custoMensal * f.fatorReposicao;
  const absenteismo = f.headcount * f.absenteismoDias * (f.custoMensal / 22);
  const presenteismo = f.headcount * f.custoMensal * 12 * (f.produtividadePerda / 100);
  const total = reposicao + absenteismo + presenteismo;

  const rows: { label: string; value: number; hint: string }[] = [
    { label: "Reposição (turnover)", value: reposicao, hint: "saídas × custo de reposição" },
    { label: "Absenteísmo", value: absenteismo, hint: "dias perdidos × custo/dia" },
    { label: "Presenteísmo", value: presenteismo, hint: "perda de produtividade no trabalho" },
  ];

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Custo Invisível</h1>
          <p className="page-sub">Estimativa gerencial do custo oculto do risco psicossocial — para sensibilização e priorização.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi" style={{ gridColumn: "span 2" }}>
          <span className="kpi__label">Custo invisível anual estimado</span>
          <strong className="kpi__value" style={{ color: "var(--gold-deep)" }}>{BRL(total)}</strong>
          <span className="kpi__delta">{f.headcount} colaboradores · {BRL(total / Math.max(1, f.headcount))}/pessoa/ano</span>
        </div>
        {rows.map((r) => (
          <div className="kpi" key={r.label}>
            <span className="kpi__label">{r.label}</span>
            <strong className="kpi__value" style={{ fontSize: 28 }}>{BRL(r.value)}</strong>
            <span className="kpi__delta">{r.hint}</span>
          </div>
        ))}
      </div>

      <div className="grid grid--2" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="card__head"><div><h3>Parâmetros</h3><span className="card__sub">Ajuste com os dados da empresa</span></div></div>
          <div className="prod-form__grid">
            <Field label="Nº de colaboradores" value={f.headcount} onChange={set("headcount")} />
            <Field label="Custo médio mensal/colab. (R$)" value={f.custoMensal} onChange={set("custoMensal")} />
            <Field label="Turnover anual (%)" value={f.turnover} onChange={set("turnover")} />
            <Field label="Absenteísmo (dias/colab./ano)" value={f.absenteismoDias} onChange={set("absenteismoDias")} />
            <Field label="Perda de produtividade (%)" value={f.produtividadePerda} onChange={set("produtividadePerda")} />
            <Field label="Fator de reposição (meses)" value={f.fatorReposicao} onChange={set("fatorReposicao")} />
          </div>
        </div>

        <div className="card">
          <div className="card__head"><div><h3>Como lemos</h3><span className="card__sub">Modelo de estimativa</span></div></div>
          <ul className="camp-sectors">
            <li><span>Reposição</span><em style={{ fontSize: 12 }}>nº × turnover% × custo mensal × fator</em></li>
            <li><span>Absenteísmo</span><em style={{ fontSize: 12 }}>nº × dias × (custo mensal ÷ 22)</em></li>
            <li><span>Presenteísmo</span><em style={{ fontSize: 12 }}>nº × custo anual × perda%</em></li>
          </ul>
          <p className="card__sub" style={{ marginTop: 12, fontSize: 11.5, lineHeight: 1.5 }}>
            Estimativa gerencial de apoio à decisão — não substitui análise contábil/atuarial.
            Reduzir o risco psicossocial atua diretamente sobre esses três vetores.
          </p>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <label className="prod-field prod-field--full">
      <span>{label}</span>
      <input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
