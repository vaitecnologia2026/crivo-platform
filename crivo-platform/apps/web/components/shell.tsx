'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { getToken, clearToken } from '../lib/api';

/** App shell: topo com navegação + guarda de autenticação. */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  const logout = () => {
    clearToken();
    router.replace('/login');
  };

  const link = (href: string, label: string) => (
    <Link href={href} className={`navlink${pathname === href ? ' is-active' : ''}`}>
      {label}
    </Link>
  );

  return (
    <>
      <header className="topbar">
        <span className="brandmini">
          <svg viewBox="0 0 48 44" width="26" height="24" aria-hidden>
            <line x1="5" y1="37" x2="24" y2="6" stroke="#F2F0EC" strokeWidth="2.6" strokeLinecap="round" />
            <line x1="43" y1="37" x2="24" y2="6" stroke="#F2F0EC" strokeWidth="2.6" strokeLinecap="round" />
            <line x1="5" y1="37" x2="17" y2="37" stroke="#F2F0EC" strokeWidth="2.6" strokeLinecap="round" />
            <line x1="31" y1="37" x2="43" y2="37" stroke="#F2F0EC" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="24" cy="6" r="3.6" fill="#C4894A" />
          </svg>
          <strong>CRIVO</strong>
        </span>
        {link('/dashboard', 'Dashboard ICD')}
        {link('/icd/novo', 'Nova avaliação')}
        <span className="spacer" />
        <button className="btn btn--ghost" onClick={logout} style={{ padding: '8px 14px' }}>
          Sair
        </button>
      </header>
      <div className="container">{children}</div>
    </>
  );
}

export function scoreClass(score: number) {
  return score >= 80 ? 'score--high' : score >= 65 ? 'score--mid' : 'score--low';
}

export const PATTERN_LABEL: Record<string, string> = {
  PRESSAO: 'Pressão',
  AUTOIMAGEM: 'Autoimagem',
  CONFORMIDADE: 'Conformidade',
  AMEACA: 'Ameaça',
  EQUILIBRADO: 'Equilibrado',
};
