import Link from "next/link";
import { VerticeMark } from "./VerticeMark";
import { PLATAFORMA_URL } from "./site.config";

// Navegação principal compartilhada (header azul-marinho + submenus em hover no
// desktop; menu hambúrguer no mobile via checkbox-hack, sem JS).
// Itens de topo apontam para as páginas internas; sub-itens para seções (rota#secao).
type NavItem = { label: string; href: string };
type NavTop = { label: string; href: string; items?: NavItem[] };

const NAV: NavTop[] = [
  { label: "Início", href: "/lp" },
  {
    label: "Soluções",
    href: "/solucoes",
    items: [
      { label: "Diagnóstico Inicial", href: "/lp#diagnostico" },
      { label: "Fatores Psicossociais e NR-1", href: "/lp#nr1" },
      { label: "Liderança e Cultura", href: "/solucoes" },
      { label: "Governança de IA e Pessoas", href: "/lp#riscos-ia" },
      { label: "Evolução e Sustentação", href: "/solucoes" },
      { label: "Enterprise e Advisory", href: "/solucoes" },
      { label: "Projetos Especiais", href: "/solucoes" },
    ],
  },
  {
    label: "Método CRIVO",
    href: "/metodo",
    items: [
      { label: "Método CRIVO", href: "/metodo" },
      { label: "ICD — Índice de Coerência Decisória", href: "/metodo#icd" },
      { label: "Radar da Decisão", href: "/metodo#icd" },
      { label: "Governança Comportamental", href: "/lp#riscos-ia" },
      { label: "Evidências e evolução", href: "/metodo#jornada" },
    ],
  },
  {
    label: "Plataforma",
    href: "/plataforma",
    items: [
      { label: "Portal Executivo", href: "/plataforma#portal" },
      { label: "Dashboard Executivo", href: "/plataforma#dashboard" },
      { label: "App CRIVO", href: "/plataforma#app" },
      { label: "Pocket CRIVO", href: "/plataforma#app" },
      { label: "Academia CRIVO", href: "/plataforma#ecossistema" },
      { label: "Área logada", href: PLATAFORMA_URL },
    ],
  },
  {
    label: "Conteúdos",
    href: "/lp#ebook",
    items: [
      { label: "E-book", href: "/lp#ebook" },
      { label: "Materiais gratuitos", href: "/plataforma#ecossistema" },
      { label: "FAQ", href: "/lp#faq" },
      { label: "Artigos e eventos", href: "/plataforma#ecossistema" },
    ],
  },
  {
    label: "Sobre",
    href: "/sobre",
    items: [
      { label: "Quem somos", href: "/sobre#quem-somos" },
      { label: "Como nasceu a CRIVO", href: "/sobre#como-nasceu" },
      { label: "Fundadores", href: "/sobre#fundadores" },
      { label: "Missão, visão e valores", href: "/sobre#mvv" },
      { label: "Contato", href: "/lp#diagnostico" },
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
          {NAV.map((top) =>
            top.items ? (
              <div className="nav__item" key={top.label}>
                <NavLink href={top.href} className="nav__top nav__top--drop">
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
              <NavLink href={top.href} className="nav__top" key={top.label}>
                {top.label}
              </NavLink>
            ),
          )}
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
