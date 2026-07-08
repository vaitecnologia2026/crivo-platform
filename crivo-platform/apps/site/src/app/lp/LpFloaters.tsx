"use client";

import { useState, useEffect } from "react";

/**
 * Flutuantes da LP:
 *  1) Botão "Fazer Diagnóstico Inicial" sempre visível (abre o modal via #diagnostico).
 *  2) Prova social no canto esquerdo: a cada ~4 min sobe um popup com nome + empresa
 *     de quem "finalizou o Diagnóstico Inicial". 100 nomes × 100 sobrenomes = 10.000
 *     variações de nome (+ centenas de empresas) — praticamente sem repetir.
 */

const PRIMEIROS = [
  "Ana", "Beatriz", "Camila", "Daniela", "Eduarda", "Fernanda", "Gabriela", "Helena", "Isabela", "Juliana",
  "Larissa", "Mariana", "Natália", "Patrícia", "Renata", "Sofia", "Tatiane", "Vanessa", "Bruna", "Letícia",
  "Amanda", "Bianca", "Carolina", "Débora", "Elaine", "Flávia", "Giovana", "Aline", "Priscila", "Rafaela",
  "Sabrina", "Taís", "Viviane", "Adriana", "Cristina", "Denise", "Mônica", "Simone", "Luana", "Paula",
  "André", "Bruno", "Carlos", "Daniel", "Eduardo", "Felipe", "Gustavo", "Henrique", "Igor", "João",
  "Lucas", "Marcelo", "Rafael", "Thiago", "Vinícius", "Rodrigo", "Fábio", "Leonardo", "Marcos", "Paulo",
  "Ricardo", "Sérgio", "Alexandre", "Diego", "Fernando", "Gabriel", "Júlio", "Leandro", "Murilo", "Otávio",
  "Pedro", "Renato", "Vitor", "Wagner", "Caio", "Davi", "Emerson", "Anderson", "Cláudio", "Roberto",
  "Antônio", "Bernardo", "César", "Douglas", "Elias", "Geraldo", "Heitor", "Ivan", "Jonas", "Kléber",
  "Luís", "Mauro", "Nelson", "Osvaldo", "Raul", "Sílvio", "Tomás", "Válter", "Wesley", "Yuri",
];

const SOBRENOMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento",
  "Carvalho", "Araújo", "Ribeiro", "Gomes", "Martins", "Rocha", "Barbosa", "Alves", "Ferreira", "Mendes",
  "Cardoso", "Teixeira", "Moreira", "Correia", "Cavalcante", "Dias", "Castro", "Campos", "Pinto", "Moraes",
  "Freitas", "Barros", "Vieira", "Monteiro", "Cunha", "Andrade", "Nogueira", "Tavares", "Macedo", "Borges",
  "Fernandes", "Azevedo", "Machado", "Lopes", "Ramos", "Fonseca", "Farias", "Reis", "Duarte", "Sales",
  "Brito", "Aragão", "Camargo", "Coelho", "Guimarães", "Magalhães", "Medeiros", "Miranda", "Pacheco", "Peixoto",
  "Queiroz", "Sampaio", "Siqueira", "Vasconcelos", "Xavier", "Antunes", "Bastos", "Bezerra", "Cordeiro", "Esteves",
  "Furtado", "Galvão", "Henriques", "Leite", "Marques", "Neves", "Pires", "Rangel", "Trindade", "Valente",
  "Abreu", "Bandeira", "Cruz", "Falcão", "Garcia", "Holanda", "Leal", "Maia", "Nunes", "Padilha",
  "Quintana", "Rezende", "Salgado", "Toledo", "Viana", "Brandão", "Couto", "Drummond", "Pimentel", "Sequeira",
];

const TIPO_EMPRESA = [
  "Grupo", "Indústrias", "Construtora", "Logística", "Rede", "Holding", "Distribuidora", "Corporação",
];
const NOME_EMPRESA = [
  "Aurora", "Horizonte", "Meridiano", "Atlântico", "Vértice", "Aliança", "Boreal", "Cordilheira", "Pinhal",
  "Cristalina", "Monte Belo", "Vale Verde", "Nova Era", "Santa Clara", "Bandeirantes", "Ipê", "Araucária", "Guará",
  "Solaris", "Atlas", "Órion", "Zênite", "Apex", "Lumen", "Forte", "Primavera", "Âncora", "Delta", "Sigma", "Pioneira",
];

const ACOES = [
  "gerou o MAPA Executivo",
  "concluiu o MAPA Executivo CRIVO™",
  "recebeu o Relatório Preliminar",
];

const INTERVALO_MS = 4 * 60 * 1000; // a cada 4 minutos
const PRIMEIRO_MS = 8000; // primeiro popup ~8s após carregar (depois, a cada INTERVALO_MS)
const VISIVEL_MS = 7000; // tempo visível de cada popup

function rnd<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type Prova = { nome: string; empresa: string; acao: string; mins: number; iniciais: string };

function gerar(): Prova {
  const primeiro = rnd(PRIMEIROS);
  const sobrenome = rnd(SOBRENOMES);
  const nome = `${primeiro} ${sobrenome}`;
  return {
    nome,
    empresa: `${rnd(TIPO_EMPRESA)} ${rnd(NOME_EMPRESA)}`,
    acao: rnd(ACOES),
    mins: 1 + Math.floor(Math.random() * 14),
    iniciais: (primeiro[0] + sobrenome[0]).toUpperCase(),
  };
}

export function LpFloaters() {
  const [prova, setProva] = useState<Prova | null>(null);

  useEffect(() => {
    let proximo: ReturnType<typeof setTimeout>;
    let esconder: ReturnType<typeof setTimeout>;
    const mostrar = () => {
      setProva(gerar());
      esconder = setTimeout(() => setProva(null), VISIVEL_MS);
      proximo = setTimeout(mostrar, INTERVALO_MS);
    };
    const primeiro = setTimeout(mostrar, PRIMEIRO_MS);
    return () => {
      clearTimeout(primeiro);
      clearTimeout(proximo);
      clearTimeout(esconder);
    };
  }, []);

  return (
    <>
      {/* Botão flutuante sempre visível → abre o modal do diagnóstico */}
      <a href="#diagnostico" className="float-cta" aria-label="Gerar MAPA Executivo">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Gerar MAPA Executivo</span>
      </a>

      {/* Prova social (canto esquerdo) */}
      {prova && (
        <div className="social-proof" role="status" aria-live="polite">
          <span className="social-proof__avatar" aria-hidden="true">{prova.iniciais}</span>
          <div className="social-proof__body">
            <strong>{prova.nome}</strong>
            <span className="social-proof__org">{prova.empresa}</span>
            <em className="social-proof__act">{prova.acao} · há {prova.mins} min</em>
          </div>
          <span className="social-proof__check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
      )}
    </>
  );
}
