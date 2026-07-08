"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { VerticeMark } from "./VerticeMark";
import { PLATAFORMA_URL } from "./site.config";
import { DiagnosticoModal } from "../lp/DiagnosticoModal";
import { LpFloaters } from "../lp/LpFloaters";

// Navegação principal compartilhada (header azul-marinho + submenus em hover no
// desktop; menu hambúrguer no mobile via checkbox-hack, sem JS).
// Itens de topo apontam para as páginas internas; sub-itens para seções (rota#secao).
// Cliente p/ destacar a página ativa (padrão profissional de navegação).
type NavItem = { label: string; href: string };
type NavTop = { label: string; href: string; items?: NavItem[] };

// Menu final aprovado (CRIVO_TELAS_FINAIS · README_DESENVOLVEDOR):
// Início | Soluções | Método CRIVO™ | Plataforma | Conteúdos | Sobre
// Botões fixos: Gerar MAPA | Acessar Portal. SEM "Contato" no menu principal.
const NAV: NavTop[] = [
  { label: "Início", href: "/lp" },
  {
    label: "Soluções",
    href: "/solucoes",
    items: [
      { label: "Mapa Executivo", href: "/solucoes#mapa-executivo" },
      { label: "Diagnóstico", href: "/solucoes#diagnostico-sol" },
      { label: "Gestão da Rotina", href: "/solucoes#gestao-da-rotina" },
      { label: "Liderança", href: "/solucoes#lideranca" },
      { label: "Evolução", href: "/solucoes#evolucao" },
      { label: "Enterprise", href: "/solucoes#enterprise" },
      { label: "Advisory", href: "/solucoes#advisory" },
    ],
  },
  {
    label: "Método CRIVO™",
    href: "/metodo",
    items: [
      { label: "Método", href: "/metodo#metodo" },
      { label: "ICD™ — Coerência Decisória", href: "/metodo#icd" },
    ],
  },
  {
    label: "Plataforma",
    href: "/plataforma",
    items: [
      { label: "Portal Executivo", href: "/plataforma#portal" },
      { label: "Área do Líder", href: "/plataforma#area-do-lider" },
    ],
  },
  { label: "Conteúdos", href: "/conteudos" },
  {
    label: "Sobre",
    href: "/sobre",
    items: [
      { label: "Quem Somos", href: "/sobre#quem-somos" },
      { label: "Como Nasceu a CRIVO™", href: "/sobre#como-nasceu" },
    ],
  },
];

function NavLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  if (href.startsWith("http")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  // Ativo só para páginas dedicadas (rota sem âncora). Itens "/lp#..." não marcam.
  const isActive = (href: string) => !href.includes("#") && href !== "/lp" ? href === pathname : href === "/lp" && pathname === "/lp";

  return (
    <>
    <header className="nav" id="nav">
      <div className="container nav__inner">
        <Link href="/lp" className="brand">
          <VerticeMark className="vertice" />
          <span className="brand__text">
            <span className="brand__name">CRIVO</span>
            <span className="brand__sub">Decision Intelligence</span>
          </span>
        </Link>

        {/* checkbox-hack do menu mobile (sem JS) */}
        <input type="checkbox" id="navToggle" className="nav__toggle" aria-hidden="true" />

        <nav className="nav__links" aria-label="Navegação principal">
          {NAV.map((top) => {
            const active = isActive(top.href);
            return top.items ? (
              <div className="nav__item" key={top.label}>
                <NavLink
                  href={top.href}
                  className={`nav__top nav__top--drop${active ? " is-active" : ""}`}
                >
                  {top.label}
                </NavLink>
                <div className="nav__menu" role="menu">
                  {top.items.map((it) => (
                    <NavLink href={it.href} key={it.label}>
                      {it.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ) : (
              <NavLink href={top.href} className={`nav__top${active ? " is-active" : ""}`} key={top.label}>
                {top.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="nav__actions">
          <Link href="/lp#diagnostico" className="btn btn--terra btn--sm">
            Gerar MAPA
          </Link>
          <a href={PLATAFORMA_URL} className="btn btn--ghost btn--sm">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 13, height: 13, marginRight: 6, verticalAlign: "-2px", display: "inline" }}>
              <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Acessar Portal
          </a>
          <label htmlFor="navToggle" className="nav__burger" aria-label="Abrir menu" title="Menu">
            <span />
            <span />
            <span />
          </label>
        </div>
      </div>
    </header>
    <DiagnosticoModal />
    <LpFloaters />
    </>
  );
}
