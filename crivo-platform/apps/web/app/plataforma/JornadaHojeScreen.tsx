"use client";

import { useEffect, useState } from "react";
import {
  apiFetch,
  getMyMentorias,
  listDecisions,
  listMyPocketSessions,
  type MentoriasResponse,
} from "@/lib/api";
import { canSeeRoute, portalNavigate, usePortal } from "@/lib/portal-shell";
import {
  FUSO_SP,
  atalhosVisiveis,
  dataDeHojeSP,
  estadoContinue,
  estadoDaPagina,
  focoDoCiclo,
  montarPendencias,
  proximasMentorias,
  statusDaFalha,
  type StatusCarga,
} from "@/lib/jornada-hoje";
import { formatIcdScore, type DecisionData, type MeuIcdData, type PocketSessionData } from "@crivo/types";
import { IconCalendarClock, IconClock, IconFileText, IconLink, IconShield } from "./Icons";

/** Quantas pendências o cartão lista antes do "e mais N". */
const MAX_PENDENCIAS = 5;

/**
 * Minha Jornada › Hoje (rota `hoje`) — a HOME do líder. Não tem dado próprio:
 * cada cartão lê uma fonte que o líder já tem (ICD do ciclo, Pocket, Registro
 * de Decisão, mentorias dele) com carga INDEPENDENTE. Fonte cuja tela não está
 * no menu nem é pedida; fonte que falha ou dá 403 faz o cartão sumir — nunca
 * um número inventado no lugar. As regras (o que é pendente, o que é "próxima",
 * quando dá para dizer "nada pendente") ficam em lib/jornada-hoje.ts, com teste.
 *
 * A ilha fica montada entre um login e outro na mesma aba; a `key` pela sessão
 * do portal recarrega tudo a cada login — o dia de uma pessoa nunca aparece
 * para a próxima que entrar no mesmo aparelho.
 */
export function JornadaHojeScreen() {
  const { session, sessionSeq } = usePortal();
  if (!session) return null;
  return <Hoje key={sessionSeq} />;
}

type Carga<T> = {
  /** Resultado da ÚLTIMA carga (no "Atualizar" o cartão segue com o anterior). */
  status: StatusCarga;
  data: T | null;
  atualizando: boolean;
  /** Instante (ms) da última resposta — o "agora" em que o dado foi lido. */
  em: number | null;
  recarregar: () => void;
};

type EstadoCarga<T> = { status: StatusCarga; data: T | null; atualizando: boolean; em: number | null };

/**
 * Uma fonte do "Hoje". `quer` = a tela da fonte está no menu do contexto ATUAL
 * (canSeeRoute): sem ela, a fonte é "fora" e nem é pedida. É reativo — o menu
 * muda na troca de contexto, e a fonte passa a ser pedida quando entra nele.
 */
function useCarga<T>(loader: () => Promise<T>, quer: boolean): Carga<T> {
  const [estado, setEstado] = useState<EstadoCarga<T>>({ status: "carregando", data: null, atualizando: false, em: null });
  const [tick, setTick] = useState(0);

  // Estado só muda APÓS o await; o "atualizando" é marcado no próprio handler.
  useEffect(() => {
    if (!quer) return;
    let alive = true;
    loader().then(
      (data) => { if (alive) setEstado({ status: "ok", data, atualizando: false, em: Date.now() }); },
      (err: unknown) => { if (alive) setEstado({ status: statusDaFalha(err), data: null, atualizando: false, em: Date.now() }); },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, quer]);

  return {
    status: quer ? estado.status : "fora",
    data: quer ? estado.data : null,
    atualizando: quer && estado.atualizando,
    em: quer ? estado.em : null,
    recarregar: () => {
      if (!quer) return;
      setEstado((e) => ({ ...e, atualizando: true }));
      setTick((t) => t + 1);
    },
  };
}

function Hoje() {
  // Re-renderiza quando o menu do contexto muda (canSeeRoute lê o store).
  const portal = usePortal();
  const pode = (route: string) => canSeeRoute(route, portal);
  // "Agora" = a montagem ou a resposta mais recente (o Atualizar avança): a data
  // do cabeçalho e o corte de "próxima mentoria" nunca ficam no dia anterior.
  const [montadoEm] = useState(() => Date.now());

  const icd = useCarga<MeuIcdData | null>(() => apiFetch<MeuIcdData | null>("/icd-cycles/me"), pode("lider"));
  const pocket = useCarga<PocketSessionData[]>(listMyPocketSessions, pode("pocket"));
  const decisoes = useCarga<DecisionData[]>(listDecisions, pode("decisoes"));
  const mentorias = useCarga<MentoriasResponse>(() => getMyMentorias("minhas"), pode("jornada-mentorias"));
  const cargas = [icd, pocket, decisoes, mentorias];
  const agora = Math.max(montadoEm, ...cargas.map((c) => c.em ?? 0));

  const atualizando = cargas.some((c) => c.status === "carregando" || c.atualizando);
  function atualizar() {
    cargas.forEach((c) => c.recarregar());
  }

  const foco = icd.status === "ok" ? focoDoCiclo(icd.data) : null;
  const pendencias = montarPendencias(
    pocket.status === "ok" ? pocket.data : null,
    decisoes.status === "ok" ? decisoes.data : null,
  );
  const continuar = estadoContinue(pocket.status, decisoes.status, pendencias.length);
  const proximas = mentorias.status === "ok" && mentorias.data ? proximasMentorias(mentorias.data.rows, agora) : [];
  const atalhos = atalhosVisiveis(pode);

  const algumCartao =
    icd.status === "ok" || continuar === "itens" || continuar === "vazio" || mentorias.status === "ok" || atalhos.length > 0;
  const pagina = estadoDaPagina(cargas.map((c) => c.status), algumCartao);

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Hoje</h1>
          <p className="page-sub">{dataDeHojeSP(new Date(agora))}</p>
          <p className="card__sub" style={{ margin: "4px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
            <IconShield size={13} /> O que você registra aqui é seu: a empresa só vê agregados, sem nomes.
          </p>
        </div>
        <div className="route__actions">
          <button className="btn btn--outline-dark btn--sm" onClick={atualizar} disabled={atualizando}>
            {atualizando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {pagina === "carregando" && <p className="dash-state">Carregando o seu dia…</p>}

      {pagina === "falhou" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar o seu dia agora.{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={atualizar} disabled={atualizando}>
            {atualizando ? "Tentando…" : "Tentar novamente"}
          </button>
        </div>
      )}

      {pagina === "sem-recursos" && (
        <div className="card">
          <div className="card__head">
            <div>
              <h3>Recursos de liderança não liberados</h3>
              <span className="card__sub">
                Os recursos de Minha Jornada (Pocket, Registro de Decisão, ICD, Mentor e Academia) ainda não estão
                liberados no contrato da sua empresa. Eles aparecem aqui quando forem contratados.
              </span>
            </div>
          </div>
        </div>
      )}

      {pagina === "ok" && (
        <div className="grid grid--2">
          {/* a) Foco do ciclo — eixo mais fraco do ICD + 1ª prática da trilha */}
          {icd.status === "ok" && foco && icd.data && (
            <div className="card">
              <div className="card__head">
                <div>
                  <span className="card__eyebrow">Foco do ciclo · {foco.rotulo}</span>
                  <h3 style={{ marginTop: 4 }}>{foco.trilha}</h3>
                  <span className="card__sub">
                    Seu ICD: {formatIcdScore(icd.data.icd.score)}/100 · {icd.data.icd.band.label}
                    {icd.data.origem === "CICLO_ABERTO" ? " · parcial do ciclo" : " · último ciclo fechado"}
                  </span>
                </div>
              </div>
              {foco.pratica && (
                <p style={{ margin: "0 0 12px" }}>
                  <strong>Prática para hoje: </strong>
                  {foco.pratica}
                </p>
              )}
              {pode("lider") && (
                <button className="btn btn--outline-dark btn--sm" onClick={() => portalNavigate("lider")}>
                  Ver meu ICD
                </button>
              )}
            </div>
          )}
          {icd.status === "ok" && !foco && (
            <div className="card">
              <div className="card__head">
                <div>
                  <span className="card__eyebrow">Foco do ciclo</span>
                  <h3 style={{ marginTop: 4 }}>Você ainda não tem ICD no ciclo</h3>
                  <span className="card__sub">
                    O ICD nasce das decisões de impacto médio ou alto que você registra e avalia pelos 4 Eixos.
                    Comece por uma decisão real desta semana.
                  </span>
                </div>
              </div>
              {pode("decisoes") && (
                <button className="btn btn--gold btn--sm" onClick={() => portalNavigate("decisoes")}>
                  Registrar e avaliar decisões
                </button>
              )}
            </div>
          )}

          {/* b) Continue de onde parou — Pocket em andamento e decisões sem avaliação */}
          {(continuar === "itens" || continuar === "vazio") && (
            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Continue de onde parou</h3>
                  <span className="card__sub">Reflexões do Pocket em andamento e decisões ainda sem avaliação ICD.</span>
                </div>
              </div>
              {continuar === "vazio" ? (
                <p className="card__sub" style={{ margin: 0 }}>Nada pendente por aqui.</p>
              ) : (
                <>
                  <ul className="lib-list">
                    {pendencias.slice(0, MAX_PENDENCIAS).map((p) => (
                      <li key={p.id} className="lib-row">
                        <span className="lib-ic">
                          {p.tipo === "pocket" ? <IconClock size={14} /> : <IconFileText size={14} />}
                        </span>
                        <div>
                          <strong>{p.titulo}</strong>
                          <span>{p.detalhe}</span>
                        </div>
                        {pode(p.route) ? (
                          <button className="btn btn--outline-dark btn--sm" onClick={() => portalNavigate(p.route)}>
                            {p.acao}
                          </button>
                        ) : (
                          <span />
                        )}
                      </li>
                    ))}
                  </ul>
                  {pendencias.length > MAX_PENDENCIAS && (
                    <span className="card__hint" style={{ display: "block", marginTop: 6 }}>
                      e mais {pendencias.length - MAX_PENDENCIAS} pendência{pendencias.length - MAX_PENDENCIAS === 1 ? "" : "s"}
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {/* c) Próximas mentorias — só as da própria pessoa */}
          {mentorias.status === "ok" && (
            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Próximas mentorias</h3>
                  <span className="card__sub">Os seus encontros agendados com mentores CRIVO.</span>
                </div>
              </div>
              {proximas.length === 0 ? (
                <p className="card__sub" style={{ margin: 0 }}>Nenhuma mentoria agendada para você por enquanto.</p>
              ) : (
                <ul className="agenda-list">
                  {proximas.map((m) => {
                    const d = new Date(m.scheduledAt);
                    return (
                      <li key={m.id} className="agenda-row">
                        <div className="agenda-row__when">
                          <span className="agenda-row__date">
                            {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: FUSO_SP })}
                          </span>
                          <span className="agenda-row__time">
                            {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO_SP })}
                          </span>
                        </div>
                        <div className="agenda-row__body">
                          <div className="agenda-row__theme">{m.title}</div>
                          <div className="agenda-row__mentor"><IconCalendarClock size={12} /> Mentor: {m.mentorName}</div>
                        </div>
                        <div className="agenda-row__actions">
                          {m.meetingUrl && (
                            <a href={m.meetingUrl} target="_blank" rel="noopener noreferrer" className="lib-act">
                              <IconLink size={14} /> entrar
                            </a>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {pode("jornada-mentorias") && (
                <button
                  className="btn btn--outline-dark btn--sm"
                  style={{ marginTop: 12 }}
                  onClick={() => portalNavigate("jornada-mentorias")}
                >
                  Ver minhas mentorias
                </button>
              )}
            </div>
          )}

          {/* d) Atalhos — só para as telas que estão no menu da Jornada */}
          {atalhos.length > 0 && (
            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Atalhos</h3>
                  <span className="card__sub">Para decidir melhor hoje.</span>
                </div>
              </div>
              <div className="hero__ctas" style={{ flexWrap: "wrap" }}>
                {atalhos.map((a) => (
                  <button key={a.route} className="btn btn--ghost-dark btn--sm" onClick={() => portalNavigate(a.route)}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
