"use client";

// Primitivas de gráfico em SVG para o portal.
//
// O protótipo (lovable/Portal do Cliente) desenha com recharts; o portal não
// tem recharts nem shadcn e não vale puxar ~100 kB de bundle para 5 gráficos.
// Aqui está o mínimo que o protótipo usa — linha, barra horizontal, barra
// empilhada 100%, donut e radar — com eixo, grade e legenda de verdade, que é
// o que faltava quando os blocos eram só <div> com width em %.
//
// Sem estado, sem fetch: recebem números já calculados e devolvem SVG.

import type { ReactNode } from "react";

export const COR_SERIE = {
  azul: "var(--azul-cobalto)",
  azulClaro: "var(--azul-claro)",
  gold: "var(--gold)",
  goldDeep: "var(--gold-deep)",
  danger: "var(--danger)",
  success: "var(--success)",
} as const;

const GRADE = "var(--line-soft)";
const EIXO = "var(--line)";
const TEXTO = "var(--text-sec)";

/** Quebra o rótulo em até 2 linhas para caber na coluna de categorias. */
function quebra(texto: string, max: number): string[] {
  if (texto.length <= max) return [texto];
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(" ")) {
    if (atual && (`${atual} ${palavra}`).length > max) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = atual ? `${atual} ${palavra}` : palavra;
    }
  }
  if (atual) linhas.push(atual);
  if (linhas.length > 2) {
    linhas.length = 2;
    linhas[1] = `${linhas[1].slice(0, Math.max(0, max - 1))}…`;
  }
  return linhas;
}

export function Legenda({ itens }: { itens: { rotulo: string; cor: string }[] }) {
  return (
    <div className="legend" style={{ marginTop: 10, flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
      {itens.map((i) => (
        <span className="legend__item" key={i.rotulo} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 999, background: i.cor, display: "inline-block" }} />
          {i.rotulo}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────── Linha (evolução) ───────────────────────────

export type SerieLinha = { nome: string; cor: string; pontos: (number | null)[] };

/**
 * Linhas múltiplas com eixo Y 0–`max` e eixo X categórico.
 * Ponto `null` é buraco na série (ciclo sem aquele indicador) — a linha
 * simplesmente não passa por ali, em vez de despencar para zero.
 */
export function GraficoLinha({
  rotulos, series, max = 100, altura = 210,
}: { rotulos: string[]; series: SerieLinha[]; max?: number; altura?: number }) {
  const W = 380;
  const H = altura;
  const ml = 30, mr = 10, mt = 10, mb = 26;
  const larg = W - ml - mr;
  const alt = H - mt - mb;
  const n = rotulos.length;
  const x = (i: number) => (n <= 1 ? ml + larg / 2 : ml + (larg * i) / (n - 1));
  const y = (v: number) => mt + alt - (alt * Math.max(0, Math.min(max, v))) / max;
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ width: "100%", height: "auto", display: "block" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} stroke={GRADE} strokeWidth={1} />
            <text x={ml - 5} y={y(t) + 3} textAnchor="end" style={{ fontSize: 8, fill: TEXTO }}>{Math.round(t)}</text>
          </g>
        ))}
        <line x1={ml} x2={W - mr} y1={y(0)} y2={y(0)} stroke={EIXO} strokeWidth={1} />
        {/* Primeiro e último rótulo ancorados para dentro: centralizados, metade
            deles fica fora do viewBox e o "ago/26" da ponta aparecia como "ago/2". */}
        {rotulos.map((r, i) => (
          <text
            key={`${r}-${i}`}
            x={x(i)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            style={{ fontSize: 8, fill: TEXTO }}
          >
            {r}
          </text>
        ))}
        {series.map((s) => {
          // Cada trecho contínuo vira uma polyline própria: sem isso um ciclo
          // sem dado ligaria os dois vizinhos por uma reta que não existe.
          const trechos: string[][] = [];
          const atual: string[] = [];
          s.pontos.forEach((p, i) => {
            if (p === null || p === undefined) {
              if (atual.length) { trechos.push([...atual]); atual.length = 0; }
              return;
            }
            atual.push(`${x(i)},${y(p)}`);
          });
          if (atual.length) trechos.push([...atual]);
          return (
            <g key={s.nome}>
              {trechos.map((t, i) => (
                <polyline key={i} points={t.join(" ")} fill="none" stroke={s.cor} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {s.pontos.map((p, i) =>
                p === null || p === undefined ? null : <circle key={i} cx={x(i)} cy={y(p)} r={2.8} fill={s.cor} />,
              )}
            </g>
          );
        })}
      </svg>
      <Legenda itens={series.map((s) => ({ rotulo: s.nome, cor: s.cor }))} />
    </>
  );
}

// ──────────────────── Barras horizontais (ranking) ────────────────────

export type BarraH = { chave: string; rotulo: string; valor: number; cor: string; nota?: string };

/** Barras horizontais com eixo X 0–`max` e grade — o "fatores prioritários". */
export function GraficoBarrasH({ linhas, max }: { linhas: BarraH[]; max: number }) {
  const W = 380;
  const ml = 108, mr = 8, mt = 6, mb = 18;
  const hLinha = 26;
  const H = mt + linhas.length * hLinha + mb;
  const larg = W - ml - mr;
  const ticks = [0, max / 2, max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ width: "100%", height: "auto", display: "block" }}>
      {ticks.map((t) => {
        const tx = ml + (larg * t) / max;
        return (
          <g key={t}>
            <line x1={tx} x2={tx} y1={mt} y2={mt + linhas.length * hLinha} stroke={GRADE} strokeWidth={1} />
            <text x={tx} y={H - 5} textAnchor="middle" style={{ fontSize: 8, fill: TEXTO }}>{Math.round(t)}</text>
          </g>
        );
      })}
      {linhas.map((l, i) => {
        const yTopo = mt + i * hLinha;
        const yBarra = yTopo + 7;
        const w = Math.max(2, (larg * Math.max(0, Math.min(max, l.valor))) / max);
        const partes = quebra(l.rotulo, 20);
        return (
          <g key={l.chave}>
            {partes.map((p, k) => (
              <text
                key={k}
                x={ml - 6}
                y={yTopo + hLinha / 2 + (partes.length === 1 ? 3 : k * 9 - 1)}
                textAnchor="end"
                style={{ fontSize: 8.5, fill: "var(--text)" }}
              >
                {p}
              </text>
            ))}
            <rect x={ml} y={yBarra} width={w} height={11} rx={3} fill={l.cor}>
              <title>{`${l.rotulo}: ${l.valor}${l.nota ? ` — ${l.nota}` : ""}`}</title>
            </rect>
            <text x={ml + w + 4} y={yBarra + 9} style={{ fontSize: 8.5, fill: TEXTO }}>{l.valor}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────── Barras empilhadas 100% (distribuição) ───────────────

export type LinhaEmpilhada = { chave: string; rotulo: string; segmentos: { rotulo: string; percent: number; cor: string }[] };

/** Barras 100% — o "Distribuição por fator": quanto da gente caiu em cada faixa. */
export function GraficoBarrasEmpilhadas({ linhas }: { linhas: LinhaEmpilhada[] }) {
  const W = 380;
  const ml = 108, mr = 8, mt = 6, mb = 18;
  const hLinha = 24;
  const H = mt + linhas.length * hLinha + mb;
  const larg = W - ml - mr;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ width: "100%", height: "auto", display: "block" }}>
      {[0, 25, 50, 75, 100].map((t) => {
        const tx = ml + (larg * t) / 100;
        return (
          <g key={t}>
            <line x1={tx} x2={tx} y1={mt} y2={mt + linhas.length * hLinha} stroke={GRADE} strokeWidth={1} />
            {/* Extremos ancorados para dentro: o "100%" centralizado passava do viewBox. */}
            <text x={tx} y={H - 5} textAnchor={t === 0 ? "start" : t === 100 ? "end" : "middle"} style={{ fontSize: 8, fill: TEXTO }}>{t}%</text>
          </g>
        );
      })}
      {linhas.map((l, i) => {
        const yTopo = mt + i * hLinha;
        const yBarra = yTopo + 6;
        const partes = quebra(l.rotulo, 20);
        // Início de cada segmento = soma dos percentuais anteriores. Derivado,
        // nunca acumulado por reatribuição dentro do map (quebra o lint).
        const inicio = (k: number) => l.segmentos.slice(0, k).reduce((n, s) => n + s.percent, 0);
        return (
          <g key={l.chave}>
            {partes.map((p, k) => (
              <text
                key={k}
                x={ml - 6}
                y={yTopo + hLinha / 2 + (partes.length === 1 ? 3 : k * 9 - 1)}
                textAnchor="end"
                style={{ fontSize: 8.5, fill: "var(--text)" }}
              >
                {p}
              </text>
            ))}
            {l.segmentos.map((s, k) => {
              const w = (larg * s.percent) / 100;
              if (w <= 0) return null;
              return (
                <rect key={s.rotulo} x={ml + (larg * inicio(k)) / 100} y={yBarra} width={w} height={11} fill={s.cor}>
                  <title>{`${l.rotulo} · ${s.rotulo}: ${s.percent}%`}</title>
                </rect>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────── Donut ───────────────────────────────

export type Fatia = { rotulo: string; valor: number; cor: string };

export function Donut({ fatias, centro, legenda }: { fatias: Fatia[]; centro: number; legenda: string }) {
  const total = fatias.reduce((n, f) => n + f.valor, 0);
  if (total <= 0) return null;
  const R = 54;
  const C = 2 * Math.PI * R;
  // Offset de cada arco = soma das fatias anteriores. Derivado (n ≤ 5), nunca
  // acumulado por reatribuição: mutar variável durante o render quebra o lint.
  const offset = (i: number) => fatias.slice(0, i).reduce((n, x) => n + x.valor, 0) / total;
  return (
    <svg viewBox="0 0 140 140" role="img" aria-label={`${centro} ${legenda}`} style={{ width: "100%", maxWidth: 190, height: "auto", display: "block", margin: "0 auto" }}>
      <g transform="translate(70,70) rotate(-90)">
        {fatias.map((f, i) => (
          <circle
            key={f.rotulo}
            r={R}
            fill="none"
            stroke={f.cor}
            strokeWidth={17}
            strokeDasharray={`${(C * (f.valor / total)).toFixed(2)} ${C.toFixed(2)}`}
            strokeDashoffset={(-C * offset(i)).toFixed(2)}
          >
            <title>{`${f.rotulo}: ${f.valor}`}</title>
          </circle>
        ))}
      </g>
      <text x="70" y="68" textAnchor="middle" style={{ fontSize: 22, fontWeight: 600, fill: "var(--text)" }}>{centro}</text>
      <text x="70" y="84" textAnchor="middle" style={{ fontSize: 9, fill: TEXTO }}>{legenda}</text>
    </svg>
  );
}

// ─────────────────────────────── Radar ───────────────────────────────

export type EixoRadar = { rotulo: string; valor: number };

/** Radar com grade poligonal — o "Liderança · ICD agregado" do protótipo. */
export function GraficoRadar({ eixos, max, cor = COR_SERIE.gold }: { eixos: EixoRadar[]; max: number; cor?: string }) {
  const n = eixos.length;
  if (n < 3) return null;
  // viewBox mais largo que alto de propósito: os rótulos laterais saem para os
  // lados e "Sustentação" ancorado à esquerda estourava num quadrado 210×210.
  const W = 260, H = 215;
  const cx = W / 2, cy = H / 2 - 3, R = 58;
  const RAIO_ROTULO = R * 1.28;
  // -90° para o primeiro eixo apontar para cima, como no protótipo.
  const ang = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const ponto = (i: number, raio: number) => [cx + raio * Math.cos(ang(i)), cy + raio * Math.sin(ang(i))];
  const aneis = [0.25, 0.5, 0.75, 1];
  const poligono = (raio: number) => Array.from({ length: n }, (_, i) => ponto(i, raio).join(",")).join(" ");
  const area = eixos
    .map((e, i) => ponto(i, (R * Math.max(0, Math.min(max, e.valor))) / max).join(","))
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ width: "100%", maxWidth: 280, height: "auto", display: "block", margin: "0 auto" }}>
      {aneis.map((a) => (
        <polygon key={a} points={poligono(R * a)} fill="none" stroke={GRADE} strokeWidth={1} />
      ))}
      {eixos.map((e, i) => {
        const [px, py] = ponto(i, R);
        return <line key={e.rotulo} x1={cx} y1={cy} x2={px} y2={py} stroke={GRADE} strokeWidth={1} />;
      })}
      <polygon points={area} fill={cor} fillOpacity={0.32} stroke={cor} strokeWidth={2} />
      {eixos.map((e, i) => {
        const dir = Math.cos(ang(i));
        const lateral = Math.abs(dir) >= 0.3;
        // Rótulo lateral fica mais perto do centro: ele cresce PARA FORA, e a
        // folga que sobra em cima/embaixo não existe nos lados.
        const [px, py] = ponto(i, lateral ? R * 1.1 : RAIO_ROTULO);
        return (
          <text
            key={e.rotulo}
            x={px}
            y={py + 3}
            textAnchor={lateral ? (dir > 0 ? "start" : "end") : "middle"}
            style={{ fontSize: 9, fill: "var(--text)" }}
          >
            {e.rotulo}
          </text>
        );
      })}
      {eixos.map((e, i) => {
        const [px, py] = ponto(i, (R * Math.max(0, Math.min(max, e.valor))) / max);
        return <circle key={e.rotulo} cx={px} cy={py} r={2.6} fill={cor} />;
      })}
    </svg>
  );
}

/** Envelope comum dos cards de gráfico: cabeçalho + rodapé de procedência. */
export function ChartCard({
  title, description, source, actions, children,
}: { title: string; description?: string; source?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3>{title}</h3>
          {description && <span className="card__sub">{description}</span>}
        </div>
        {actions}
      </div>
      {children}
      {source && (
        <p
          className="card__sub"
          style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line-soft)", fontSize: 10.5, lineHeight: 1.45 }}
        >
          <span className="pill pill--sm pill--outline" style={{ marginRight: 6 }}>Fonte</span>
          {source}
        </p>
      )}
    </div>
  );
}
