import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, legalStyles as s } from "../_legal/LegalPage";

export const metadata: Metadata = {
  title: "Termos de Uso · CRIVO",
  description: "Termos e condições de uso da plataforma CRIVO.",
};

export default function Termos() {
  return (
    <LegalPage
      title="Termos de Uso — CRIVO"
      meta="Última atualização: 22 de junho de 2026 · Operado por VAI Sistema · Contato: vaitecnologialp@gmail.com"
    >
      <p>
        Estes Termos de Uso regem o acesso e a utilização do aplicativo e da plataforma <strong>CRIVO</strong>,
        operados por VAI Sistema. Ao acessar ou usar o CRIVO, você concorda com estes Termos. Caso não concorde,
        não utilize o serviço.
      </p>

      <h2 style={s.h2}>1. O serviço</h2>
      <p>
        O CRIVO é uma plataforma de inteligência de decisão para liderança e gestão. As funcionalidades podem ser
        atualizadas, ampliadas ou descontinuadas a qualquer momento para evolução do produto.
      </p>

      <h2 style={s.h2}>2. Conta e acesso</h2>
      <ul>
        <li>O acesso depende de credenciais individuais; você é responsável por mantê-las em sigilo.</li>
        <li>É vedado compartilhar a conta ou permitir o uso por terceiros não autorizados.</li>
        <li>Você se compromete a fornecer informações verdadeiras e atualizadas no cadastro.</li>
      </ul>

      <h2 style={s.h2}>3. Uso aceitável</h2>
      <p>Ao usar o CRIVO, você concorda em não:</p>
      <ul>
        <li>violar leis aplicáveis ou direitos de terceiros;</li>
        <li>tentar acessar áreas, dados ou contas sem autorização;</li>
        <li>interferir na segurança, na integridade ou no desempenho da plataforma;</li>
        <li>inserir conteúdo ilícito, ofensivo ou que viole direitos de propriedade intelectual.</li>
      </ul>

      <h2 style={s.h2}>4. Conteúdo do usuário</h2>
      <p>
        Os dados e conteúdos que você insere permanecem de sua titularidade. Você concede ao CRIVO uma licença
        limitada para processá-los com a finalidade exclusiva de operar o serviço. Você é responsável pela
        legalidade e veracidade do que insere.
      </p>

      <h2 style={s.h2}>5. Propriedade intelectual</h2>
      <p>
        A marca CRIVO, o software, o design e os componentes da plataforma pertencem a VAI Sistema e são
        protegidos por lei. Estes Termos não transferem qualquer direito de propriedade intelectual a você.
      </p>

      <h2 style={s.h2}>6. Privacidade</h2>
      <p>
        O tratamento de dados pessoais segue a nossa{" "}
        <Link style={s.a} href="/politica-de-privacidade">Política de Privacidade</Link>. Você pode encerrar a
        conta a qualquer momento (<Link style={s.a} href="/excluir-conta">Excluir conta</Link>) ou solicitar a
        exclusão de dados específicos (<Link style={s.a} href="/excluir-dados">Excluir dados</Link>).
      </p>

      <h2 style={s.h2}>7. Disponibilidade e limitação de responsabilidade</h2>
      <p>
        Empenhamo-nos em manter o serviço disponível e seguro, mas ele é fornecido &quot;no estado em que se
        encontra&quot;, sem garantia de operação ininterrupta. Na máxima extensão permitida pela lei, VAI Sistema
        não se responsabiliza por danos indiretos decorrentes do uso ou da indisponibilidade do serviço.
      </p>

      <h2 style={s.h2}>8. Suspensão e encerramento</h2>
      <p>
        Podemos suspender ou encerrar o acesso em caso de violação destes Termos ou de risco à segurança da
        plataforma e de seus usuários.
      </p>

      <h2 style={s.h2}>9. Alterações destes Termos</h2>
      <p>
        Estes Termos podem ser atualizados. Alterações relevantes serão comunicadas pelos canais do serviço. O uso
        continuado após a atualização implica concordância com a nova versão.
      </p>

      <h2 style={s.h2}>10. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro do domicílio do
        usuário para dirimir controvérsias, salvo disposição legal em contrário.
      </p>

      <h2 style={s.h2}>11. Contato</h2>
      <p>
        Dúvidas sobre estes Termos:{" "}
        <a style={s.a} href="mailto:vaitecnologialp@gmail.com">vaitecnologialp@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
