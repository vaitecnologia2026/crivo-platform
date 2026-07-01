import type { NotificationChannel } from '@crivo/types';

/**
 * Registry ESTÁTICO dos gatilhos de notificação REAIS do sistema (auditoria
 * FASE 1). NÃO inventar gatilhos: cada item aqui corresponde a um ponto de
 * disparo que já existe no código. O rótulo/descrição PT-BR vivem aqui (não no
 * banco); o banco guarda apenas o override de ativação por canal.
 *
 * Audiência do push (sobre dados que já existem):
 *  - 'users': tokens dos próprios destinatários (mesmos do e-mail).
 *  - 'topic': tópico FCM da equipe CRIVO (eventos internos: lead/relatório).
 */
export type PushAudience =
  | { kind: 'users' }
  | { kind: 'topic'; topic: string };

export interface NotificationTrigger {
  key: string;
  label: string;
  description: string;
  event: string;
  channels: NotificationChannel[];
  pushAudience: PushAudience;
}

/** Tópico FCM que a equipe CRIVO assina para alertas internos. */
export const CRIVO_TEAM_TOPIC = 'crivo-team';

export const NOTIFICATION_TRIGGERS: readonly NotificationTrigger[] = [
  {
    key: 'icd.lembrete_campanha',
    label: 'Lembrete de campanha de diagnóstico',
    description:
      'Avisa os respondentes pendentes de um ciclo de diagnóstico ICD que ainda precisam responder.',
    event: 'Admin aciona "enviar lembrete" da campanha (icd.service)',
    channels: ['email', 'push'],
    pushAudience: { kind: 'users' },
  },
  {
    key: 'relatorio_preliminar.enviado',
    label: 'Relatório preliminar enviado',
    description:
      'Relatório preliminar (IA) do Diagnóstico Inicial enviado ao lead. O push avisa a equipe CRIVO.',
    event: 'Geração/reenvio do relatório preliminar (preliminary-reports.service)',
    channels: ['email', 'push'],
    pushAudience: { kind: 'topic', topic: CRIVO_TEAM_TOPIC },
  },
  {
    key: 'site.lead_novo',
    label: 'Novo lead do site',
    description: 'Formulário de lead recebido no site. O push avisa a equipe CRIVO.',
    event: 'POST /api/lead (apps/site)',
    channels: ['email', 'push'],
    pushAudience: { kind: 'topic', topic: CRIVO_TEAM_TOPIC },
  },
  {
    key: 'site.diagnostico_lead',
    label: 'Novo diagnóstico inicial (site)',
    description: 'Quiz de diagnóstico inicial concluído no site. O push avisa a equipe CRIVO.',
    event: 'POST /api/diagnostic-lead (apps/site)',
    channels: ['email', 'push'],
    pushAudience: { kind: 'topic', topic: CRIVO_TEAM_TOPIC },
  },
] as const;

/** Papéis (User.role) cujos dispositivos assinam o tópico da equipe CRIVO. */
export const CRIVO_TEAM_ROLES = new Set(['ADMIN', 'CEO', 'RH']);

export function findTrigger(key: string): NotificationTrigger | undefined {
  return NOTIFICATION_TRIGGERS.find((t) => t.key === key);
}
