'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LoginResponse } from '@crivo/types';
import { setToken } from '../../lib/api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('ceo@crivo.demo');
  const [password, setPassword] = useState('crivo123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Credenciais inválidas');
      const data: LoginResponse = await res.json();
      setToken(data.token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
      setLoading(false);
    }
  }

  return (
    <main style={S.wrap}>
      <form onSubmit={onSubmit} style={S.card}>
        <svg viewBox="0 0 48 44" width="44" height="40" style={{ marginBottom: 18 }} aria-hidden>
          <line x1="5" y1="37" x2="24" y2="6" stroke="#F2F0EC" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="43" y1="37" x2="24" y2="6" stroke="#F2F0EC" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="5" y1="37" x2="17" y2="37" stroke="#F2F0EC" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="31" y1="37" x2="43" y2="37" stroke="#F2F0EC" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="24" cy="6" r="3.6" fill="#C4894A" />
          <circle cx="24" cy="6" r="1.6" fill="#F2F0EC" />
        </svg>

        <span style={S.eyebrow}>Decision Intelligence System</span>
        <h1 style={S.title}>Acesso à Plataforma</h1>

        <label style={S.label}>E-mail corporativo</label>
        <input style={S.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label style={S.label}>Senha</label>
        <input style={S.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        {error && <p style={S.error}>{error}</p>}

        <button style={S.btn} type="submit" disabled={loading}>
          {loading ? 'Autenticando…' : 'Entrar'}
        </button>
        <p style={S.hint}>Demo seed: ceo@crivo.demo / crivo123</p>
      </form>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 },
  card: {
    width: '100%', maxWidth: 380, padding: '40px 34px',
    background: 'rgba(13, 31, 60, 0.55)', border: '1px solid var(--line-dark)',
    borderRadius: 10, backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column',
  },
  eyebrow: { fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--terra-dourado)' },
  title: { fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, margin: '8px 0 24px' },
  label: { fontSize: 12, letterSpacing: '0.04em', color: 'var(--prata)', margin: '10px 0 6px' },
  input: {
    padding: '11px 13px', borderRadius: 4, border: '1px solid var(--line-dark)',
    background: 'rgba(9, 22, 40, 0.6)', color: 'var(--off-white)', fontSize: 15, outline: 'none',
  },
  btn: {
    marginTop: 22, padding: '12px 16px', borderRadius: 3, border: 'none', cursor: 'pointer',
    background: 'var(--terra)', color: 'var(--off-white)', fontSize: 13, fontWeight: 500,
    letterSpacing: '0.08em', textTransform: 'uppercase',
  },
  hint: { marginTop: 14, fontSize: 12, color: 'var(--azul-claro)', textAlign: 'center' },
  error: { marginTop: 12, fontSize: 13, color: '#E0907F' },
  success: { marginTop: 4, padding: 16, borderRadius: 6, background: 'rgba(74, 111, 165, 0.14)' },
};
