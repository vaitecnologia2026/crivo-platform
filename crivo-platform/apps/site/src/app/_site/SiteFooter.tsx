import Link from "next/link";
import { VerticeMark } from "./VerticeMark";
import { PLATAFORMA_URL } from "./site.config";

// Rodapé compartilhado (Soluções · Plataforma · Conteúdos · Sobre · Contato).
export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div>
          <div className="brand brand--footer">
            <VerticeMark className="vertice" />
            <span className="brand__text">
              <span className="brand__name">CRIVO</span>
              <span className="brand__sub">Decision Intelligence</span>
            </span>
          </div>
          <p className="footer__tag">Decisão com critério é infraestrutura de qualidade e resultado.</p>
        </div>
        <div>
          <h5>Soluções</h5>
          <ul>
            <li><Link href="/lp#diagnostico">Diagnóstico Inicial</Link></li>
            <li><Link href="/solucoes">CRIVO Diagnóstico™</Link></li>
            <li><Link href="/solucoes">CRIVO Liderança</Link></li>
            <li><Link href="/solucoes">CRIVO Evolução</Link></li>
            <li><Link href="/solucoes">CRIVO Enterprise</Link></li>
            <li><Link href="/solucoes">CRIVO Advisory</Link></li>
          </ul>
        </div>
        <div>
          <h5>Plataforma</h5>
          <ul>
            <li><Link href="/plataforma#portal">Portal Executivo</Link></li>
            <li><Link href="/plataforma#dashboard">Dashboard Executivo</Link></li>
            <li><Link href="/plataforma#app">App CRIVO</Link></li>
            <li><Link href="/plataforma#app">Pocket CRIVO</Link></li>
            <li><Link href="/plataforma#ecossistema">Academia CRIVO</Link></li>
            <li><a href={PLATAFORMA_URL}>Área logada</a></li>
          </ul>
        </div>
        <div>
          <h5>Conteúdos</h5>
          <ul>
            <li><Link href="/lp#ebook">E-book</Link></li>
            <li><Link href="/plataforma#ecossistema">Materiais gratuitos</Link></li>
            <li><Link href="/lp#faq">FAQ</Link></li>
            <li><Link href="/plataforma#ecossistema">Artigos e eventos</Link></li>
          </ul>
        </div>
        <div>
          <h5>Sobre</h5>
          <ul>
            <li><Link href="/sobre#quem-somos">Quem somos</Link></li>
            <li><Link href="/sobre#como-nasceu">Como nasceu a CRIVO</Link></li>
            <li><Link href="/sobre#fundadores">Fundadores</Link></li>
            <li><Link href="/sobre#mvv">Missão, visão e valores</Link></li>
            <li><Link href="/lp#riscos-ia">Governança de IA e Pessoas</Link></li>
          </ul>
        </div>
        <div>
          <h5>Contato</h5>
          <ul>
            <li>Rodrigo Oliveira · Cofundador</li>
            <li>Viviani Ostan · Cofundadora</li>
            <li><a href="mailto:contato@crivolegacy.com.br">contato@crivolegacy.com.br</a></li>
            <li>
              <a
                href="https://wa.me/5511918531796?text=Ol%C3%A1%2C%20vim%20pelo%20site%20da%20CRIVO"
                target="_blank"
                rel="noopener"
              >
                WhatsApp executivo · (11) 91853-1796
              </a>
            </li>
            <li><a href={PLATAFORMA_URL}>Área logada</a></li>
          </ul>
        </div>
      </div>
      <div className="footer__legal">
        <div className="container">
          © 2026 CRIVO™ — Decision Intelligence System · O2 Legacy &amp; Consulting · Confidencial · LGPD
        </div>
      </div>
    </footer>
  );
}
