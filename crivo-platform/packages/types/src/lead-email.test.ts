import { describe, expect, it } from 'vitest';
import {
  leadEmailSubject,
  leituraDoIndice,
  renderLeadEmailHtml,
  renderLeadEmailText,
  type LeadEmailOptions,
} from './lead-email';

const BASE: LeadEmailOptions = {
  firstName: 'Rodrigo',
  company: 'O2 Testes',
  score: 51,
  bandLabel: 'Em estruturação',
  attachments: [
    { label: 'seu Relatório Preliminar do MAPA Executivo CRIVO™' },
    { label: 'o e-book complementar CRIVO', detail: 'com uma leitura ampliada' },
  ],
  note: 'Não substitui diagnóstico técnico.',
};

describe('renderLeadEmailHtml — layout aprovado em 2026-09-04', () => {
  it('traz os cinco ajustes que o cliente pediu', () => {
    const html = renderLeadEmailHtml(BASE);
    // 1. logo oficial no cabeçalho (imagem, porque e-mail não renderiza SVG)
    expect(html).toContain('crivo-marca-email.png');
    // 2. título do cabeçalho
    expect(html).toContain('MAPA Executivo CRIVO&#8482;');
    expect(html).toContain('Sua leitura preliminar');
    // 3. corpo enxuto: índice + leitura + anexos
    expect(html).toContain('Seu índice preliminar');
    expect(html).toContain('Leitura: <strong>Em estruturação</strong>');
    expect(html).toContain('Em anexo, você recebe:');
    // 4. CTA institucional
    expect(html).toContain('CONHECER A CRIVO');
    // 5. nota técnica + contatos
    expect(html).toContain('Sobre esta leitura');
    expect(html).toContain('contato@crivolegacy.com.br');
  });

  it('só promete o anexo que existe', () => {
    const html = renderLeadEmailHtml({ ...BASE, attachments: [] });
    expect(html).not.toContain('Em anexo');
    expect(html).not.toContain('e-book');
  });

  it('sem índice, o bloco do resultado não sai', () => {
    // O envio de garantia pode não ter o diagnóstico em mãos; melhor um e-mail
    // sem o bloco do que um bloco vazio ou com número inventado.
    const html = renderLeadEmailHtml({ ...BASE, score: null });
    expect(html).not.toContain('Seu índice preliminar');
    expect(html).toContain('CONHECER A CRIVO');
  });

  it('escapa o que vem do formulário público', () => {
    const html = renderLeadEmailHtml({ ...BASE, company: '<script>x</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('mostra 51,3 e não 51.30', () => {
    expect(renderLeadEmailHtml({ ...BASE, score: 51.3 })).toContain('>51,3<');
    expect(renderLeadEmailHtml({ ...BASE, score: 51 })).toContain('>51<');
  });
});

describe('leituraDoIndice', () => {
  it('não fala em ponto de atenção para quem foi bem', () => {
    // Era o "resultado contraditório" apontado pelo cliente: 100/100 saía com
    // a mesma frase de alerta de quem tirou 20.
    expect(leituraDoIndice(100)).toContain('boa consistência');
    expect(leituraDoIndice(100)).not.toContain('pontos de atenção relevantes');
  });

  it('alerta quando o índice é baixo', () => {
    expect(leituraDoIndice(51)).toContain('pontos de atenção relevantes');
  });
});

describe('leadEmailSubject', () => {
  it('usa a empresa quando existe', () => {
    expect(leadEmailSubject('O2 Testes')).toBe('Seu MAPA Executivo CRIVO — O2 Testes');
    expect(leadEmailSubject('  ')).toBe('Seu MAPA Executivo CRIVO');
    expect(leadEmailSubject(null)).toBe('Seu MAPA Executivo CRIVO');
  });
});

describe('renderLeadEmailText', () => {
  it('carrega o mesmo conteúdo sem HTML', () => {
    const txt = renderLeadEmailText(BASE);
    expect(txt).toContain('Olá, Rodrigo.');
    expect(txt).toContain('Seu índice preliminar: 51/100');
    expect(txt).toContain('Leitura: Em estruturação');
    expect(txt).toContain('- seu Relatório Preliminar do MAPA Executivo CRIVO™');
    expect(txt).not.toContain('<');
  });
});
