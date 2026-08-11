import Link from "next/link";

/**
 * Fundadores na Home (ordem final do documento: … Quem Somos → Fundadores →
 * FAQ → CTA final → Rodapé). A página /sobre continua sendo a versão completa,
 * com a banda navy e a tagline de fecho; aqui fica a leitura curta com o
 * caminho para lá.
 *
 * §9: mantém "Duas trajetórias. Um mesmo propósito.", e os cards trazem apenas
 * nome, função e mini bio — sem as tags/pílulas inferiores, que saíram também
 * de /sobre.
 */
const FUNDADORES = [
  {
    nome: "Rodrigo Oliveira",
    funcao: "Fundador • Estratégia, Pessoas, Governança e Transformação",
    bio:
      "Executivo com mais de 25 anos em ambientes de alta exigência, liderando agendas de pessoas, " +
      "cultura, estratégia, governança e transformação organizacional em grandes empresas no Brasil e " +
      "na América Latina. Une visão de negócio à execução, com experiência em sucessão, integração " +
      "pós-aquisição e mudanças com impacto real.",
  },
  {
    nome: "Viviani Ostan",
    funcao: "Fundadora • Mercado Financeiro, Performance e Desenvolvimento",
    bio:
      "Trajetória construída no mercado financeiro e em ambientes de alta performance, com foco em " +
      "disciplina de execução, leitura de risco e desenvolvimento de pessoas. Traz para a CRIVO o rigor " +
      "de quem decide sob pressão e a prática de transformar método em resultado sustentado.",
  },
];

export function FundadoresSection() {
  return (
    <section id="fundadores" className="section section--light" style={{ paddingTop: 0 }}>
      <div className="container">
        <span className="eyebrow eyebrow--terra">Os Fundadores</span>
        <h2 className="h2">
          Duas trajetórias.
          <br />
          Um mesmo <span className="terra-text">propósito.</span>
        </h2>

        <div className="sobre-founders-grid" style={{ marginTop: 28 }}>
          {FUNDADORES.map((f) => (
            <div className="sobre-founder-card" key={f.nome}>
              <strong className="sobre-founder-card__name">{f.nome}</strong>
              <span className="sobre-founder-card__role">{f.funcao}</span>
              <p>{f.bio}</p>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 20 }}>
          <Link href="/sobre#fundadores" className="btn btn--ghost btn--sm">
            Conhecer a história completa →
          </Link>
        </p>
      </div>
    </section>
  );
}

/**
 * CTA final — último bloco antes do rodapé (ordem do documento).
 * §12: no máximo um CTA principal e um secundário por seção, e o botão que só
 * abre o WhatsApp se chama "Falar com a CRIVO".
 */
export function CtaFinalSection({ whatsapp }: { whatsapp: string }) {
  return (
    <section id="cta-final" className="section section--dark">
      <div className="container" style={{ textAlign: "center" }}>
        <h2 className="h2">
          Comece pelo <span className="terra-text">MAPA Executivo.</span>
        </h2>
        <p className="lede" style={{ margin: "14px auto 26px", maxWidth: 620 }}>
          Poucos minutos, sem custo. Você recebe uma leitura preliminar da maturidade da sua organização
          e a equipe CRIVO conversa com você sobre o próximo passo.
        </p>
        <div className="hero__ctas" style={{ justifyContent: "center" }}>
          <Link href="/lp#diagnostico" className="btn btn--terra">
            Gerar MAPA Executivo →
          </Link>
          <a href={whatsapp} target="_blank" rel="noopener" className="btn btn--outline-light">
            Falar com a CRIVO →
          </a>
        </div>
      </div>
    </section>
  );
}
