import { describe, expect, it } from 'vitest';
import { NAV_ICONS, navIconSvg, type NavIconName } from './nav-icons';
import { NAV, renderNavHtml } from '../app/plataforma/nav.config';

describe('ícones do menu do portal (protótipo Lovable)', () => {
  it('cada ícone é só desenho de traço: path/rect/circle, sem script nem atributo de evento', () => {
    for (const [nome, marcacao] of Object.entries(NAV_ICONS)) {
      const tags = [...marcacao.matchAll(/<([a-z]+)\b/g)].map((m) => m[1]);
      expect(tags.length, nome).toBeGreaterThan(0);
      for (const t of tags) expect(['path', 'rect', 'circle'], `${nome}: <${t}>`).toContain(t);
      expect(marcacao, nome).not.toMatch(/\son[a-z]+=|script|javascript:/i);
    }
  });

  it('SVG na cor do texto e decorativo (leitor de tela lê só o rótulo)', () => {
    const svg = navIconSvg('compass');
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain(NAV_ICONS.compass);
  });

  it('Programas usa exatamente os ícones do app-sidebar.tsx do protótipo', () => {
    const programas = NAV.find((g) => g.title === 'Programas')!;
    expect(programas.items.map((i) => [i.label, i.icon])).toEqual([
      ['Liderança', 'compass'],
      ['Governança de IA', 'shield-check'],
      ['Workforce Intelligence', 'cpu'],
      ['People Analytics', 'chart-line'],
      ['Radar de Custos Invisíveis', 'coins'],
      ['Contexto e Diretrizes', 'book-open'],
      ['Academia e Recursos', 'graduation-cap'],
      ['Mentorias e Agenda', 'calendar-clock'],
    ]);
  });

  it('a sidebar gerada tem um SVG por item e nenhum glifo antigo', () => {
    const html = renderNavHtml();
    const itens = NAV.flatMap((g) => g.items).filter((i) => !i.hidden);
    expect(html.match(/<span class="ni__ic ni__ic--svg"><svg /g)?.length).toBe(itens.length);
    expect(html).not.toMatch(/[▣⚙✦◮❖◭▤▧▦◧◈◎⌬⌭◇❈▥☉★✎◬◐◌⊞✆]/);
    // O rótulo continua sendo o nó de texto ao lado do ícone — o rename pela
    // solução contratada (Plataforma.applyContractedDiagnosticLabel) depende disso.
    expect(html).toMatch(/<\/svg><\/span>Liderança\n/);
  });

  it('todo ícone usado no menu existe no mapa', () => {
    const usados = new Set<NavIconName>(NAV.flatMap((g) => g.items).map((i) => i.icon));
    for (const nome of usados) expect(NAV_ICONS[nome], nome).toBeTruthy();
  });
});
