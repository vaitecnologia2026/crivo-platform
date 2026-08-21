import Link from "next/link";
import { GerenciarCookiesLink } from "./CookieConsent";
import { VerticeMark } from "./VerticeMark";
import { PLATAFORMA_URL } from "./site.config";

// Rodapé compartilhado (Soluções · Plataforma · Conteúdos · Sobre · Contato).
// §14 — os títulos de coluna são <h2>: como <h5> eles pulavam do h2/h3 da
// página direto para o nível 5, em todas as rotas.
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
          <h2 className="footer__col-title">Soluções</h2>
          <ul>
            {/* O href continua "/lp#diagnostico": esse id NÃO existe em página
                nenhuma — é o contrato do DiagnosticoModal (montado em SiteNav),
                que intercepta o clique em capture e abre a modal do MAPA. O
                rótulo dizia "Diagnóstico Inicial", mas o que abre é o MAPA
                Executivo; corrigido o texto, mantido o comportamento.
                Os cinco abaixo iam para /solucoes SEM âncora e caíam no topo da
                página. Cada um passa a apontar para o painel correspondente da
                SolucoesTabs — ids conferidos em SolucoesTabs.tsx (linhas 10-16). */}
            <li><Link href="/lp#diagnostico">Mapa Executivo</Link></li>
            <li><Link href="/solucoes#diagnostico-sol">CRIVO Diagnóstico™</Link></li>
            <li><Link href="/solucoes#lideranca">CRIVO Liderança</Link></li>
            <li><Link href="/solucoes#evolucao">CRIVO Evolução</Link></li>
            <li><Link href="/solucoes#enterprise">CRIVO Enterprise</Link></li>
            <li><Link href="/solucoes#advisory">CRIVO Advisory</Link></li>
          </ul>
        </div>
        <div>
          {/* Espelha o submenu "Plataforma" do SiteNav (Portal Executivo · Área
              do Líder) — o cliente pediu menu e rodapé com os mesmos itens e sem
              rótulos diferentes para a mesma âncora (Ajustes 18–23). */}
          <h2 className="footer__col-title">Plataforma</h2>
          <ul>
            <li><Link href="/plataforma#portal">Portal Executivo</Link></li>
            <li><Link href="/plataforma#area-do-lider">Área do Líder</Link></li>
            <li><a href={PLATAFORMA_URL}>Área logada</a></li>
          </ul>
        </div>
        {/* Coluna "Conteúdos" removida a pedido do cliente. */}
        <div>
          <h2 className="footer__col-title">Sobre</h2>
          <ul>
            <li><Link href="/sobre#quem-somos">Quem somos</Link></li>
            <li><Link href="/sobre#como-nasceu">Como nasceu a CRIVO</Link></li>
            <li><Link href="/sobre#fundadores">Fundadores</Link></li>
            <li><Link href="/sobre#mvv">Missão, visão e valores</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="footer__col-title">Contato</h2>
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
          </ul>
        </div>
      </div>
      <div className="footer__legal">
        <div className="container">
          {/* §13 — Política de Privacidade, Política de Cookies, Termos de Uso
              e Gerenciar Cookies, acessíveis de qualquer página. */}
          <nav className="footer__legal-links" aria-label="Links legais">
            <Link href="/politica-de-privacidade">Política de Privacidade</Link>
            <Link href="/politica-de-cookies">Política de Cookies</Link>
            <Link href="/termos">Termos de Uso</Link>
            <Link href="/excluir-conta">Excluir conta</Link>
            <Link href="/excluir-dados">Excluir dados</Link>
            <GerenciarCookiesLink />
          </nav>
          <div className="footer__copy">
            © 2026 CRIVO™ · Decision Intelligence · O2 Legacy &amp; Consulting.
          </div>
        </div>
      </div>
    </footer>
  );
}
