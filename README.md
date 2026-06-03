<div align="center">

# CRIVO™ — Decision Intelligence System
**Design System · Landing Page · Plataforma**

*A linguagem visual e os entregáveis digitais da CRIVO™ — autoridade, rigor e clareza em cada ponto de contato.*

`v1.0` · Brand Identity System V3.0 · O2 Legacy & Consulting

</div>

---

> ⚛️ **Migrado para React.** Desde 06/2026, o desenvolvimento acontece em **React (Next.js 16 + Tailwind v4 + `@crivo/ui`)** no monorepo **`crivo-platform/`**. Todo ajuste/melhoria deve seguir esse padrão — veja **[`CLAUDE.md`](CLAUDE.md)**. Os arquivos estáticos descritos abaixo são **legado** que ainda serve a produção até o cutover do domínio.

## 1. Visão geral

> _Histórico — versão estática original, em processo de aposentadoria:_

Repositório estático (HTML + CSS + JS, sem build) que reúne três entregáveis coesos sob a mesma identidade de marca:

| Entregável | Pasta | Descrição |
|---|---|---|
| **Design System** | `index.html` · `ds.css` | Showcase navegável: princípios, marca, cores, tipografia, componentes, motion e voz. |
| **Landing Page** | `CRIVO-LP/` | Página comercial — hero, problema, método, ICD, NR-1, soluções, diagnóstico e FAQ. |
| **Plataforma** | `CRIVO-PLATAFORMA/` | Protótipo navegável — login, dashboard executivo, ICD, questionário NR-1, área do líder e relatórios. |

Fundamentos compartilhados na raiz:

| Arquivo | Papel |
|---|---|
| `tokens.css` | **Fonte única de verdade** dos design tokens (`--crivo-*` canônicos + aliases). |
| `favicon.svg` | Marca "O Vértice" como favicon, usada por todas as páginas. |
| `logger.js` | Sistema de **observabilidade** hierárquico compartilhado (ver §4). |
| `CRIVO-LP/COPY-CRIVO.md` | Bíblia de copy, posicionamento e tom de voz. |

---

## 2. Como executar

Não há build nem dependências. Abra qualquer `index.html` no navegador:

```bash
open index.html                      # Design System
open CRIVO-LP/index.html             # Landing Page
open CRIVO-PLATAFORMA/index.html     # Plataforma (login → qualquer credencial entra; é mockado)
```

> Para servir via HTTP (recomendado para inspecionar o `localStorage` e o nível de log de produção):
> `python3 -m http.server` e acesse `http://localhost:8000`.

---

## 3. Design tokens

Arquitetura em camadas, conforme metodologia de design system:

```
GLOBAL   --crivo-azul-profundo: #0D1F3C;      (valor bruto, canônico)
  ↓
ALIAS    --azul-profundo: var(--crivo-azul-profundo);   (semântico, por app)
  ↓
USO      color: var(--azul-profundo);
```

- **Cores** — Azuis estruturais (base) · Neutros sofisticados · **Terra** (acento exclusivo: ponto do vértice, CTAs, sublinhados, citações — *nunca* fundo dominante).
- **Tipografia** — Lora (display/serif) + Poppins (corpo/sans) + Cormorant Garamond (wordmark). O contraste serif/sans **é** a identidade.
- **Escala 4pt**, radius sóbrio (2–10px), sombras e motion (`easeOutExpo`).

Cada página mantém uma camada semântica local que **aponta para o token canônico** com fallback literal — ex.: `--shadow-1: var(--crivo-shadow-1, 0 2px 16px ...)`. Isso elimina divergência de valores e mantém a página resiliente mesmo se `tokens.css` não carregar.

---

## 4. Observabilidade — `logger.js`

Logger hierárquico compartilhado, carregado **antes** do script de cada app. Funciona em `file://` e `http(s)://`, sem módulos.

### Duas hierarquias

**1 · Severidade** (crescente, com filtro por limiar):

```
DEBUG  →  INFO  →  WARN  →  ERROR  →  SILENT
```

**2 · Namespace** (árvore encadeável via `.child()`):

```
crivo
├── crivo:lp            ├── crivo:plataforma        └── crivo:ds
│   ├── crivo:lp:form   │   ├── crivo:plataforma:auth    ├── crivo:ds:motion
│   ├── crivo:lp:nav    │   ├── crivo:plataforma:router  └── crivo:ds:nav
│   ├── crivo:lp:reveal │   ├── crivo:plataforma:quiz
│   └── crivo:lp:ebook  │   └── crivo:plataforma:chat
```

### Uso

```js
var log = window.CRIVO.log.create('crivo:lp');   // logger de namespace
var formLog = log.child('form');                 // → crivo:lp:form

formLog.info('pré-diagnóstico submetido', payload);
formLog.warn('e-mail não-corporativo bloqueado');
log.time('render', () => renderHeavy());         // mede duração e loga em DEBUG
```

### Controle do nível em runtime

| Mecanismo | Exemplo | Prioridade |
|---|---|---|
| `localStorage` | `localStorage.setItem('CRIVO_LOG_LEVEL','DEBUG')` | 1ª |
| Global pré-carga | `window.CRIVO_LOG_LEVEL = 'WARN'` | 2ª |
| API em runtime | `CRIVO.log.setLevel('ERROR')` | — |

Padrão: **DEBUG** em `localhost`/`file://`, **WARN** em produção. Cada linha exibe badge colorido (paleta CRIVO), namespace e timestamp `HH:MM:SS.mmm`.

---

## 5. Convenções de marca (resumo)

- O triângulo **nunca fecha** — a base aberta representa o sistema em movimento.
- O símbolo **nunca** aparece sem o ponto terra (o ICD).
- Lora **nunca** é substituída por sans nos títulos.
- Voz: rigorosa, técnica, baseada em evidência. **Sem** coaching, motivacional ou paleta de bem-estar.

> Diretrizes completas no Design System (`index.html`) e em `CRIVO-LP/COPY-CRIVO.md`.

---

<div align="center">

© 2026 CRIVO™ — Decision Intelligence System · O2 Legacy & Consulting · Confidencial · LGPD

</div>
