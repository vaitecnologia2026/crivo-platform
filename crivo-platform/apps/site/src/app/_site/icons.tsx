/**
 * Ícones de traço (line icons) das telas finais aprovadas — a identidade CRIVO
 * NUNCA usa emoji. Compartilhados entre Home e páginas internas da LP.
 */
export const IC = {
  alvo: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  ),
  bussola: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 8.5 13.2 13.2 8.5 15.5l2.3-4.7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  chip: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  prancheta: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 2.5h6v3H9z" stroke="currentColor" strokeWidth="1.6" />
      <path d="m8.5 12 2 2 4-4.5M8.5 17H14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  cerebro: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9.5 4a3 3 0 0 0-3 3 3 3 0 0 0-2 2.8c0 .9.4 1.7 1 2.3A3.2 3.2 0 0 0 6 15a3 3 0 0 0 3 3c.2 1.2 1.2 2 2.5 2H12V4h-2.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14.5 4a3 3 0 0 1 3 3 3 3 0 0 1 2 2.8c0 .9-.4 1.7-1 2.3a3.2 3.2 0 0 1-.5 2.9 3 3 0 0 1-3 3c-.2 1.2-1.2 2-2.5 2H12V4h2.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  grafico: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m16 8 4-4m0 0h-3.2M20 4v3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pessoas: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.8" cy="9.5" r="2.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16.5 14.6c2.2.2 3.7 1.5 4.2 3.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  escudo: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 5 5.8v5C5 15.6 7.9 19.4 12 21c4.1-1.6 7-5.4 7-10.2v-5L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m9 11.5 2.2 2.2L15.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lupa: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12.5v-2M10.5 12.5V9M13 12.5v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  alerta: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4 2.8 20h18.4L12 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 10v4.5M12 17.5v.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  livro: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 6c-1.8-1.4-4.2-2-7-2v14c2.8 0 5.2.6 7 2 1.8-1.4 4.2-2 7-2V4c-2.8 0-5.2.6-7 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 6v14" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  envelope: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5.5" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  capelo: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m12 4 10 4.5L12 13 2 8.5 12 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6.5 10.8V15c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-4.2M20.5 9.5V14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  microfone: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  documento: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h8l4 4v14H6V3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v4h4M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  apresentacao: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 16v3m-4 2 4-2 4 2M8 12l2.5-3 2 2L16 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  telescopio: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m4 12 13-7 3 5.5L7 17.5 4 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m11 16.5 2 5M9.5 21.5l1.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  relogio: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  balao: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4V6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 8.5h8M8 11.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  engrenagem: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  robo: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="8" width="14" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8V4.5M12 4.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9.2" cy="13" r="1.1" fill="currentColor" />
      <circle cx="14.8" cy="13" r="1.1" fill="currentColor" />
      <path d="M9.5 16.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  seta: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/** Selos de confiança em linha (Sem custo · Confidencial · …). */
export function Seals({ items, dark = false }: { items: string[]; dark?: boolean }) {
  return (
    <div className={`seals${dark ? "" : " seals--dark"}`}>
      {items.map((t, i) => (
        <span key={t}>
          {i > 0 && <i aria-hidden="true" />}
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3 5 5.8v5C5 15.6 7.9 19.4 12 21c4.1-1.6 7-5.4 7-10.2v-5L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="m9 11.5 2.2 2.2L15.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t}
        </span>
      ))}
    </div>
  );
}
