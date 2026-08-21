import Link from "next/link";
import { GerenciarCookiesLink } from "./CookieConsent";
import { VerticeMark } from "./VerticeMark";
import { PLATAFORMA_URL } from "./site.config";

// Rodapé compartilhado (Soluções · Plataforma · Sobre · Contato).
// §14 — os títulos de coluna são <h2>: como <h5> eles pulavam do h2/h3 da
// página direto para o nível 5, em todas as rotas.

// Ícones de marca das redes sociais (mesmos SVGs coloridos usados em /conteudos).
const SOCIAL = {
  instagram: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="ftr-ig" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FD9739" />
          <stop offset="0.5" stopColor="#E33E5C" />
          <stop offset="1" stopColor="#A335AF" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#ftr-ig)" />
      <circle cx="12" cy="12" r="4.4" stroke="#fff" strokeWidth="1.8" fill="none" />
      <circle cx="17.1" cy="6.9" r="1.2" fill="#fff" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="#25D366" />
      <path
        fill="#fff"
        d="M12 6.6c-3 0-5.4 2.4-5.4 5.4 0 1 .27 1.9.73 2.7L6.6 17.4l2.8-.73c.77.42 1.65.66 2.6.66 3 0 5.4-2.4 5.4-5.4S15 6.6 12 6.6Zm3.16 7.63c-.13.37-.77.71-1.06.73-.28.03-.55.14-1.86-.39-1.57-.62-2.56-2.2-2.64-2.3-.08-.1-.63-.84-.63-1.6 0-.76.4-1.13.54-1.29.14-.15.3-.19.4-.19h.29c.09 0 .22-.03.34.26.13.31.44 1.08.48 1.16.04.08.06.17.01.27l-.16.26-.24.28c-.08.08-.16.17-.07.33.09.16.4.66.86 1.07.59.53 1.09.69 1.25.77.16.08.25.07.34-.04.1-.11.39-.46.5-.62.1-.16.21-.13.35-.08.14.05.9.42 1.05.5.16.08.26.12.3.18.04.07.04.4-.09.77Z"
      />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#0A66C2" />
      <circle cx="7.6" cy="7.9" r="1.4" fill="#fff" />
      <path d="M6.5 10.4h2.2V18H6.5zM10.6 10.4h2.1v1.1c.5-.8 1.4-1.3 2.5-1.3 1.9 0 3 1.2 3 3.4V18H16v-3.9c0-1.2-.5-1.9-1.5-1.9s-1.7.8-1.7 2V18h-2.2z" fill="#fff" />
    </svg>
  ),
};

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
            <li><a href="mailto:contato@crivolegacy.com.br">contato@crivolegacy.com.br</a></li>
          </ul>
          {/* Cofundadores saíram; entram os ícones das redes (a pedido do cliente). */}
          <div className="footer__social" aria-label="Redes sociais da CRIVO">
            <a href="https://www.instagram.com/crivolegacy/" target="_blank" rel="noopener" aria-label="Instagram da CRIVO">
              {SOCIAL.instagram}
            </a>
            <a
              href="https://wa.me/5511918531796?text=Ol%C3%A1%2C%20vim%20pelo%20site%20da%20CRIVO"
              target="_blank"
              rel="noopener"
              aria-label="WhatsApp da CRIVO"
            >
              {SOCIAL.whatsapp}
            </a>
            <a
              href="https://www.linkedin.com/company/crivolegacy/about/?viewAsMember=true"
              target="_blank"
              rel="noopener"
              aria-label="LinkedIn da CRIVO"
            >
              {SOCIAL.linkedin}
            </a>
          </div>
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
