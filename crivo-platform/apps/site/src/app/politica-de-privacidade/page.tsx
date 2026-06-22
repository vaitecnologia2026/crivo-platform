import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, legalStyles as s } from "../_legal/LegalPage";

export const metadata: Metadata = {
  title: "Política de Privacidade · CRIVO",
  description: "Como o CRIVO coleta, usa e protege dados pessoais (LGPD).",
};

export default function PoliticaDePrivacidade() {
  return (
    <LegalPage
      title="Política de Privacidade — CRIVO"
      meta="Última atualização: 22 de junho de 2026 · Controlador: VAI Sistema · Contato: vaitecnologialp@gmail.com"
    >
      <p>
        Esta Política descreve como o aplicativo <strong>CRIVO</strong> (operado por VAI Sistema) coleta, usa,
        armazena e protege dados pessoais, em conformidade com a Lei Geral de Proteção de Dados
        (LGPD, Lei nº 13.709/2018).
      </p>

      <h2 style={s.h2}>1. Dados que coletamos</h2>
      <ul>
        <li><strong>Dados de cadastro e conta:</strong> nome, e-mail, telefone e organização.</li>
        <li><strong>Dados de autenticação:</strong> credenciais de acesso (senha armazenada de forma cifrada).</li>
        <li><strong>Dados de uso da plataforma:</strong> registros de decisões, indicadores e conteúdos inseridos por você.</li>
        <li><strong>Dados técnicos:</strong> identificadores de dispositivo e logs de acesso, para segurança e diagnóstico.</li>
      </ul>

      <h2 style={s.h2}>2. Como usamos os dados</h2>
      <p>
        Os dados são usados exclusivamente para operar a plataforma: autenticar o acesso, prestar as
        funcionalidades de inteligência de decisão, garantir segurança e melhorar o serviço. Não vendemos
        dados pessoais.
      </p>

      <h2 style={s.h2}>3. Compartilhamento</h2>
      <p>
        Não compartilhamos dados pessoais com terceiros para fins de marketing. O compartilhamento ocorre
        apenas com provedores de infraestrutura necessários à operação (hospedagem), sob obrigações de
        confidencialidade.
      </p>

      <h2 style={s.h2}>4. Segurança</h2>
      <p>
        Todo o tráfego entre o aplicativo e nossos servidores é criptografado em trânsito (HTTPS/TLS). Senhas
        são armazenadas com hash. O acesso aos dados é restrito por controles de identidade e permissão.
      </p>

      <h2 style={s.h2}>5. Seus direitos (LGPD)</h2>
      <p>
        Você pode solicitar acesso, correção, portabilidade e exclusão dos seus dados. Para exclusão da conta
        inteira, consulte <Link style={s.a} href="/excluir-conta">Excluir conta</Link>. Para exclusão de dados
        específicos sem encerrar a conta, consulte <Link style={s.a} href="/excluir-dados">Excluir dados</Link>.
      </p>

      <h2 style={s.h2}>6. Retenção</h2>
      <p>
        Mantemos os dados pelo período necessário à prestação do serviço e ao cumprimento de obrigações legais.
        Após a exclusão da conta, os dados são removidos ou anonimizados nos prazos legais aplicáveis.
      </p>

      <h2 style={s.h2}>7. Contato do Encarregado (DPO)</h2>
      <p>
        Dúvidas ou requisições sobre privacidade:{" "}
        <a style={s.a} href="mailto:vaitecnologialp@gmail.com">vaitecnologialp@gmail.com</a>.
      </p>

      <p style={{ marginTop: "2rem" }}>
        Veja também: <Link style={s.a} href="/termos">Termos de Uso</Link>.
      </p>
    </LegalPage>
  );
}
