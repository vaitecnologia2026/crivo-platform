/**
 * Biblioteca de Planos de Ação para Controle dos Riscos Psicossociais, por
 * dimensão do diagnóstico CRIVO. Conteúdo autorado a partir do relatório de
 * referência Mapa HDS ("Planos de Ação para Controle dos Riscos Psicossociais",
 * pp. 5–12), adaptado para as 6 dimensões do Inventário Psicossocial CRIVO.
 *
 * Mapeamento Mapa HDS → dimensão CRIVO:
 *   demandas       ← Exigências Laborais (sobrecarga, ritmo, pressão, previsibilidade)
 *   controle       ← Recursos Organizacionais (autonomia / participação / decisão)
 *   apoio          ← Recursos Organizacionais (apoio de liderança e colegas / suporte)
 *   reconhecimento ← Identificação Laboral (reconhecimento, pertencimento, desenvolvimento)
 *   clareza        ← Clarificação de papéis / descrições de cargo / justiça organizacional
 *   relacoes       ← Relações de Respeito e Confiança + Saúde Emocional e Bem-estar
 *
 * A CHAVE de cada entrada é o `slug` da dimensão (o mesmo que aparece em
 * PsychosocialRiskMatrixRow.slug). Consumida por documents.service.ts para
 * PREENCHER AUTOMATICAMENTE o Dossiê Técnico com o plano de ação por dimensão,
 * priorizado pela classificação de risco (R = Probabilidade × Severidade).
 */

export interface PsychosocialActionLibraryAction {
  titulo: string;
  prazo: string;
  objetivo: string;
  etapas: string;
  indicadores: string;
}

export interface PsychosocialActionLibraryEntry {
  descricao: string;
  objetivo: string;
  acoes: PsychosocialActionLibraryAction[];
}

export const PSYCHOSOCIAL_ACTION_LIBRARY: Record<string, PsychosocialActionLibraryEntry> = {
  // ── Demandas e ritmo de trabalho ← Exigências Laborais ──────────────────────
  demandas: {
    descricao:
      'Examina a percepção dos colaboradores acerca de fatores laborais que impõem demandas ' +
      'elevadas e podem impactar negativamente saúde, bem-estar e desempenho, sobretudo na ausência ' +
      'de recursos adequados para lidar com elas. Abrange pressão constante por resultados, ritmo ' +
      'acelerado de trabalho, altas exigências cognitivas e quantitativas, adaptação frequente a ' +
      'mudanças imprevistas e insegurança quanto à estabilidade do emprego.',
    objetivo:
      'Reduzir a sobrecarga e a inconsistência de demandas que geram risco de adoecimento, erros ' +
      'operacionais e queda de desempenho, equilibrando volume, ritmo e previsibilidade do trabalho.',
    acoes: [
      {
        titulo: 'Protocolos de previsibilidade e planejamento',
        prazo: 'Curto prazo',
        objetivo: 'Reduzir a imprevisibilidade operacional que gera estresse e adaptação constante.',
        etapas:
          'Calendário de mudanças e processos; comunicação antecipada de alterações; planos de ' +
          'contingência documentados; padronização de prazos e priorização de demandas.',
        indicadores:
          'Percentual de alterações comunicadas com antecedência; satisfação com previsibilidade em ' +
          'pesquisas internas; nº de demandas emergenciais não planejadas.',
      },
      {
        titulo: 'Revisão de alocação e balanceamento de cargas',
        prazo: 'Curto → Médio prazo',
        objetivo: 'Equilibrar volume e complexidade das tarefas entre pessoas e funções.',
        etapas:
          'Levantamento de tarefas por função → análise de tempo e de tarefas críticas → ' +
          'realocação, contratação ou automação onde necessário; revisão periódica de metas.',
        indicadores:
          'Tempo médio por tarefa; índice de retrabalho; absenteísmo por fadiga; horas extras por área.',
      },
      {
        titulo: 'Gestão do ritmo e das exigências cognitivas',
        prazo: 'Médio prazo',
        objetivo: 'Tornar o ritmo sustentável e proteger a atenção em atividades de alta exigência mental.',
        etapas:
          'Pausas programadas e blocos de foco; limites de multitarefa e de interrupções; ' +
          'dimensionamento de metas por capacidade real; apoio de ferramentas que reduzam carga manual.',
        indicadores:
          'Indicadores de energia e fadiga em pesquisas; nº de erros/incidentes por sobrecarga; ' +
          'adesão às pausas programadas.',
      },
      {
        titulo: 'Prevenção de sobrecarga crônica ligada à carga de trabalho',
        prazo: 'Longo prazo',
        objetivo: 'Instituir práticas que previnam a exaustão prolongada decorrente de demandas excessivas.',
        etapas:
          'Formação de líderes para detecção precoce de sobrecarga; protocolos de redução temporária ' +
          'de carga; política de desconexão; acompanhamento no retorno após afastamento.',
        indicadores:
          'Casos de exaustão/burnout identificados; tempo médio de afastamento por fadiga; ' +
          'rotatividade em áreas de alta demanda.',
      },
    ],
  },

  // ── Autonomia e participação ← Recursos Organizacionais (autonomia/decisão) ──
  controle: {
    descricao:
      'Avalia a autonomia dos colaboradores para organizar o próprio trabalho e a sua participação ' +
      'nas decisões que os afetam. Considera a margem de decisão sobre método, ritmo e prioridades, ' +
      'a influência real sobre mudanças e a disponibilidade de recursos organizacionais que sustentem ' +
      'boas decisões no dia a dia.',
    objetivo:
      'Ampliar a autonomia e a participação dos colaboradores nas decisões que afetam seu trabalho, ' +
      'assegurando recursos e informação adequados para decidir com segurança.',
    acoes: [
      {
        titulo: 'Ampliação da autonomia sobre método e organização do trabalho',
        prazo: 'Curto → Médio prazo',
        objetivo: 'Aumentar a margem de decisão das pessoas sobre como e quando executam suas tarefas.',
        etapas:
          'Mapeamento de decisões hoje centralizadas; definição de alçadas por função; delegação ' +
          'gradual com acordos claros de resultado; flexibilização de ritmo/organização onde viável.',
        indicadores:
          'Percepção de autonomia em pesquisas internas; nº de decisões delegadas por área; ' +
          'tempo de espera por aprovações.',
      },
      {
        titulo: 'Canais de participação e voz nas decisões',
        prazo: 'Curto prazo',
        objetivo: 'Garantir que a opinião dos colaboradores seja ouvida e considerada em mudanças relevantes.',
        etapas:
          'Fóruns e rituais de escuta (comitês, rodas, pesquisas rápidas); consulta prévia a mudanças ' +
          'que afetam o trabalho; retorno estruturado sobre o que foi acatado e por quê.',
        indicadores:
          'Taxa de participação nos canais; percentual de sugestões respondidas; percepção de ' +
          '"minha opinião é considerada".',
      },
      {
        titulo: 'Provisão de recursos e informação para decidir',
        prazo: 'Médio prazo',
        objetivo: 'Reduzir o estresse causado pela falta de recursos e de informação no momento de decidir.',
        etapas:
          'Levantamento de lacunas de ferramentas, dados e acessos; provisão de recursos essenciais; ' +
          'documentação de processos e critérios de decisão acessíveis à equipe.',
        indicadores:
          'Nº de bloqueios por falta de recurso/acesso; satisfação com ferramentas de trabalho; ' +
          'tempo médio para obter informação necessária.',
      },
    ],
  },

  // ── Apoio (liderança e colegas) ← Recursos Organizacionais (suporte) ─────────
  apoio: {
    descricao:
      'Avalia o apoio social percebido no trabalho — da liderança e dos colegas — e o suporte ' +
      'organizacional disponível diante de dificuldades. Considera a presença de escuta e orientação ' +
      'da chefia, a cooperação entre pares e a existência de recursos de retaguarda quando as demandas ' +
      'excedem a capacidade individual.',
    objetivo:
      'Fortalecer o apoio social no trabalho — de liderança e de pares — e o suporte organizacional ' +
      'às dificuldades cotidianas, protegendo saúde e desempenho.',
    acoes: [
      {
        titulo: 'Capacitação de lideranças em suporte e escuta',
        prazo: 'Curto prazo',
        objetivo: 'Desenvolver lideranças capazes de apoiar, orientar e escutar suas equipes.',
        etapas:
          'Formação em escuta ativa, feedback e detecção precoce de dificuldades; rituais de ' +
          '1:1 periódicos; orientação para acionar recursos de apoio quando necessário.',
        indicadores:
          'Percepção de "recebo apoio da liderança" em pesquisas; frequência de 1:1 realizados; ' +
          'avaliação de liderança pelas equipes.',
      },
      {
        titulo: 'Rotinas de cooperação e apoio entre pares',
        prazo: 'Curto → Médio prazo',
        objetivo: 'Fortalecer a confiança e a colaboração entre colegas diante de dificuldades.',
        etapas:
          'Rituais de time (dailies, retrospectivas); práticas de apadrinhamento/mentoria; espaços ' +
          'de troca e resolução conjunta de problemas; reconhecimento da cooperação.',
        indicadores:
          'Percepção de "posso contar com meus colegas"; nº de iniciativas colaborativas; ' +
          'clima de equipe em pesquisas.',
      },
      {
        titulo: 'Suporte organizacional e retaguarda operacional',
        prazo: 'Médio prazo',
        objetivo: 'Assegurar recursos de backup para que ninguém enfrente picos de demanda isolado.',
        etapas:
          'Definição de coberturas e planos de contingência por área; canais claros para pedir ajuda; ' +
          'redistribuição temporária de carga em picos; padrinhos para situações críticas.',
        indicadores:
          'Tempo de resposta a pedidos de ajuda; nº de situações críticas com retaguarda acionada; ' +
          'sobrecarga individual em picos.',
      },
      {
        titulo: 'Acolhimento na integração e em transições',
        prazo: 'Longo prazo',
        objetivo: 'Reduzir o desamparo de novos colaboradores e de quem passa por mudanças de função.',
        etapas:
          'Onboarding estruturado com padrinho; trilha de integração; acompanhamento nos primeiros ' +
          'ciclos; suporte dedicado em mudanças de área ou de função.',
        indicadores:
          'Rotatividade nos primeiros meses; satisfação com a integração; tempo até plena autonomia.',
      },
    ],
  },

  // ── Reconhecimento e desenvolvimento ← Identificação Laboral ─────────────────
  reconhecimento: {
    descricao:
      'Avalia o quanto o colaborador se sente reconhecido de forma justa, pertencente à organização ' +
      'e com perspectivas de desenvolvimento e crescimento. Baixa identificação laboral impacta ' +
      'engajamento e turnover, ainda que costume evoluir sem danos clínicos severos imediatos.',
    objetivo:
      'Fortalecer o reconhecimento justo, o pertencimento e as perspectivas de desenvolvimento, ' +
      'sustentando o engajamento e reduzindo a rotatividade.',
    acoes: [
      {
        titulo: 'Programa de reconhecimento justo e regular',
        prazo: 'Curto prazo',
        objetivo: 'Tornar o reconhecimento frequente, visível e percebido como justo.',
        etapas:
          'Definição de critérios transparentes de reconhecimento; rituais regulares (individuais e ' +
          'de time); valorização de conquistas por líderes e pares; correção de assimetrias percebidas.',
        indicadores:
          'Percepção de "meu trabalho é reconhecido de forma justa"; nº de reconhecimentos registrados; ' +
          'eNPS/engajamento.',
      },
      {
        titulo: 'Trilhas de desenvolvimento e crescimento',
        prazo: 'Curto → Médio prazo',
        objetivo: 'Oferecer perspectivas claras de evolução profissional na empresa.',
        etapas:
          'Mapeamento de competências por função; planos de desenvolvimento individual (PDI); ' +
          'trilhas de capacitação; conversas de carreira periódicas com a liderança.',
        indicadores:
          'Percentual de colaboradores com PDI ativo; horas de capacitação por pessoa; ' +
          'movimentações internas/promoções.',
      },
      {
        titulo: 'Ações de pertencimento e engajamento',
        prazo: 'Médio prazo',
        objetivo: 'Fortalecer o vínculo e a identificação com o propósito e os valores da organização.',
        etapas:
          'Conexão do trabalho ao propósito da empresa; celebração de marcos; rituais de time; ' +
          'canais de escuta sobre experiência do colaborador.',
        indicadores:
          'Engajamento em pesquisas; rotatividade voluntária; participação em iniciativas internas.',
      },
      {
        titulo: 'Revisão de critérios de progressão e mérito',
        prazo: 'Longo prazo',
        objetivo: 'Garantir que crescimento e recompensa sigam regras claras e equânimes.',
        etapas:
          'Revisão de políticas de promoção e remuneração; comunicação transparente dos critérios; ' +
          'calibração para reduzir viés; ciclos periódicos de avaliação.',
        indicadores:
          'Percepção de justiça nas progressões; distribuição de promoções por área/perfil; ' +
          'reclamações sobre critérios.',
      },
    ],
  },

  // ── Clareza de papel e justiça ← Clarificação de papéis / justiça organizacional
  clareza: {
    descricao:
      'Avalia a clareza sobre o que se espera de cada papel e a percepção de justiça na aplicação de ' +
      'regras e decisões. Abrange definição de responsabilidades, ausência de conflitos e desvios de ' +
      'função, consistência de critérios e equidade no tratamento das pessoas e das situações.',
    objetivo:
      'Assegurar clareza de papéis e expectativas e a aplicação justa e consistente de regras e ' +
      'decisões, reduzindo conflitos de papel e a sensação de injustiça.',
    acoes: [
      {
        titulo: 'Clarificação de papéis e revisão de descrições de cargo',
        prazo: 'Curto → Médio prazo',
        objetivo: 'Diminuir conflitos de papel e desvios de função.',
        etapas:
          'Workshop com líderes e colaboradores; atualização das descrições de cargo (job descriptions); ' +
          'comunicação formal das responsabilidades e fronteiras de cada papel.',
        indicadores:
          'Redução de relatos de desvio de função em pesquisas internas; melhora em indicadores de ' +
          'clareza de papel; nº de conflitos de atribuição.',
      },
      {
        titulo: 'Definição e comunicação de expectativas e metas',
        prazo: 'Curto prazo',
        objetivo: 'Tornar explícito o que se espera de cada pessoa e como o desempenho é avaliado.',
        etapas:
          'Acordos de expectativa por função; metas claras e mensuráveis; alinhamento em 1:1; ' +
          'documentação acessível de responsabilidades e critérios de avaliação.',
        indicadores:
          'Percepção de "sei o que se espera do meu papel"; percentual de colaboradores com metas ' +
          'definidas; alinhamento em avaliações.',
      },
      {
        titulo: 'Transparência e consistência na aplicação de regras e decisões',
        prazo: 'Médio prazo',
        objetivo: 'Reforçar a percepção de justiça organizacional (equidade processual e de tratamento).',
        etapas:
          'Publicação de políticas e critérios de decisão; padronização de processos sensíveis ' +
          '(escalas, folgas, avaliações); registro e justificativa de decisões que afetam pessoas.',
        indicadores:
          'Percepção de "regras aplicadas de forma justa"; nº de reclamações sobre tratamento desigual; ' +
          'consistência de decisões entre áreas.',
      },
      {
        titulo: 'Canais de contestação e equidade no tratamento',
        prazo: 'Longo prazo',
        objetivo: 'Garantir vias legítimas de recurso e reduzir arbitrariedades percebidas.',
        etapas:
          'Canal para dúvidas e contestação de decisões; prazos e responsáveis definidos; retorno ' +
          'estruturado; monitoramento de padrões de injustiça percebida.',
        indicadores:
          'Tempo médio de resposta a contestações; percentual de casos revisados; evolução da ' +
          'percepção de justiça em pesquisas.',
      },
    ],
  },

  // ── Relações e segurança psicológica ← Relações de Respeito + Saúde Emocional ─
  relacoes: {
    descricao:
      'Avalia a qualidade das relações no trabalho e a segurança psicológica — o quanto as pessoas se ' +
      'sentem seguras para falar de problemas sem medo de retaliação, em um ambiente livre de assédio ' +
      'e desrespeito. Integra também a saúde emocional e o bem-estar, incluindo sinais de ansiedade, ' +
      'estresse, sintomas depressivos e práticas de autocuidado, pois ambientes hostis geram sofrimento ' +
      'significativo e elevam o risco de assédio e de adoecimento.',
    objetivo:
      'Promover relações de respeito e confiança e a segurança psicológica, prevenindo assédio e ' +
      'condutas hostis e cuidando da saúde emocional e do bem-estar dos colaboradores.',
    acoes: [
      {
        titulo: 'Prevenção e enfrentamento de assédio e condutas hostis',
        prazo: 'Curto prazo',
        objetivo: 'Reduzir hostilidade e risco de assédio, com apuração segura e confidencial.',
        etapas:
          'Política de conduta e canal de denúncia com confidencialidade garantida; fluxo de apuração ' +
          'com proteção contra retaliação; capacitação sobre respeito, vieses e limites de conduta.',
        indicadores:
          'Percepção de "ambiente livre de assédio e desrespeito"; nº e desfecho de denúncias tratadas; ' +
          'tempo médio de apuração.',
      },
      {
        titulo: 'Construção de segurança psicológica e cultura de respeito',
        prazo: 'Curto → Médio prazo',
        objetivo: 'Criar um ambiente em que falar de problemas e erros seja seguro e valorizado.',
        etapas:
          'Formação de líderes em segurança psicológica e escuta; rituais de retrospectiva sem culpa; ' +
          'acordos de convivência; normalização de pedir ajuda e reportar riscos.',
        indicadores:
          'Percepção de "sinto-me seguro para falar sem medo de retaliação"; participação em rituais ' +
          'de time; nº de problemas reportados precocemente.',
      },
      {
        titulo: 'Disponibilização de suporte psicológico (EAP ou clínica parceira)',
        prazo: 'Curto prazo',
        objetivo: 'Oferecer atendimento precoce para sintomas emocionais e situações de crise.',
        etapas:
          'Contratação de EAP ou convênio com clínica parceira; processo de encaminhamento claro; ' +
          'confidencialidade garantida; divulgação recorrente do benefício.',
        indicadores:
          'Taxa de utilização do suporte; desfecho dos encaminhamentos; tempo até primeiro atendimento.',
      },
      {
        titulo: 'Campanhas de saúde mental, autocuidado e prevenção de burnout',
        prazo: 'Longo prazo',
        objetivo: 'Alfabetizar e normalizar o cuidado mental e prevenir a exaustão prolongada.',
        etapas:
          'Campanhas informativas e workshops (gestão e higiene do sono, técnicas de relaxamento); ' +
          'formação de líderes para detecção precoce; protocolos de manejo e retorno ao trabalho com ' +
          'acompanhamento; pausas ativas e ajustes ergonômicos.',
        indicadores:
          'Alcance das campanhas e mudança de autopercepção em pesquisas; casos de burnout ' +
          'diagnosticados; tempo médio de afastamento por causas emocionais.',
      },
    ],
  },
};
