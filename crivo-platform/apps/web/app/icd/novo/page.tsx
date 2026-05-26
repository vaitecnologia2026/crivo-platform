'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import { Shell, scoreClass, PATTERN_LABEL } from '../../../components/shell';
import type { IcdQuestion, IcdResult, IcdDimension } from '@crivo/types';

interface Leader { id: string; name: string; role: string }
const DIM_LABEL: Record<IcdDimension, string> = {
  clareza: 'Clareza', pressao: 'Pressão', confianca: 'Confiança', influencia: 'Influência', risco: 'Risco',
};

export default function NovaAvaliacaoPage() {
  const [questions, setQuestions] = useState<IcdQuestion[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [leaderId, setLeaderId] = useState('');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<(IcdResult & { assessmentId: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<IcdQuestion[]>('/api/icd/questions').then(setQuestions).catch((e) => setError(e.message));
    apiFetch<Leader[]>('/api/icd/leaders').then((l) => {
      setLeaders(l);
      if (l[0]) setLeaderId(l[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const payload = {
        leaderId,
        answers: questions.map((q) => ({ questionId: q.id, value: answers[q.id] })),
      };
      const res = await apiFetch<IcdResult & { assessmentId: string }>('/api/icd/assessments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResult(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <span className="eyebrow">ICD · Índice de Coerência Decisória</span>
      <h1 className="h2">Nova avaliação</h1>

      {error && <p className="alert" style={{ marginBottom: 16 }}>{error}</p>}

      {result ? (
        <div className="card">
          <p className="ok">Avaliação registrada.</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, margin: '20px 0' }}>
            <span className={`kpi__value ${scoreClass(result.score)}`} style={{ fontSize: 56 }}>
              {result.score}<small> /100</small>
            </span>
            <span className="badge" style={{ fontSize: 13 }}>
              Padrão: {PATTERN_LABEL[result.dominantPattern] ?? result.dominantPattern}
            </span>
          </div>
          <div style={{ maxWidth: 520 }}>
            {(Object.keys(DIM_LABEL) as IcdDimension[]).map((d) => (
              <div className="dimbar" key={d}>
                <span>{DIM_LABEL[d]}</span>
                <span className="dimbar__track">
                  <span className="dimbar__fill" style={{ width: `${result.dimensions[d]}%` }} />
                </span>
                <span style={{ textAlign: 'right' }}>{result.dimensions[d]}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <Link href="/dashboard" className="btn" style={{ display: 'inline-block' }}>Ver dashboard</Link>
            <button className="btn btn--ghost" onClick={() => { setResult(null); setAnswers({}); }}>
              Nova avaliação
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <label className="field" style={{ maxWidth: 360 }}>
            <span>Líder avaliado</span>
            <select className="input" value={leaderId} onChange={(e) => setLeaderId(e.target.value)}>
              {leaders.map((l) => (
                <option key={l.id} value={l.id}>{l.name} · {l.role}</option>
              ))}
            </select>
          </label>

          <p className="muted" style={{ margin: '8px 0 4px' }}>
            Pense em uma decisão real e recente. Responda de 1 (discordo) a 5 (concordo).
          </p>

          {questions.map((q, i) => (
            <div className="qrow" key={q.id}>
              <span className="dim">{DIM_LABEL[q.dimension]}</span>
              <p>{i + 1}. {q.text}</p>
              <div className="likert">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={answers[q.id] === v ? 'is-sel' : ''}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button className="btn" style={{ marginTop: 20 }} disabled={!allAnswered || !leaderId || saving} onClick={submit}>
            {saving ? 'Calculando ICD…' : 'Calcular ICD'}
          </button>
          {!allAnswered && questions.length > 0 && (
            <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
              Responda todas as {questions.length} perguntas para calcular.
            </p>
          )}
        </div>
      )}
    </Shell>
  );
}
