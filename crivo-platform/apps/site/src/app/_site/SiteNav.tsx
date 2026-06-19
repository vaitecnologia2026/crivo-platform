"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { VerticeMark } from "./VerticeMark";
import { PLATAFORMA_URL } from "./site.config";

// Navegação principal compartilhada (header azul-marinho + submenus em hover no
// desktop; menu hambúrguer no mobile via checkbox-hack, sem JS).
// Itens de topo apontam para as páginas internas; sub-itens para seções (rota#secao).
// Cliente p/ destacar a página ativa (padrão profissional de navegação).
type NavItem = { label: string; href: string };
type NavTop = { label: string; href: string; items?: NavItem[] };

// Arquitetura aprovada (print Pág. 01): Home única com seções sequenciais e menu
// por âncoras. "Sobre" concentra o institucional (submenu). As páginas dedicadas
// (/metodo /plataforma /solucoes /sobre) seguem existindo como aprofundamento.
const NAV: NavTop[] = [
  { label: "O Problema", href: "/lp#o-problema" },
  { label: "Método", href: "/lp#metodo" },
  { label: "Soluções", href: "/lp#solucoes" },
  { label: "ICD", href: "/lp#icd" },
  { label: "Portal", href: "/lp#portal" },
  { label: "App", href: "/lp#app" },
  {
    label: "Sobre",
    href: "/lp#quem-somos",
    items: [
      { label: "Quem Somos", href: "/lp#quem-somos" },
      { label: "Como Nasceu", href: "/lp#como-nasceu" },
      { label: "Ecossistema CRIVO", href: "/lp#ecossistema" },
    ],
  },
  { label: "NR-1", href: "/lp#nr1" },
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
            Fazer Diagnóstico Inicial
          </Link>
          <a href={PLATAFORMA_URL} className="btn btn--ghost btn--sm">
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
  );
}
