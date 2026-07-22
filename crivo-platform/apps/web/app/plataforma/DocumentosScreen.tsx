"use client";

import { DocumentsPanel } from "./DocumentsPanel";

/**
 * Relatórios e Dossiês — rota dedicada (mockup Portal do Cliente 22/07).
 * "Repositório versionado de comunicações, prévias, planos e dossiês técnicos."
 * Antes o DocumentsPanel vivia escondido dentro do Plano de Ação (achado da
 * auditoria B/§15); agora é uma entrada de 1º nível do Portal, como o motor
 * de Relatórios (Motor 4) pede. A elegibilidade continua 100% no servidor
 * (contrato → método × saída técnica → gates do §9).
 */
export function DocumentosScreen() {
  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Relatórios e Dossiês</h1>
          <p className="page-sub">
            Documentos técnicos do seu contrato — prévias, plano aprovado, dossiês (AEP/GRO-PGR) e
            relatórios de evolução. O que aparece aqui é definido pela sua contratação; documentos
            bloqueados mostram o motivo e o caminho de correção.
          </p>
        </div>
      </div>
      <DocumentsPanel />
    </>
  );
}
