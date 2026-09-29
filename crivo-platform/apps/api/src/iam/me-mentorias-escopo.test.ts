import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@crivo/types';
import { MeController } from './me.controller';

/**
 * GET /me/mentorias em dois contextos (Spec V1 v1.2 §3):
 * - `?escopo=minhas` (Minha Jornada): só as mentorias de que a pessoa participa,
 *   qualquer que seja o papel — o Líder + Administrador não vê a agenda da
 *   empresa dentro da Jornada;
 * - sem escopo (Área da Organização): a gestão (e o MENTOR) vê a agenda, mas
 *   o link da reunião, as notas e a gravação da mentoria de OUTRO líder vêm
 *   null — o link dá entrada na mentoria privada. Sessão coletiva (attendee
 *   sem e-mail) recebe só o link — notas/gravação ficam null, pois o mesmo
 *   texto livre pode ser o NOME de um líder numa mentoria individual; quem
 *   participa (e-mail) ou o MENTOR que conduz (nome) recebe os três, mesmo
 *   na coletiva.
 */

const TENANT = 't1';

const mentoria = (id: string, attendee: string, mentorName = 'Mentor CRIVO') => ({
  id,
  title: `Mentoria ${id}`,
  format: 'ONLINE',
  mentorName,
  attendee,
  scheduledAt: new Date('2026-09-20T14:00:00Z'),
  durationMin: 60,
  meetingUrl: `https://meet.exemplo/${id}`,
  location: null,
  status: 'AGENDADA',
  notes: `notas ${id}`,
  recordingUrl: `https://gravacao.exemplo/${id}`,
});

const ROWS = [
  mentoria('minha', 'Admin Líder <admin@empresa.com>'),
  mentoria('outra', 'outro.lider@empresa.com'),
];

function build(rows = ROWS) {
  const findMany = vi.fn(async (_args: { where: Record<string, unknown> }) => rows);
  const prisma = {
    admin: {
      mentoria: { findMany },
      contract: { findFirst: vi.fn(async () => ({ contractedHours: 10 })) },
    },
  };
  const controller = new MeController({} as never, {} as never, prisma as never, {} as never, {} as never);
  return { controller, findMany };
}

const user = (role: string, email = 'admin@empresa.com', name = 'X'): SessionUser =>
  ({ id: 'u1', tenantId: TENANT, email, name, role }) as SessionUser;

const LIBERADA = (id: string) => ({
  meetingUrl: `https://meet.exemplo/${id}`,
  notes: `notas ${id}`,
  recordingUrl: `https://gravacao.exemplo/${id}`,
});
const OCULTA = { meetingUrl: null, notes: null, recordingUrl: null };
/** Sessão coletiva na visão da empresa para quem não participa nem conduz:
 *  só o link de entrada — notas/gravação ficam null (podem ser de mentoria
 *  individual cadastrada pelo nome no mesmo campo de texto livre). */
const SO_LINK = (id: string) => ({
  meetingUrl: `https://meet.exemplo/${id}`,
  notes: null,
  recordingUrl: null,
});

/** Sessão coletiva: o attendee é um grupo, sem nenhum e-mail. */
const COLETIVA = mentoria('coletiva', 'Equipe de liderança');

describe('MeController.myMentorias — escopo=minhas (Minha Jornada)', () => {
  it('ADMIN com escopo=minhas recebe só as próprias, com link, notas e gravação', async () => {
    const { controller, findMany } = build();

    const r = await controller.myMentorias(user('ADMIN'), 'minhas');

    expect(r.rows.map((m) => m.id)).toEqual(['minha']);
    expect(r.rows[0]).toMatchObject({
      meetingUrl: 'https://meet.exemplo/minha',
      notes: 'notas minha',
      recordingUrl: 'https://gravacao.exemplo/minha',
    });
    // O filtro também vai para a consulta (não só o pós-filtro exato por e-mail).
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: TENANT,
      attendee: { contains: 'admin@empresa.com', mode: 'insensitive' },
    });
  });

  it('LIDER com ou sem escopo: sempre só as próprias', async () => {
    const lider = user('LIDER', 'outro.lider@empresa.com');
    const sem = await build().controller.myMentorias(lider);
    const com = await build().controller.myMentorias(lider, 'minhas');
    expect(sem.rows.map((m) => m.id)).toEqual(['outra']);
    expect(com.rows.map((m) => m.id)).toEqual(['outra']);
  });

  it('escopo desconhecido é ignorado (segue a visão do papel)', async () => {
    const r = await build().controller.myMentorias(user('ADMIN'), 'todas');
    expect(r.rows.map((m) => m.id)).toEqual(['minha', 'outra']);
  });
});

describe('MeController.myMentorias — visão da empresa (sem escopo)', () => {
  it('gestão vê a agenda inteira, mas link/notas/gravação só das mentorias de que participa', async () => {
    const { controller, findMany } = build();

    const r = await controller.myMentorias(user('ADMIN'));

    expect(r.rows.map((m) => m.id)).toEqual(['minha', 'outra']);
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
    const outra = r.rows.find((m) => m.id === 'outra')!;
    expect(outra).toMatchObject({ meetingUrl: null, notes: null, recordingUrl: null });
    // A agenda em si continua visível (título, participante, data, status).
    expect(outra).toMatchObject({ title: 'Mentoria outra', attendee: 'outro.lider@empresa.com', status: 'AGENDADA' });
    const minha = r.rows.find((m) => m.id === 'minha')!;
    expect(minha.meetingUrl).toBe('https://meet.exemplo/minha');
  });

  it('contractedHours acompanha nos dois escopos', async () => {
    expect((await build().controller.myMentorias(user('RH'))).contractedHours).toBe(10);
    expect((await build().controller.myMentorias(user('RH'), 'minhas')).contractedHours).toBe(10);
  });
});

describe('MeController.myMentorias — sessão coletiva (attendee sem e-mail)', () => {
  const rows = [...ROWS, COLETIVA];

  it('gestão sem escopo recebe o link da coletiva, mas não notas/gravação; a de outro e-mail segue oculta', async () => {
    const r = await build(rows).controller.myMentorias(user('ADMIN'));
    expect(r.rows.map((m) => m.id)).toEqual(['minha', 'outra', 'coletiva']);
    expect(r.rows.find((m) => m.id === 'coletiva')).toMatchObject(SO_LINK('coletiva'));
    expect(r.rows.find((m) => m.id === 'outra')).toMatchObject(OCULTA);
  });

  it('coletiva na visão da empresa: link sim, notas e gravação não (attendee sem e-mail pode ser mentoria individual pelo nome)', async () => {
    const r = await build(rows).controller.myMentorias(user('RH'));
    const coletiva = r.rows.find((m) => m.id === 'coletiva')!;
    expect(coletiva.meetingUrl).toBe('https://meet.exemplo/coletiva');
    expect(coletiva.notes).toBeNull();
    expect(coletiva.recordingUrl).toBeNull();
  });

  it('LIDER (com ou sem escopo) e escopo=minhas não recebem a coletiva', async () => {
    const lider = user('LIDER', 'outro.lider@empresa.com');
    expect((await build(rows).controller.myMentorias(lider)).rows.map((m) => m.id)).toEqual(['outra']);
    expect((await build(rows).controller.myMentorias(lider, 'minhas')).rows.map((m) => m.id)).toEqual(['outra']);
    expect((await build(rows).controller.myMentorias(user('ADMIN'), 'minhas')).rows.map((m) => m.id)).toEqual([
      'minha',
    ]);
  });
});

describe('MeController.myMentorias — papel MENTOR (conduz as sessões)', () => {
  const rows = [
    mentoria('conduzida', 'lider.a@empresa.com', 'Ana Conceição'),
    mentoria('de-outro', 'lider.b@empresa.com', 'Outro Mentor'),
    COLETIVA,
  ];
  // Nome gravado com outra caixa, sem acento e com espaços: é a mesma pessoa.
  const mentor = user('MENTOR', 'ana@crivo.com', '  ana  conceicao ');

  it('sem escopo vê a agenda da empresa inteira', async () => {
    const { controller, findMany } = build(rows);
    const r = await controller.myMentorias(mentor);
    expect(r.rows.map((m) => m.id)).toEqual(['conduzida', 'de-outro', 'coletiva']);
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
  });

  it('recebe link, notas e gravação da sessão que conduz; da coletiva (que não conduz) só o link; nada das individuais de outro mentor', async () => {
    const r = await build(rows).controller.myMentorias(mentor);
    expect(r.rows.find((m) => m.id === 'conduzida')).toMatchObject(LIBERADA('conduzida'));
    expect(r.rows.find((m) => m.id === 'de-outro')).toMatchObject(OCULTA);
    expect(r.rows.find((m) => m.id === 'coletiva')).toMatchObject(SO_LINK('coletiva'));
  });

  it('MENTOR que conduz a coletiva (mentorName bate com o seu nome) recebe os três', async () => {
    const coletivaConduzida = mentoria('coletiva-conduzida', 'Diretoria e RH', 'Ana Conceição');
    const { controller } = build([coletivaConduzida]);
    const r = await controller.myMentorias(mentor);
    expect(r.rows.find((m) => m.id === 'coletiva-conduzida')).toMatchObject(LIBERADA('coletiva-conduzida'));
  });

  it('sem conduzir nenhuma (outro nome), as individuais vêm ocultas', async () => {
    const r = await build(rows).controller.myMentorias(user('MENTOR', 'bia@crivo.com', 'Bia'));
    expect(r.rows.map((m) => m.id)).toEqual(['conduzida', 'de-outro', 'coletiva']);
    expect(r.rows.find((m) => m.id === 'conduzida')).toMatchObject(OCULTA);
    expect(r.rows.find((m) => m.id === 'de-outro')).toMatchObject(OCULTA);
  });

  it('o nome do mentor só libera para o papel MENTOR (gestão homônima não ganha a individual)', async () => {
    const r = await build(rows).controller.myMentorias(user('ADMIN', 'admin@empresa.com', 'Ana Conceição'));
    expect(r.rows.find((m) => m.id === 'conduzida')).toMatchObject(OCULTA);
  });

  it('com escopo=minhas segue só as de que participa por e-mail (nenhuma)', async () => {
    const r = await build(rows).controller.myMentorias(mentor, 'minhas');
    expect(r.rows).toEqual([]);
  });
});
