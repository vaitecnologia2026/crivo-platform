import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Criptografia simétrica para segredos em repouso (token de IA). AES-256-GCM
// com chave derivada de AUTH_SECRET (SHA-256 → 32 bytes). O token nunca é
// gravado em claro nem retornado pela API de leitura.

function key(): Buffer {
  // Fail-fast: sem AUTH_SECRET forte, NÃO cifrar com chave pública (token de IA
  // ficaria ~plaintext em repouso). Espelha a exigência do JwtModule no boot.
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'AUTH_SECRET ausente ou fraco (mínimo 32 caracteres) — necessário para cifrar segredos em repouso.',
    );
  }
  return createHash('sha256').update(secret).digest();
}

export interface Encrypted {
  enc: string; // ciphertext base64
  iv: string; // base64
  tag: string; // auth tag base64
}

export function encryptSecret(plain: string): Encrypted {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return {
    enc: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptSecret(e: Encrypted): string {
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(e.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(e.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(e.enc, 'base64')), decipher.final()]).toString(
    'utf8',
  );
}

/** Máscara para exibição: últimos 4 caracteres. */
export function hintOf(secret: string): string {
  return secret.length <= 4 ? '••••' : secret.slice(-4);
}
