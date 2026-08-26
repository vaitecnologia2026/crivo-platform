"use client";

import { useEffect, useRef, useState } from "react";
import {
  createReportTemplate,
  deleteReportTemplate,
  importReportTemplateDocx,
  listReportInstrumentOptions,
  listReportTemplates,
  updateReportTemplate,
  type ReportInstrumentOption,
  type ReportTemplateRow,
  type ReportTemplateSection,
  type UpsertReportTemplateRequest,
} from "@/lib/admin-api";
import { renderDocumentHtml } from "../plataforma/DocumentsPanel";
import { RESPONSIBILITY_NOTE, type GeneratedDocument } from "@crivo/types";

/** Lê um arquivo como base64 puro (sem o prefixo data:). Padrão do CustomPromptsPanel. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      const c = url.indexOf(",");
      resolve(c >= 0 ? url.slice(c + 1) : url);
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

type FormState = {
  id: string | null;
  name: string;
  description: string;
  instrumentSlug: string;
  sections: ReportTemplateSection[];
  includeResults: boolean;
  includeDimensions: boolean;
  includePlan: boolean;
  active: boolean;
};

// Templates-base do Pacote Final (Motor de Relatórios e Dossiês). São os
// documentos NATIVOS do sistema — gerados no Portal do Cliente conforme o
// método/saída do contrato. Aqui ficam como referência (não editáveis).
const BASE_TEMPLATES: {
  id: string;
  name: string;
  origin: string;
  event: string;
  condition: string;
}[] = [
  {
    id: "TPL-001",
    name: "Relatório Executivo do MAPA CRIVO™",
    origin: "MAPA Executivo CRIVO™",
    event: "MAPA concluído e leitura aprovada",
    condition: "Sempre; não é documento técnico NR-1",
  },
  {
    id: "TPL-002",
    name: "Dossiê Técnico de Fatores de Riscos Psicossociais",
    origin: "Diagnóstico Essencial ou Organizacional",
    event: "Plano aprovado + validações concluídas",
    condition: "Template único; blocos por método (Essencial/Organizacional) e saída (AEP / AEP+GRO/PGR)",
  },
  {
    id: "TPL-003",
    name: "Relatório de Evolução e Efetividade",
    origin: "Novo ciclo Essencial ou Organizacional",
    event: "Segundo ciclo comparável e validação concluída",
    condition: "Somente quando existir comparação válida (2+ ciclos)",
  },
  {
    id: "TPL-004",
    name: "Extrato do Plano de Ação Preventivo",
    origin: "Plano de Evolução",
    event: "Exportação solicitada pelo cliente",
    condition: "Opcional; mesmo plano, sem cadastro duplicado",
  },
];

const EMPTY: FormState = {
  id: null,
  name: "",
  description: "",
  instrumentSlug: "",
  sections: [{ heading: "", body: "" }],
  includeResults: true,
  includeDimensions: true,
  includePlan: false,
  active: true,
};

/**
 * Modelos de relatório do Motor 4 — cada modelo é VINCULADO a um diagnóstico do
 * Motor de Diagnósticos (cultura, NR-1, IA, governança…). Ao salvar, o relatório
 * passa a aparecer no Portal do Cliente das empresas que aplicaram aquele
 * diagnóstico, e o conteúdo é montado com o resultado real do motor.
 */
export function ReportTemplatesPanel({ instrumentSlug }: { instrumentSlug?: string } = {}) {
  const [rows, setRows] = useState<ReportTemplateRow[] | null>(null);
  const [instruments, setInstruments] = useState<ReportInstrumentOption[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /** Monta um GeneratedDocument de EXEMPLO fiel ao gerador real do portal
   *  (generateFromTemplate): seções do form + blocos dinâmicos com valores de
   *  amostra + conclusão/controle documental. Renderizado com o MESMO
   *  renderDocumentHtml do portal — o preview é o documento de verdade. */
  function buildPreviewDoc(f: FormState): GeneratedDocument {
    const instrumentName = instruments.find((i) => i.slug === f.instrumentSlug)?.name ?? f.instrumentSlug;
    const sections: GeneratedDocument["sections"] = f.sections
      .filter((s) => s.heading.trim() || s.body.trim())
      .map((s) => ({ heading: s.heading.trim() || "Contexto", body: s.body }));
    if (f.includeResults) {
      sections.push({
        heading: "Resultado do diagnóstico",
        body:
          `Resultado agregado de "${instrumentName}" com base em 12 respondente(s) em 3 setor(es). ` +
          "Resultado coletivo — nenhuma resposta individual é exibida ou identificável. (valores de exemplo)",
        rows: [
          { label: "Índice do diagnóstico (0–100)", value: "62,5" },
          { label: "Faixa", value: "Faixa de exemplo" },
          { label: "Respondentes", value: "12" },
          { label: "Última resposta", value: new Date().toLocaleDateString("pt-BR") },
        ],
      });
    }
    if (f.includeDimensions) {
      sections.push({
        heading: "Resultado por dimensão",
        body: "Média por dimensão da versão da metodologia ativa no período. (valores de exemplo)",
        table: {
          columns: ["Dimensão", "Índice (0–100)"],
          data: [
            ["Dimensão exemplo A", "58,3"],
            ["Dimensão exemplo B", "71,0"],
            ["Dimensão exemplo C", "45,8"],
          ],
        },
      });
    }
    if (f.includePlan) {
      sections.push({
        heading: "Plano de Evolução vinculado",
        body: 'Ações registradas em "Plano de Evolução" (exemplo).',
        table: {
          columns: ["Ponto de atenção", "Ação", "Responsável", "Prazo", "Risco", "Status"],
          data: [["Exemplo de ponto", "Ação de exemplo", "RH", "30 dias", "Moderado", "Em andamento"]],
        },
      });
    }
    sections.push({
      heading: "Conclusão e validação",
      body:
        "A revisão, validação e integração formal deste relatório às obrigações aplicáveis são de " +
        "responsabilidade da empresa contratante e/ou do responsável técnico/designado.",
      table: {
        columns: ["Responsável", "Nome", "Cargo", "Registro profissional", "Data", "Assinatura"],
        data: [
          ["Empresa", "", "", "", "", ""],
          ["Responsável técnico/designado", "", "", "", "", ""],
        ],
      },
    });
    sections.push({
      heading: "Controle documental",
      rows: [
        { label: "Status do documento", value: "Rascunho (pré-visualização)" },
        { label: "Versão do documento", value: "Atribuída na emissão oficial" },
        { label: "Data de emissão", value: "—" },
        { label: "Validação", value: "Assinatura fora do sistema (empresa e responsável técnico)" },
        { label: "Hash/Identificador", value: "Atribuído na emissão oficial" },
      ],
    });
    return {
      type: "preview",
      title: f.name.trim() || "Relatório sem nome",
      // Evita "…ao diagnóstico Diagnóstico Organizacional" quando o nome do
      // instrumento já começa com "Diagnóstico".
      subtitle:
        f.description.trim() ||
        (/^diagn[óo]stico/i.test(instrumentName)
          ? `Relatório vinculado ao ${instrumentName}`
          : `Relatório vinculado ao diagnóstico ${instrumentName}`),
      company: "Empresa Exemplo S.A.",
      generatedAt: new Date().toISOString(),
      // Mesmos campos do gerador real (documents.service.generateFromTemplate),
      // no padrão do modelo oficial: grade de pares, sem campo vazio.
      meta: [
        { label: "Organização", value: "Empresa Exemplo S.A." },
        { label: "CNPJ", value: "00.000.000/0001-00" },
        { label: "Método aplicado", value: instrumentName },
        { label: "Data de emissão", value: new Date().toLocaleDateString("pt-BR") },
        { label: "Saída técnica", value: "Apoio à AEP" },
        { label: "Respostas válidas", value: "12" },
      ],
      sections,
      responsibilityNote: RESPONSIBILITY_NOTE,
    };
  }

  async function load() {
    setStatus("loading");
    try {
      const [list, opts] = await Promise.all([listReportTemplates(), listReportInstrumentOptions()]);
      setRows(list);
      setInstruments(opts);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void load(); }, []);

  function openNew() {
    // No Motor de Diagnósticos o modelo já nasce vinculado ao diagnóstico selecionado.
    setForm({ ...EMPTY, instrumentSlug: instrumentSlug ?? instruments[0]?.slug ?? "" });
  }
  function openEdit(r: ReportTemplateRow) {
    setForm({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      instrumentSlug: r.instrumentSlug,
      sections: r.sections.length ? r.sections : [{ heading: "", body: "" }],
      includeResults: r.includeResults,
      includeDimensions: r.includeDimensions,
      includePlan: r.includePlan,
      active: r.active,
    });
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    setImportMsg(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setImportMsg(`✕ "${file.name}" excede 8 MB.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setImporting(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await importReportTemplateDocx({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        dataBase64,
      });
      // Abre o editor pré-preenchido (vínculo do diagnóstico do Motor é mantido)
      // e já mostra a pré-visualização de como o relatório vai ficar.
      // O padrão detectado define o esqueleto E as opções de injeção automática
      // (o que é dinâmico no modelo oficial não vira texto fixo).
      const imported: FormState = {
        ...EMPTY,
        instrumentSlug: instrumentSlug ?? instruments[0]?.slug ?? "",
        name: res.name,
        sections: res.sections.length ? res.sections : [{ heading: "", body: "" }],
        includeResults: res.suggested?.includeResults ?? EMPTY.includeResults,
        includeDimensions: res.suggested?.includeDimensions ?? EMPTY.includeDimensions,
        includePlan: res.suggested?.includePlan ?? EMPTY.includePlan,
      };
      setForm(imported);
      setPreviewHtml(renderDocumentHtml(buildPreviewDoc(imported)));
      const warn = res.warnings.length ? ` ${res.warnings.join(" ")}` : "";
      setImportMsg(`✓ Importado de "${file.name}" · padrão: ${res.patternLabel}.${warn} Revise as seções e salve.`);
    } catch (e) {
      setImportMsg(`✕ ${e instanceof Error ? e.message : "Falha ao importar o documento."}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }
  function setSection(i: number, patch: Partial<ReportTemplateSection>) {
    setForm((f) =>
      f ? { ...f, sections: f.sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) } : f,
    );
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { alert("Informe o nome do relatório."); return; }
    if (!form.instrumentSlug) { alert("Vincule o relatório a um diagnóstico do Motor de Diagnósticos."); return; }
    setSaving(true);
    try {
      const dto: UpsertReportTemplateRequest = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        instrumentSlug: form.instrumentSlug,
        sections: form.sections.filter((s) => s.heading.trim() || s.body.trim()),
        includeResults: form.includeResults,
        includeDimensions: form.includeDimensions,
        includePlan: form.includePlan,
        active: form.active,
      };
      if (form.id) await updateReportTemplate(form.id, dto);
      else await createReportTemplate(dto);
      setForm(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao salvar o modelo.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: ReportTemplateRow) {
    if (!window.confirm(`Remover o modelo “${r.name}”? Emissões já feitas continuam no repositório.`)) return;
    setBusyId(r.id);
    try {
      const res = await deleteReportTemplate(r.id);
      if (res.deactivatedInsteadOfDeleted) {
        alert(`O modelo tem ${res.emitted} emissão(ões) no repositório — foi DESATIVADO em vez de excluído, para preservar o histórico.`);
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao remover.");
    } finally {
      setBusyId(null);
    }
  }

  if (status === "loading") return <p className="dash-state">Carregando modelos…</p>;
  if (status === "error") return <div className="dash-state dash-state--error">Não foi possível carregar os modelos de relatório.</div>;

  return (
    <>
      <div className="crm-panel" style={{ marginBottom: 20 }}>
        <span className="crm-panel__title">Templates-base do sistema (Pacote Final)</span>
        <p className="prod-note" style={{ margin: "4px 0 12px" }}>
          Documentos nativos do Motor de Relatórios. São gerados no Portal do Cliente conforme o
          método e a saída técnica do contrato — o motor não calcula nada, só aplica as condições
          abaixo e renderiza o PDF. Não são editáveis.
        </p>
        <div className="addx-wrap">
          <table className="addx-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Template</th>
                <th>Origem</th>
                <th>Evento de geração</th>
                <th>Condição</th>
              </tr>
            </thead>
            <tbody>
              {BASE_TEMPLATES.map((t) => (
                <tr key={t.id}>
                  <td className="cell-code"><code>{t.id}</code></td>
                  <td className="addx-name"><strong>{t.name}</strong></td>
                  <td>{t.origin}</td>
                  <td>{t.event}</td>
                  <td>{t.condition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Relatórios adicionais por diagnóstico</h3>
      <div className="adm-callout">
        Cada modelo é <strong>vinculado a um diagnóstico</strong> do Motor de Diagnósticos. Ao ativar,
        o relatório aparece no Portal do Cliente das empresas que aplicaram aquele diagnóstico — e o
        conteúdo é montado com o <strong>resultado real</strong> (índice, faixa e dimensões da
        metodologia ativa), respeitando o mínimo de respondentes definido em Configuração do Motor.
      </div>

      {!form && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => fileRef.current?.click()}
            disabled={instruments.length === 0 || importing}
            title="Importar um modelo do Word (.docx) ou PDF e criar o relatório a partir dele"
          >
            {importing ? "Importando…" : "Importar modelo (Word/PDF)"}
          </button>
          <button className="btn btn--terra btn--sm" onClick={openNew} disabled={instruments.length === 0}>
            + Novo relatório
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".docx,.doc,.pdf"
            style={{ display: "none" }}
            onChange={(e) => onImportFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}
      {importMsg && (
        <div className="adm-callout" style={{ marginBottom: 12 }}>{importMsg}</div>
      )}
      {instruments.length === 0 && (
        <div className="dash-state dash-state--error">
          Nenhum diagnóstico ativo no Motor de Diagnósticos — cadastre um instrumento antes de criar relatórios.
        </div>
      )}

      {form && (
        <div className="card" style={{ marginBottom: 18 }}>
          <fieldset className="prod-fs">
            <legend>{form.id ? "Editar relatório" : "Novo relatório"}</legend>
            <div className="prod-form__grid">
              <label className="prod-field prod-field--full">
                <span>Nome do relatório</span>
                <input
                  value={form.name}
                  placeholder="Ex.: Relatório de Cultura Organizacional"
                  onChange={(e) => setField("name", e.target.value)}
                />
              </label>
              <label className="prod-field prod-field--full">
                <span>Diagnóstico vinculado (Motor de Diagnósticos)</span>
                <select value={form.instrumentSlug} onChange={(e) => setField("instrumentSlug", e.target.value)}>
                  {instruments.map((i) => (
                    <option key={i.slug} value={i.slug}>
                      {i.name} {i.versions === 0 ? "(sem versão publicada)" : ""}
                    </option>
                  ))}
                </select>
                <span className="prod-note" style={{ margin: "6px 0 0" }}>
                  É daqui que vêm o índice, a faixa e as dimensões do relatório.
                </span>
              </label>
              <label className="prod-field prod-field--full">
                <span>Descrição (subtítulo do documento)</span>
                <input
                  value={form.description}
                  placeholder="Leitura executiva do clima e da cultura por dimensão"
                  onChange={(e) => setField("description", e.target.value)}
                />
              </label>
            </div>

            <span className="prod-note" style={{ margin: "10px 0 6px" }}>O que o motor injeta automaticamente:</span>
            <div className="prod-modules">
              <label className="prod-check">
                <input type="checkbox" checked={form.includeResults} onChange={(e) => setField("includeResults", e.target.checked)} />
                Índice e faixa do diagnóstico
              </label>
              <label className="prod-check">
                <input type="checkbox" checked={form.includeDimensions} onChange={(e) => setField("includeDimensions", e.target.checked)} />
                Tabela por dimensão
              </label>
              <label className="prod-check">
                <input type="checkbox" checked={form.includePlan} onChange={(e) => setField("includePlan", e.target.checked)} />
                Ações do Plano de Evolução
              </label>
              <label className="prod-check">
                <input type="checkbox" checked={form.active} onChange={(e) => setField("active", e.target.checked)} />
                Ativo (visível no portal)
              </label>
            </div>
          </fieldset>

          <fieldset className="prod-fs" style={{ marginTop: 16 }}>
            <legend>Texto fixo do relatório</legend>
            <p className="prod-note" style={{ marginTop: 0 }}>
              Contexto, metodologia e limites — o que é igual para toda empresa. Os números entram
              automaticamente nas seções acima.
            </p>
            {form.sections.map((s, i) => (
              <div key={i} style={{ borderTop: i ? "1px solid var(--line)" : "none", paddingTop: i ? 12 : 0, marginTop: i ? 12 : 0 }}>
                <label className="prod-field prod-field--full">
                  <span>Título da seção</span>
                  <input
                    value={s.heading}
                    placeholder="Ex.: Como ler este relatório"
                    onChange={(e) => setSection(i, { heading: e.target.value })}
                  />
                </label>
                <label className="prod-field prod-field--full" style={{ marginTop: 8 }}>
                  <span>Texto</span>
                  <textarea
                    rows={4}
                    value={s.body}
                    onChange={(e) => setSection(i, { body: e.target.value })}
                    style={{ width: "100%", resize: "vertical" }}
                  />
                </label>
              </div>
            ))}
            <button
              className="btn btn--ghost btn--sm"
              style={{ marginTop: 10 }}
              onClick={() => setField("sections", [...form.sections, { heading: "", body: "" }])}
            >
              + Adicionar seção
            </button>
          </fieldset>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button className="btn btn--terra btn--sm" disabled={saving} onClick={save}>
              {saving ? "Salvando…" : form.id ? "Salvar alterações" : "Criar relatório"}
            </button>
            <button
              className="btn btn--outline-dark btn--sm"
              disabled={saving}
              onClick={() => setPreviewHtml(renderDocumentHtml(buildPreviewDoc(form)))}
              title="Ver como o relatório vai ficar no Portal do Cliente (com dados de exemplo)"
            >
              Pré-visualizar
            </button>
            <button className="btn btn--ghost btn--sm" disabled={saving} onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {previewHtml && (
        <div className="modal-backdrop" onClick={() => setPreviewHtml(null)}>
          <div className="modal modal--wide" style={{ maxWidth: 900 }} onClick={(e) => e.stopPropagation()}>
            <header className="modal__head">
              <h2>Pré-visualização do relatório</h2>
              <button className="icon-btn" onClick={() => setPreviewHtml(null)} title="Fechar">✕</button>
            </header>
            <div className="modal__body" style={{ padding: 0 }}>
              {/* iframe isola o CSS do documento (Georgia/serif) do CSS do painel —
                  é o MESMO HTML que o portal imprime, com valores de exemplo. */}
              <iframe
                title="Pré-visualização do relatório"
                srcDoc={previewHtml}
                style={{ width: "100%", height: "68vh", border: 0, background: "#fff", display: "block" }}
              />
            </div>
            <div className="modal__foot">
              <span className="prod-note" style={{ marginRight: "auto" }}>
                Números e empresa são de exemplo — no portal entram os dados reais do diagnóstico.
              </span>
              <button type="button" className="btn btn--outline-dark btn--sm" onClick={() => setPreviewHtml(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="addx-wrap">
        <table className="addx-table">
          <thead>
            <tr>
              <th>Relatório</th>
              <th>Diagnóstico vinculado</th>
              <th>Conteúdo automático</th>
              <th>Status</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).filter((r) => !instrumentSlug || r.instrumentSlug === instrumentSlug).map((r) => (
              <tr key={r.id}>
                <td className="addx-name">
                  <strong>{r.name}</strong>
                  <p>{r.description || <code>tpl:{r.key}</code>}</p>
                </td>
                <td>
                  {r.instrumentName}
                  {!r.instrumentActive && <p className="evd-reason">Diagnóstico inativo</p>}
                </td>
                <td>
                  {[
                    r.includeResults ? "índice e faixa" : null,
                    r.includeDimensions ? "dimensões" : null,
                    r.includePlan ? "plano" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "só texto fixo"}
                </td>
                <td>
                  <span className={`addx-status ${r.active ? "addx-status--ATIVO" : "addx-status--AGUARDANDO_DADOS"}`}>
                    {r.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="addx-actions">
                  <button type="button" disabled={busyId === r.id} onClick={() => openEdit(r)}>Editar</button>
                  <button type="button" disabled={busyId === r.id} onClick={() => remove(r)}>Remover</button>
                </td>
              </tr>
            ))}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={5} className="addx-empty">
                  Nenhum relatório cadastrado. Use “+ Novo relatório” para criar um vinculado a um diagnóstico.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
