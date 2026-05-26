'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import { Shell, scoreClass, PATTERN_LABEL } from '../../components/shell';
import type { IcdDimensions } from '@crivo/types';

interface RankRow {
  leaderId: string;
  nome: string;
  score: number;
  padraoDominante: string;
  dimensoes: IcdDimensions;
}
interface Dashboard {
  icdMedio: number | null;
  totalAvaliacoes: number;
  totalLideres?: number;
  ranking: RankRow[];
  distribuicaoPadrao: Record<string, number>;
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Dashboard>('/api/icd/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <Shell>
      <span className="eyebrow">Decision Intelligence System</span>
      <h1 className="h2">Dashboard ICD</h1>

      {error && <p className="alert">{error}</p>}
      {!data && !error && <p className="muted">Carregando…</p>}

      {data && data.totalAvaliacoes === 0 && (
        <div className="card">
          <p className="muted">Nenhuma avaliação ainda.</p>
          <p style={{ marginTop: 12 }}>
            <Link href="/icd/novo" className="btn" style={{ display: 'inline-block' }}>
              Aplicar primeira avaliação
            </Link>
          </p>
        </div>
      )}

      {data && data.totalAvaliacoes > 0 && (
        <>
          <div className="grid grid--kpi" style={{ marginBottom: 24 }}>
            <div className="card">
              <div className="kpi__label">ICD médio</div>
              <div className={`kpi__value ${scoreClass(data.icdMedio ?? 0)}`}>
                {data.icdMedio}
                <small> /100</small>
              </div>
            </div>
            <div className="card">
              <div className="kpi__label">Líderes avaliados</div>
              <div className="kpi__value">{data.totalLideres ?? data.ranking.length}</div>
            </div>
            <div className="card">
              <div className="kpi__label">Avaliações totais</div>
              <div className="kpi__value">{data.totalAvaliacoes}</div>
            </div>
            <div className="card">
              <div className="kpi__label">Padrões dominantes</div>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(data.distribuicaoPadrao).map(([p, n]) => (
                  <span key={p} className={`badge${p === 'EQUILIBRADO' ? ' badge--ok' : ''}`}>
                    {PATTERN_LABEL[p] ?? p}: {n}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontSize: 16, marginBottom: 14 }}>Ranking de líderes</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Líder</th>
                  <th>ICD</th>
                  <th>Padrão dominante</th>
                  <th>Clareza</th>
                  <th>Pressão</th>
                  <th>Confiança</th>
                  <th>Influência</th>
                  <th>Risco</th>
                </tr>
              </thead>
              <tbody>
                {data.ranking.map((r) => (
                  <tr key={r.leaderId}>
                    <td>{r.nome}</td>
                    <td>
                      <span className={`scorepill ${scoreClass(r.score)}`}>{r.score}</span>
                    </td>
                    <td>
                      <span className={`badge${r.padraoDominante === 'EQUILIBRADO' ? ' badge--ok' : ''}`}>
                        {PATTERN_LABEL[r.padraoDominante] ?? r.padraoDominante}
                      </span>
                    </td>
                    <td>{r.dimensoes.clareza}</td>
                    <td>{r.dimensoes.pressao}</td>
                    <td>{r.dimensoes.confianca}</td>
                    <td>{r.dimensoes.influencia}</td>
                    <td>{r.dimensoes.risco}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Shell>
  );
}
