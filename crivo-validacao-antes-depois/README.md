# CRIVO™ — Validação Antes / Depois (Landing Page)

Pacote de validação do **refinamento da LP** com base no briefing final e na pasta de referências do cliente.

## Estrutura

```
crivo-validacao-antes-depois/
├── README.md                         ← este arquivo
├── referencias/                      ← 12 simulações enviadas pelo cliente (antes/depois por seção)
├── antes/                            ← estado anterior (ver NOTAS-antes.md)
├── depois/                           ← estado novo (ver NOTAS-depois.md)
└── checklist/
    └── checklist-ajustes-crivo.md    ← MAPA COMPLETO: seção a seção, antes→depois, referência, status
```

## Como validar

1. Abra **`checklist/checklist-ajustes-crivo.md`** — é o documento principal: cada seção tem o que estava antes, o que mudou, qual referência foi usada e o status (✅ pronto · 🟡 validar · ⏳ evolução).
2. Compare com as imagens em **`referencias/`** (suas próprias simulações "COMO ESTÁ" × "COMO DEVE FICAR").
3. Veja ao vivo: a LP é React/HTML real. Preview de desenvolvimento em `http://localhost:4192/lp`; produção em `https://crivo.vai-sistema.com/lp` (após deploy).

## Resumo do que mudou (1 linha cada)

- **Header** → azul-marinho fixo, com menu final (Início · Soluções · Método CRIVO · Plataforma · Conteúdos · Sobre) + 2 botões.
- **Hero 1** → claro, Foto 1 (equipe caminhando), texto aprovado, sem NR-1.
- **Hero 2** (novo) → navy, Foto 3 (reunião), "qualidade das decisões em ambientes complexos".
- **Desafios da Transformação** → renomeado de "O Problema", 4 cards executivos.
- **ICD** → diagrama radial proprietário, eixos **Clareza · Critério · Alinhamento · Sustentação** (4 Rs removidos).
- **Diagnóstico Inicial** → + pergunta de governança.
- **FAQ** → + "Como a CRIVO apoia governança, liderança e IA na prática?".
- **Footer** → Soluções · Plataforma · Conteúdos · Sobre · Contato.
- **Termo "riscos humanos"** → eliminado da LP.
