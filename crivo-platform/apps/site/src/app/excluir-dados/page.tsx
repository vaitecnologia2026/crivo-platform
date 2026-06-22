import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, legalStyles as s } from "../_legal/LegalPage";

export const metadata: Metadata = {
  title: "Excluir dados · CRIVO",
  description: "Como solicitar a exclusão de dados específicos sem encerrar sua conta no CRIVO.",
};

export default function ExcluirDados() {
  return (
    <LegalPage
      title="Excluir dados — CRIVO"
      meta="Operado por VAI Sistema · Contato: vaitecnologialp@gmail.com"
    >
      <p>
        Esta página explica como solicitar a exclusão de <strong>dados específicos</strong> mantidos pelo CRIVO{" "}
        <strong>sem encerrar sua conta</strong>. (Para excluir a conta inteira, veja{" "}
        <Link style={s.a} href="/excluir-conta">Excluir conta</Link>.)
      </p>

      <h2 style={s.h2}>Dados que podem ser excluídos individualmente</h2>
      <ul>
        <li>Telefone de contato.</li>
        <li>Registros de decisões e indicadores criados por você.</li>
        <li>Conteúdos e documentos enviados à plataforma.</li>
      </ul>

      <h2 style={s.h2}>Como solicitar</h2>
      <ol>
        <li>
          No aplicativo, remova diretamente os itens em <strong>Configurações</strong> ou na tela do conteúdo
          correspondente; ou
        </li>
        <li>
          Envie um e-mail para{" "}
          <a style={s.a} href="mailto:vaitecnologialp@gmail.com?subject=Excluir%20dados%20CRIVO">vaitecnologialp@gmail.com</a>{" "}
          com o assunto &quot;Excluir dados CRIVO&quot;, indicando quais dados deseja remover, a partir do e-mail cadastrado.
        </li>
      </ol>

      <h2 style={s.h2}>Prazo</h2>
      <p>
        Atendemos as solicitações em até 30 dias. Dados necessários por obrigação legal podem ser mantidos pelo
        período exigido, e então excluídos ou anonimizados.
      </p>

      <p style={{ marginTop: "2rem" }}>
        Veja também a <Link style={s.a} href="/politica-de-privacidade">Política de Privacidade</Link>.
      </p>
    </LegalPage>
  );
}
