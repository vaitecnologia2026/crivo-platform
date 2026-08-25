"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dropdown com busca (single ou multi). Usado em:
 *  - CustomPromptsPanel (Diagnóstico do Motor / Adicionais)
 *  - MethodologySection (seletor de diagnóstico do Motor de Diagnósticos)
 *
 * `clearable` (só no modo single): quando false, não mostra a opção "— Nenhum —"
 * — para casos em que sempre há um item selecionado.
 */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  multiple = false,
  clearable = true,
  emptyLabel = "Nada encontrado.",
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  multiple?: boolean;
  clearable?: boolean;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const term = q.trim().toLowerCase();
  const filtered = term ? options.filter((o) => o.label.toLowerCase().includes(term)) : options;
  const selected = options.filter((o) => value.includes(o.value));
  const summary = multiple
    ? value.length
      ? `${value.length} selecionado(s)`
      : placeholder
    : selected[0]?.label ?? placeholder;
  const pick = (v: string) => {
    if (multiple) onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    else {
      onChange([v]);
      setOpen(false);
      setQ("");
    }
  };
  const hasSel = multiple ? value.length > 0 : selected.length > 0;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 12px",
          border: "1px solid var(--line, #DCD7CE)",
          borderRadius: "var(--r-lg, 6px)",
          background: "#fff",
          cursor: "pointer",
          font: "inherit",
          textAlign: "left",
        }}
      >
        <span
          style={{
            color: hasSel ? "var(--azul-profundo, #0D1F3C)" : "#8a8174",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </span>
        <span aria-hidden style={{ color: "#8a8174", flexShrink: 0 }}>▾</span>
      </button>
      {multiple && selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {selected.map((o) => (
            <span
              key={o.value}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                background: "rgba(168,105,61,0.10)",
                color: "var(--terra, #A8693D)",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {o.label}
              <button
                type="button"
                onClick={() => pick(o.value)}
                style={{ border: "none", background: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 30,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid var(--line, #DCD7CE)",
            borderRadius: "var(--r-lg, 6px)",
            boxShadow: "0 8px 24px rgba(13,31,60,0.12)",
            overflow: "hidden",
          }}
        >
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 12px",
              border: "none",
              borderBottom: "1px solid var(--line, #DCD7CE)",
              font: "inherit",
              outline: "none",
            }}
          />
          <div style={{ maxHeight: 220, overflowY: "auto", padding: 4 }}>
            {!multiple && clearable && (
              <button
                type="button"
                onClick={() => {
                  onChange([]);
                  setOpen(false);
                  setQ("");
                }}
                style={{ width: "100%", textAlign: "left", padding: "7px 10px", border: "none", background: "none", cursor: "pointer", font: "inherit", color: "#8a8174", borderRadius: 4 }}
              >
                — Nenhum —
              </button>
            )}
            {filtered.map((o) => {
              const on = value.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => pick(o.value)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    textAlign: "left",
                    padding: "7px 10px",
                    border: "none",
                    background: on ? "rgba(168,105,61,0.08)" : "none",
                    cursor: "pointer",
                    font: "inherit",
                    color: "var(--azul-profundo, #0D1F3C)",
                    borderRadius: 4,
                  }}
                >
                  {multiple && <input type="checkbox" readOnly checked={on} style={{ pointerEvents: "none" }} />}
                  {o.label}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: "8px 10px", color: "#8a8174", fontSize: 13 }}>
                {options.length === 0 ? emptyLabel : "Nada encontrado."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
