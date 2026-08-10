/**
 * FAQ da Home (§13 dos Ajustes Finais). Os 11 temas vêm literalmente do
 * documento do cliente: o que é a CRIVO, para quem serve, o que é MAPA,
 * diferença entre MAPA e Diagnóstico, ICD, liderança, plataforma, IA, NR-1,
 * proteção de dados e como começar.
 *
 * Server Component com <details>/<summary>: abre e fecha sem JavaScript, o
 * texto vem no HTML inicial (o §14 pede conteúdo em texto real, rastreável) e
 * o teclado funciona de graça. O CSS `.faq` já existia em lp.css.
 *
 * As respostas seguem as travas do §7: nada de "conformidade garantida",
 * "PGR completo", "substitui a AEP", diagnóstico clínico ou ranking individual.
 */
const PERGUNTAS: { q: string; a: React.ReactNode }[] = [
  {
    q: "O que é a CRIVO?",
    a: (
      <>
        Uma consultoria estratégica de inteligência aplicada à gestão. Trabalhamos liderança, cultura e
        governança para transformar estratégia em execução, com método proprietário, dados e evidências —
        e uma plataforma que sustenta o acompanhamento ao longo do tempo.
      </>
    ),
  },
  {
    q: "Para quem serve?",
    a: (
      <>
        Para organizações que precisam converter decisão em execução consistente: direção, RH e lideranças
        que respondem por resultado, clima e risco. Atendemos de empresas menores, em jornada guiada, a
        estruturas maiores, com campanhas por área e consolidação por grupo.
      </>
    ),
  },
  {
    q: "O que é o MAPA Executivo?",
    a: (
      <>
        É a porta de entrada, gratuita: um questionário curto que devolve uma leitura preliminar de
        maturidade organizacional em cinco dimensões. Ao concluir, você recebe o Relatório Preliminar
        CRIVO™ por WhatsApp ou e-mail. O MAPA não cria contrato e não libera acesso ao portal.
      </>
    ),
  },
  {
    q: "Qual a diferença entre o MAPA e o Diagnóstico?",
    a: (
      <>
        O <strong>MAPA</strong> é uma autoavaliação inicial, respondida por uma pessoa, que indica onde
        olhar. O <strong>Diagnóstico</strong> é o trabalho contratado: aplica-se ao time, consolida
        respostas de forma agregada e anônima, aponta fatores de atenção e alimenta plano de ação,
        evidências e documentação técnica.
      </>
    ),
  },
  {
    q: "O que é o ICD™?",
    a: (
      <>
        O Índice de Coerência Decisória mede a qualidade das decisões da liderança em quatro eixos —
        Clareza, Critério, Alinhamento e Sustentação. É uma leitura de coerência, não uma avaliação de
        desempenho: resultados individuais não viram ranking nem são expostos à empresa.
      </>
    ),
  },
  {
    q: "Como a CRIVO trabalha liderança?",
    a: (
      <>
        Com leitura própria de cada líder e trilha de desenvolvimento conectada ao que o diagnóstico
        mostrou. A Área do Líder reúne registro de decisões, reflexão individual (Pocket), academia e
        mentoria — o que o líder registra ali é dele, e chega à empresa apenas de forma agregada.
      </>
    ),
  },
  {
    q: "O que a plataforma faz?",
    a: (
      <>
        Sustenta o ciclo inteiro: aplica os diagnósticos, consolida os resultados por área, transforma
        pontos de atenção em plano de ação com responsável e prazo, guarda as evidências e emite os
        documentos técnicos com numeração e verificação de integridade.
      </>
    ),
  },
  {
    q: "Como a CRIVO usa inteligência artificial?",
    a: (
      <>
        Como apoio a quem decide, nunca como quem decide. A IA organiza leitura, sugere caminhos e ajuda a
        redigir — e todo texto que compõe documento oficial passa por revisão e aprovação humana antes de
        ser emitido. A vantagem competitiva continua sendo humana.
      </>
    ),
  },
  {
    q: "A CRIVO resolve a NR-1?",
    a: (
      <>
        A CRIVO identifica, registra e ajuda a gerir fatores de risco psicossocial relacionados ao
        trabalho, gerando documentação técnica de apoio. Esse material <strong>subsidia</strong> a AEP e a
        integração ao GRO/PGR — não substitui a AEP nem o PGR, não faz diagnóstico clínico e não garante
        conformidade por si só. A revisão, validação e assinatura são da empresa e do responsável técnico.
      </>
    ),
  },
  {
    q: "Como vocês protegem os dados?",
    a: (
      <>
        Cada empresa só enxerga os próprios dados, com isolamento aplicado no banco. As respostas de
        colaboradores são anônimas e só aparecem de forma agregada, a partir de um número mínimo de
        respondentes — abaixo disso o recorte é suprimido. Detalhes na{" "}
        <a href="/politica-de-privacidade">Política de Privacidade</a> e na{" "}
        <a href="/politica-de-cookies">Política de Cookies</a>.
      </>
    ),
  },
  {
    q: "Como começar?",
    a: (
      <>
        Gere o MAPA Executivo — leva poucos minutos e não tem custo. Com a leitura preliminar em mãos,
        a equipe CRIVO conversa com você sobre o caminho mais adequado ao momento da sua organização.
      </>
    ),
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="section">
      <div className="container">
        <span className="eyebrow">Perguntas frequentes</span>
        <h2 className="h2">Dúvidas comuns, respostas diretas.</h2>
        <div className="faq">
          {PERGUNTAS.map((p) => (
            <details key={p.q}>
              <summary>{p.q}</summary>
              <p>{p.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* §14 — dados estruturados: o FAQ é um dos formatos que o Google
          entende nativamente. Texto puro, igual ao visível (nada oculto). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: PERGUNTAS.map((p) => ({
              "@type": "Question",
              name: p.q,
              acceptedAnswer: { "@type": "Answer", text: textoPuro(p.a) },
            })),
          }),
        }}
      />
    </section>
  );
}

/** Extrai o texto de um nó React simples (só o necessário para o JSON-LD). */
function textoPuro(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoPuro).join("");
  if (typeof node === "object" && "props" in (node as { props?: unknown })) {
    return textoPuro((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}
