import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

/**
 * Envio de push via Firebase Cloud Messaging (FCM). Inicialização preguiçosa a
 * partir do env:
 *   - FCM_SERVICE_ACCOUNT       → JSON da service account (string) OU
 *   - FCM_SERVICE_ACCOUNT_PATH  → caminho para o arquivo JSON
 *
 * SEM credencial, o serviço fica DESABILITADO (no-op + log) — nada quebra antes
 * do Firebase estar configurado. Assim o backend sobe e roda mesmo na Fase A.
 */
@Injectable()
export class FcmService {
  private readonly log = new Logger('Fcm');
  private app: admin.app.App | null = null;
  private initialized = false;
  private projectId: string | null = null;

  private ensure(): admin.app.App | null {
    if (this.initialized) return this.app;
    this.initialized = true;

    const raw = process.env.FCM_SERVICE_ACCOUNT;
    const path = process.env.FCM_SERVICE_ACCOUNT_PATH;
    let credentialJson: admin.ServiceAccount | null = null;
    try {
      if (raw && raw.trim().startsWith('{')) {
        credentialJson = JSON.parse(raw) as admin.ServiceAccount;
      } else if (path) {
        // require dinâmico: só quando há caminho configurado.
        credentialJson = require(path) as admin.ServiceAccount;
      }
    } catch (e) {
      this.log.error(`Credencial FCM inválida: ${String(e)}`);
      credentialJson = null;
    }

    if (!credentialJson) {
      this.log.warn('FCM sem credencial (FCM_SERVICE_ACCOUNT) — push desabilitado (no-op).');
      this.app = null;
      return null;
    }

    // project_id (JSON de service account) OU projectId (tipo admin) — só um NOME,
    // não é segredo; usado apenas no diagnóstico.
    this.projectId =
      (credentialJson as { project_id?: string }).project_id ??
      (credentialJson as admin.ServiceAccount).projectId ??
      null;

    this.app =
      admin.apps.find((a) => a?.name === 'crivo') ??
      admin.initializeApp({ credential: admin.credential.cert(credentialJson) }, 'crivo');
    this.log.log('FCM inicializado.');
    return this.app;
  }

  get enabled(): boolean {
    return this.ensure() !== null;
  }

  /**
   * Diagnóstico da configuração FCM/Firebase Admin — SEM vazar segredos. Retorna
   * apenas se está habilitado, de qual fonte veio a credencial e o projectId
   * (que é um nome público, não segredo). Não dispara nada.
   */
  diagnostics(): {
    enabled: boolean;
    credentialSource: 'json-env' | 'file-path' | 'none';
    projectId: string | null;
  } {
    const raw = process.env.FCM_SERVICE_ACCOUNT;
    const path = process.env.FCM_SERVICE_ACCOUNT_PATH;
    const enabled = this.enabled; // dispara ensure() (idempotente)
    const credentialSource: 'json-env' | 'file-path' | 'none' =
      raw && raw.trim().startsWith('{') ? 'json-env' : path ? 'file-path' : 'none';
    return { enabled, credentialSource, projectId: this.projectId };
  }

  /**
   * Envia para uma lista de tokens. Retorna os tokens INVÁLIDOS (não-registrados)
   * para o chamador limpá-los. Sem credencial ou sem tokens: no-op.
   */
  async sendToTokens(
    tokens: string[],
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<{ sent: number; failed: number; invalidTokens: string[] }> {
    const app = this.ensure();
    if (!app || tokens.length === 0) return { sent: 0, failed: 0, invalidTokens: [] };

    const res = await admin.messaging(app).sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    });

    const invalidTokens: string[] = [];
    res.responses.forEach((r, i) => {
      const code = r.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        invalidTokens.push(tokens[i]);
      }
    });
    return { sent: res.successCount, failed: res.failureCount, invalidTokens };
  }

  /** Envia para um tópico FCM (ex.: equipe CRIVO). Sem credencial: no-op. */
  async sendToTopic(
    topic: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<{ ok: boolean }> {
    const app = this.ensure();
    if (!app) return { ok: false };
    await admin.messaging(app).send({
      topic,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    });
    return { ok: true };
  }

  /** Inscreve tokens num tópico (best-effort). Sem credencial: no-op. */
  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    const app = this.ensure();
    if (!app || tokens.length === 0) return;
    try {
      await admin.messaging(app).subscribeToTopic(tokens, topic);
    } catch (e) {
      this.log.warn(`Falha ao inscrever no tópico ${topic}: ${String(e)}`);
    }
  }

  /** Remove tokens de um tópico (best-effort). */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    const app = this.ensure();
    if (!app || tokens.length === 0) return;
    try {
      await admin.messaging(app).unsubscribeFromTopic(tokens, topic);
    } catch (e) {
      this.log.warn(`Falha ao remover do tópico ${topic}: ${String(e)}`);
    }
  }
}
