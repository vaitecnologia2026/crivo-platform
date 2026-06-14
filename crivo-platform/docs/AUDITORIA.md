# Auditoria CRIVO — conformidade com as solicitações do cliente

> Base: `Solicitacoes cliente/` — Análise LP (orig + rev1), Análise Portal, **Briefing Funcional (Portal+Super Admin)**, **Matriz de Soluções v5 (.xlsx)**, **Complemento (Quem Somos/Como Nasceu/Riscos+IA)**.
> Data: 2026-06.

## 1. Veredito
**PARCIALMENTE CONCLUÍDO** — Landing Page e funil comercial prontos e no ar; **Portal do cliente e Super Admin incompletos** frente ao Briefing Funcional + Matriz.

## 2. O que está pronto (no ar)
- LP premium (NR-1 porta de entrada, ICD diferencial, jornada completa) — ~95% dos 2 PDFs originais.
- Funil: LP → `/public/diagnostic-lead` → PlatformLead → CRM do Super Admin → conversão lead→cliente (provisiona org + módulos).
- Super Admin: Produtos (preço/limites/módulos/perguntas editáveis/prompt de IA por produto), CRM Kanban, Empresas, Auditoria, RBAC dinâmico, MFA, white-label.
- ICD nos 4 Rs, tensão dominante, **sem ranking**, confidencialidade (mín. respondentes).
- Multi-tenant RLS; API (NestJS) + DB (Postgres) + 2 frontends (Vercel) deployados.

## 3. Pendências CRÍTICAS (impedem "concluído")
1. **Config de IA/Token ChatGPT** no Super Admin (token criptografado, teste de conexão, modelo, prompts por produto/módulo, ativar por módulo, logs) — **inexistente**.
2. **Método × Saída técnica** (AEP / AEP+PGR) — regra-mãe ausente. Essencial deve poder gerar AEP+PGR sem virar Organizacional.
3. **Plano de Ação** (CORE de todo diagnóstico) — inexistente.
4. **Evidências** (upload + vínculo à ação) — inexistente.
5. **Geração de documentos/dossiês** (AEP, AEP+PGR, inventário, relatórios) + frase de responsabilidade obrigatória — inexistente.
6. **Configuração de contrato no Super Admin** (datas, prazo, rodadas, respondentes, integração técnica, documentos, status) — inexistente.
7. **Diagnóstico Essencial** (autoavaliação, escuta, dossiê) e **Organizacional** completo — inexistente/parcial.

## 4. Ajustes importantes
- LP: seção **Como nasceu a CRIVO**, bloco **Riscos psicossociais e IA** (4 cards), escada com os **8 produtos** da Matriz (Inicial, Essencial, Organizacional, Liderança, Evolução, Enterprise, Advisory, Projetos Especiais), **foto institucional** no hero.
- **CORE × Opcional** por produto (conforme a Matriz).
- **Aceite de termos/LGPD** no 1º acesso.
- **Academia CRIVO** como CMS (upload, YouTube/LinkedIn, categorias, progresso).
- Perfis: Consultor CRIVO, Mentor, Usuário Academia.

## 5. Os 8 produtos (Matriz) — método × saída
- **Diagnóstico Inicial** (porta de entrada, leitura preliminar, sem AEP/PGR).
- **Diagnóstico Essencial** (pequenas empresas; autoavaliação + escuta + plano + dossiê AEP ou AEP+PGR).
- **Diagnóstico Organizacional** (campanha estruturada; dashboards, inventário, AEP+PGR).
- **Liderança, Evolução, Enterprise, Advisory, Projetos Especiais** (módulos: App, ICD, Academia, mentorias, People Analytics, parecer…).
- **Regra-mãe:** porte/complexidade definem o **método**; obrigação documental define a **saída técnica**. PGR não obriga Organizacional.

## 6. Plano de correção
- **Sprint 1 (crítico):** Contrato no Super Admin (datas/prazo/rodadas/respondentes/integração/status) + Método×Saída técnica + Plano de Ação + Evidências.
- **Sprint 2:** Config de IA (token/modelo/prompts/logs) + Geração de documentos + CORE×Opcional por produto.
- **Sprint 3:** Jornadas Essencial/Organizacional + LP (Como Nasceu, Riscos+IA, 8 produtos, aceite LGPD) + Academia CMS + perfis.
- **Sprint 4:** Validação por perfil + confidencialidade + demo de venda.

## 7. Critério final de aprovação
Super Admin configura cliente/contrato/produto/módulos/prazo/AEP-PGR/documentos **sem programação**; IA configurável e testável; método×saída funcionando; todo diagnóstico gera resultado+plano+evidências+documento; portal mostra só o contratado por perfil; aceite LGPD; confidencialidade (sem ranking, agregados, recorte mínimo); LP com Como Nasceu + Riscos/IA + 8 produtos; documentos com frase de responsabilidade.
