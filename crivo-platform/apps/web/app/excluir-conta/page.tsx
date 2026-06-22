import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, legalStyles as s } from "../_legal/LegalPage";

export const metadata: Metadata = {
  title: "Excluir conta · CRIVO",
  description: "Como excluir sua conta inteira do CRIVO e os dados associados.",
};

export default function ExcluirConta() {
  return (
    <LegalPage
      title="Excluir conta — CRIVO"
      meta="Operado por VAI Sistema · Contato: vaitecnologialp@gmail.com"
    >
      <p>
        Esta página explica como excluir <strong>sua conta inteira</strong> do CRIVO e os dados associados a ela.
      </p>

      <h2 style={s.h2}>Como excluir sua conta no aplicativo</h2>
      <ol>
        <li>Acesse o CRIVO e faça login.</li>
        <li>Abra o menu de <strong>Configurações da conta</strong>.</li>
        <li>Selecione <strong>Excluir conta</strong> e confirme a solicitação.</li>
      </ol>

      <h2 style={s.h2}>Como solicitar a exclusão por e-mail</h2>
      <p>
        Se preferir, envie um e-mail para{" "}
        <a style={s.a} href="mailto:vaitecnologialp@gmail.com?subject=Excluir%20conta%20CRIVO">vaitecnologialp@gmail.com</a>{" "}
        com o assunto &quot;Excluir conta CRIVO&quot;, a partir do e-mail cadastrado. Confirmaremos a exclusão em até 30 dias.
      </p>

      <h2 style={s.h2}>O que é excluído</h2>
      <p>
        São removidos: dados de cadastro (nome, e-mail, telefone), credenciais de acesso e os conteúdos
        vinculados à sua conta. Alguns registros podem ser mantidos de forma anonimizada ou pelo período
        exigido por obrigação legal.
      </p>

      <p style={{ marginTop: "2rem" }}>
        Para excluir apenas dados específicos sem encerrar a conta, consulte{" "}
        <Link style={s.a} href="/excluir-dados">Excluir dados</Link>. Veja também a{" "}
        <Link style={s.a} href="/politica-de-privacidade">Política de Privacidade</Link>.
      </p>
    </LegalPage>
  );
}
