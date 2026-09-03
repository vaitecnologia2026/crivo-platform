import 'reflect-metadata'; // decorators do class-validator fora do contexto do Nest
import { describe, expect, it } from 'vitest';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SubmitPsychosocialDto } from './dto';
import { SubmitByTokenDto } from '../collaborators/dto';

/**
 * O teto do array de respostas estava amarrado ao questionário EMBUTIDO (12
 * perguntas). Publicado o Organizacional de 40 no Motor, todo envio voltava
 * 400 "answers must contain no more than 12 elements" — ninguém conseguia
 * responder, nem pelo portal nem pelos links públicos.
 */
const respostas = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ questionId: i + 1, value: 3 }));

describe('limite de respostas aceito pelo envio', () => {
  it('aceita as 40 perguntas do Organizacional publicado', () => {
    const dto = plainToInstance(SubmitPsychosocialDto, { answers: respostas(40) });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('aceita 40 também pelo link do colaborador', () => {
    const dto = plainToInstance(SubmitByTokenDto, { cpf: '52998224725', answers: respostas(40) });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('mantém um teto de sanidade (200) contra payload abusivo', () => {
    const dto = plainToInstance(SubmitPsychosocialDto, { answers: respostas(201) });
    const erros = validateSync(dto);
    expect(erros.length).toBeGreaterThan(0);
    expect(JSON.stringify(erros)).toContain('200');
  });

  it('continua recusando nota fora da escala 1–5', () => {
    const dto = plainToInstance(SubmitPsychosocialDto, {
      answers: [{ questionId: 1, value: 9 }],
    });
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });
});
