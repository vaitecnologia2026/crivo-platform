import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * §14 — cartão de compartilhamento (WhatsApp, LinkedIn, X).
 *
 * Gerado por código em vez de arquivo: as fotos aprovadas do cliente estão em
 * 762×590 e recortar qualquer uma para 1200×630 cortaria rosto ou enquadramento,
 * o que o §1 proíbe. Aqui o cartão usa só a marca, o azul-profundo e o terra.
 *
 * A Lora vem de assets/ (versionada no repo, não baixada em tempo de build):
 * a fonte que o next/font entrega ao navegador é .woff2, formato que o Satori
 * não lê. Sem ela o cartão sairia numa sans genérica, fora do §1.
 */
export const alt = "CRIVO™ — Decidir com clareza. Liderar com coerência. Evoluir com sustentação.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const AZUL = "#0D1F3C";
const TERRA = "#A8693D";
const OFF_WHITE = "#F2F0EC";
const PRATA = "#B8C4D0";

/** Uma linha do título — em flex com gap, porque o Satori come o espaço
 *  em branco que fica colado num <span> aninhado. */
function Linha({ inicio, destaque }: { inicio: string; destaque: string }) {
  return (
    <div style={{ display: "flex", gap: 16 }}>
      <span>{inicio}</span>
      <span style={{ color: TERRA }}>{destaque}</span>
    </div>
  );
}

export default async function OpenGraphImage() {
  const lora = await readFile(join(process.cwd(), "assets/Lora-Regular.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 84px",
          background: AZUL,
          color: OFF_WHITE,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* Vértice: base aberta com o ponto terra no ápice. */}
          <svg width="54" height="54" viewBox="0 0 48 48" fill="none">
            <path d="M24 12 L41 41 M24 12 L7 41" stroke={OFF_WHITE} strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="24" cy="8" r="3.4" fill={TERRA} />
          </svg>
          <span style={{ fontSize: 42, letterSpacing: 12 }}>CRIVO</span>
        </div>

        <div style={{ display: "flex", width: 92, height: 3, background: TERRA, margin: "42px 0 34px" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 56, lineHeight: 1.15 }}>
          <Linha inicio="Decidir com" destaque="clareza." />
          <Linha inicio="Liderar com" destaque="coerência." />
          <Linha inicio="Evoluir com" destaque="sustentação." />
        </div>

        <span style={{ marginTop: 44, fontSize: 25, color: PRATA }}>
          Inteligência organizacional · Liderança · Governança
        </span>
      </div>
    ),
    { ...size, fonts: [{ name: "Lora", data: lora, style: "normal", weight: 400 }] },
  );
}
