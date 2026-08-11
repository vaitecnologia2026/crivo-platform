import type { Metadata } from "next";
import { paginaSeo } from "../_site/seo";
import Link from "next/link";
import { LegalPage, legalStyles as s } from "../_legal/LegalPage";
import { GerenciarCookiesLink } from "../_site/CookieConsent";

export const metadata: Metadata = paginaSeo({
  titulo: "Política de Cookies · CRIVO",
  descricao:
    "Quais cookies o site da CRIVO usa, para quê, e como aceitar, recusar ou revisar sua escolha a qualquer momento.",
  caminho: "/politica-de-cookies",
});

export default function PoliticaDeCookies() {
  return (
    <LegalPage
      title="Política de Cookies — CRIVO"
      meta="Última atualização: 10 de agosto de 2026 · Controlador: O2 Legacy & Consulting · Contato: contato@crivolegacy.com.br"
    >
      <p>
        Esta Política explica o que são cookies, quais deles o site da <strong>CRIVO</strong> utiliza e
        como você controla essa escolha, em conformidade com a Lei Geral de Proteção de Dados
        (LGPD, Lei nº 13.709/2018).
      </p>

      <h2 style={s.h2}>1. O que são cookies</h2>
      <p>
        Cookies são pequenos arquivos gravados no seu navegador quando você visita um site. Servem para
        lembrar preferências, manter uma sessão ativa e, em alguns casos, medir como as páginas são usadas.
      </p>

      <h2 style={s.h2}>2. Categorias que usamos</h2>
      <ul>
        <li>
          <strong>Necessários.</strong> Indispensáveis para o site funcionar: manter sua escolha de
          cookies e sustentar o acesso à área logada. Não podem ser desativados, porque sem eles o site
          deixa de funcionar corretamente. Não são usados para publicidade.
        </li>
        <li>
          <strong>Medição de uso.</strong> Ajudam a entender quais páginas são acessadas e onde as pessoas
          desistem, de forma agregada, para melhorar o site. <strong>Só são ativados com o seu aceite.</strong>
        </li>
        <li>
          <strong>Marketing.</strong> Permitiriam medir a eficácia de campanhas e apresentar conteúdo
          relacionado. <strong>Só são ativados com o seu aceite</strong>, que é separado do aceite de medição.
        </li>
      </ul>

      <h2 style={s.h2}>3. Sua escolha</h2>
      <p>
        Na primeira visita mostramos um aviso com três opções: <strong>aceitar todos</strong>,{" "}
        <strong>recusar os não necessários</strong> ou <strong>gerenciar preferências</strong>, escolhendo
        categoria por categoria. Recusar é tão simples quanto aceitar — nenhuma opção vem pré-marcada e o
        site continua funcionando normalmente se você recusar.
      </p>
      <p>
        Você pode rever essa decisão quando quiser: <GerenciarCookiesLink>gerenciar cookies</GerenciarCookiesLink>.
        O link também fica permanentemente no rodapé de todas as páginas.
      </p>

      <h2 style={s.h2}>4. Onde sua escolha fica guardada</h2>
      <p>
        A escolha é registrada no seu próprio navegador (armazenamento local do dispositivo), junto da data
        em que foi feita. Ela não é enviada a terceiros e não identifica você.
      </p>

      <h2 style={s.h2}>5. Cookies de terceiros</h2>
      <p>
        Enquanto você não aceitar as categorias opcionais, o site não carrega scripts de medição ou de
        marketing de terceiros. Se e quando essas ferramentas forem ativadas, esta Política será atualizada
        com o nome de cada uma antes de entrarem em operação.
      </p>

      <h2 style={s.h2}>6. Como apagar cookies pelo navegador</h2>
      <p>
        Além do nosso painel, todo navegador permite ver e apagar cookies nas configurações de privacidade.
        Apagar os dados do site remove também a sua escolha — o aviso volta a aparecer na próxima visita.
      </p>

      <h2 style={s.h2}>7. Contato</h2>
      <p>
        Dúvidas sobre esta Política ou sobre seus dados:{" "}
        <a href="mailto:contato@crivolegacy.com.br">contato@crivolegacy.com.br</a>. Veja também a{" "}
        <Link href="/politica-de-privacidade">Política de Privacidade</Link> e os{" "}
        <Link href="/termos">Termos de Uso</Link>.
      </p>
    </LegalPage>
  );
}
