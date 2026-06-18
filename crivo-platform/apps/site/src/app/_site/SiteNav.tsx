import Link from "next/link";
import { VerticeMark } from "./VerticeMark";
import { PLATAFORMA_URL } from "./site.config";

// Navegação principal compartilhada (header azul-marinho + submenus em hover).
// Config-driven: os hrefs usam alvos absolutos (/lp#secao ou /rota) p/ funcionar
// a partir de QUALQUER página. À medida que as páginas internas forem entrando,
// basta trocar o href do item de topo de "/lp#x" para "/x".
type NavItem = { label: string; href: string };
type NavTop = { label: string; href: string; items?: NavItem[] };

const NAV: NavTop[] = [
  { label: "Início", href: "/lp" },
  {
    label: "Soluções",
    href: "/lp#solucoes",
    items: [
      { label: "Diagnóstico Inicial", href: "/lp#diagnostico" },
      { label: "Fatores Psicossociais e NR-1", href: "/lp#nr1" },
      { label: "Liderança e Cultura", href: "/lp#solucoes" },
      { label: "Governança de IA e Pessoas", href: "/lp#riscos-ia" },
      { label: "Evolução e Sustentação", href: "/lp#solucoes" },
      { label: "Enterprise e Advisory", href: "/lp#solucoes" },
      { label: "Projetos Especiais", href: "/lp#solucoes" },
    ],
  },
  {
    label: "Método CRIVO",
    href: "/lp#metodo",
    items: [
      { label: "Método CRIVO", href: "/lp#metodo" },
      { label: "ICD — Índice de Coerência Decisória", href: "/lp#icd" },
      { label: "Radar da Decisão", href: "/lp#icd" },
      { label: "Governança Comportamental", href: "/lp#riscos-ia" },
      { label: "Evidências e evolução", href: "/lp#jornada" },
    ],
  },
  {
    label: "Plataforma",
    href: "/lp#portal",
    items: [
      { label: "Portal Executivo", href: "/lp#portal" },
      { label: "Dashboard Executivo", href: "/lp#dashboard" },
      { label: "App CRIVO", href: "/lp#app" },
      { label: "Pocket CRIVO", href: "/lp#app" },
      { label: "Academia CRIVO", href: "/lp#ecossistema" },
      { label: "Área logada", href: PLATAFORMA_URL },
    ],
  },
  {
    label: "Conteúdos",
    href: "/lp#ecossistema",
    items: [
      { label: "E-book", href: "/lp#ebook" },
      { label: "Materiais gratuitos", href: "/lp#ecossistema" },
      { label: "FAQ", href: "/lp#faq" },
      { label: "Artigos e eventos", href: "/lp#ecossistema" },
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
  // Externo (portal) abre com <a>; interno usa <Link> (SPA).
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
        </div>
      </div>
    </header>
  );
}
