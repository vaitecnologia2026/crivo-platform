// Gate de acesso — assinatura/verificação do cookie httpOnly via HMAC-SHA256.
// Usa Web Crypto (crypto.subtle), disponível tanto no runtime Edge (middleware)
// quanto no Node (route handler). O token que o usuário digita NUNCA vai para o
// client: a validação acontece no servidor (/api/gate) e o que volta é apenas um
// cookie httpOnly assinado, impossível de forjar sem o GATE_SECRET.

const PAYLOAD = "crivo-access-v1";

export const GATE_COOKIE = "crivo_access";

export function gateSecret(): string {
  return process.env.GATE_SECRET ?? "dev-gate-secret-troque-em-producao";
}

export function accessToken(): string {
  return process.env.SITE_ACCESS_TOKEN ?? "VAI2026";
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function signGate(secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(PAYLOAD));
  return toHex(sig);
}

export async function verifyGate(
  secret: string,
  value: string | undefined | null,
): Promise<boolean> {
  if (!value) return false;
  const expected = await signGate(secret);
  // Comparação em tempo constante para evitar timing attack.
  if (value.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < value.length; i++) diff |= value.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
