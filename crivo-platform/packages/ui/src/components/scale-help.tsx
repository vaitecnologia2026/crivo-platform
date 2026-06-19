import type { CSSProperties } from "react";

export interface ScaleItem {
  value: number;
  label: string;
}

export interface ScaleHelpBoxProps {
  /** Itens da escala (ex.: PRE_DIAGNOSTIC_SCALE, ICD_AXIS_SCALE). */
  scale: readonly ScaleItem[];
  title?: string;
  /** Texto de apoio. Passe "" para ocultar. */
  hint?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Legenda de escala reutilizável — aparece ANTES das perguntas avaliativas
 * (LP, diagnósticos e questionários) para o respondente entender cada nota.
 *
 * Estilizado via tokens `--crivo-*` + estilos inline para renderizar de forma
 * consistente em qualquer contexto de CSS do projeto (lp.css / app.css /
 * public.module.css), sem depender de utilitários do host. Lista horizontal no
 * desktop que quebra em coluna no mobile (flex-wrap).
 */
export function ScaleHelpBox({
  scale,
  title = "Como responder",
  hint = "Use a escala abaixo para avaliar a realidade atual da sua empresa.",
  className,
  style,
}: ScaleHelpBoxProps) {
  return (
    <div
      className={className}
      style={{
        border: "1px solid var(--crivo-line, #e3e8ef)",
        background: "var(--crivo-off-white, #f7f9fc)",
        borderRadius: "var(--crivo-radius-md, 10px)",
        padding: "14px 16px",
        margin: "0 0 18px",
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: "var(--crivo-font-display, inherit)",
          fontWeight: 600,
          fontSize: "13px",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--crivo-azul-profundo, #0d1f3c)",
          marginBottom: "2px",
        }}
      >
        {title}
      </div>
      {hint ? (
        <p
          style={{
            fontSize: "13px",
            lineHeight: 1.45,
            color: "var(--crivo-cinza-escuro, #55607a)",
            margin: "0 0 10px",
          }}
        >
          {hint}
        </p>
      ) : null}
      <ul
        style={{
          listStyle: "none",
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 14px",
          margin: 0,
          padding: 0,
        }}
      >
        {scale.map((s) => (
          <li
            key={s.value}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              fontSize: "13px",
              color: "var(--crivo-cinza-escuro, #55607a)",
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "22px",
                height: "22px",
                borderRadius: "999px",
                background: "var(--crivo-azul-profundo, #0d1f3c)",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 700,
                flex: "0 0 auto",
              }}
            >
              {s.value}
            </span>
            <span>{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
