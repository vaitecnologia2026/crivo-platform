import { describe, expect, it } from 'vitest';
import { emailsDoTexto } from './me.controller';

// /me/mentorias: notas e gravação só para quem PARTICIPOU (Anexo v1.1 §7).
// O participante é reconhecido pelo e-mail IGUAL — antes um `includes` fazia
// "ana@empresa.com" casar dentro de "mariana@empresa.com".
describe('emailsDoTexto (participante da mentoria)', () => {
  it('separa por vírgula, ponto e vírgula, espaço e "Nome <email>"', () => {
    expect(emailsDoTexto('Mariana Souza <Mariana@Empresa.com>; joao@empresa.com, ana@x.com')).toEqual([
      'mariana@empresa.com',
      'joao@empresa.com',
      'ana@x.com',
    ]);
  });

  it('e-mail contido em outro não é o mesmo participante', () => {
    expect(emailsDoTexto('mariana@empresa.com').includes('ana@empresa.com')).toBe(false);
    expect(emailsDoTexto('mariana@empresa.com').includes('mariana@empresa.com')).toBe(true);
  });

  it('texto sem e-mail ou vazio não tem participante', () => {
    expect(emailsDoTexto('Equipe de liderança')).toEqual([]);
    expect(emailsDoTexto(null)).toEqual([]);
  });
});
