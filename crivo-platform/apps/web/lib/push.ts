// Push (FCM) no app nativo (Capacitor). No navegador é NO-OP: só age quando
// roda dentro do app iOS/Android. Import dinâmico do plugin para não quebrar o
// build web (Next). Best-effort: qualquer falha é silenciosa (log) e nunca
// atrapalha a entrada na plataforma.
import { Capacitor } from "@capacitor/core";
import { getToken } from "./api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

let started = false;

/** Envia o token FCM deste dispositivo para o backend (rota autenticada). */
async function sendToken(token: string, platform: string): Promise<void> {
  const auth = getToken();
  if (!API || !auth) return;
  try {
    await fetch(`${API}/me/push-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
      body: JSON.stringify({ token, platform }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    /* best-effort: registra na próxima abertura */
  }
}

/**
 * Registra o dispositivo para push, se estivermos no app nativo e o usuário
 * estiver logado. Idempotente: os listeners são adicionados uma única vez.
 */
export async function registerPushForCurrentUser(): Promise<void> {
  if (started) return;
  if (typeof window === "undefined") return;
  if (!Capacitor.isNativePlatform()) return; // web → no-op
  started = true;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const platform = Capacitor.getPlatform(); // 'ios' | 'android'

    // Token emitido pelo SO → envia ao backend.
    await PushNotifications.addListener("registration", async (t) => {
      let actualToken = t.value;

      // No iOS o plugin emite o APNs hex (64 chars), que o Firebase Admin SDK
      // rejeita. O AppDelegate salva o FCM token real em UserDefaults
      // (CapacitorStorage.fcmToken) ~ms depois; lemos via Preferences (poll até 5s).
      if (platform === "ios") {
        const { Preferences } = await import("@capacitor/preferences");
        for (let i = 0; i < 10; i++) {
          const { value: fcm } = await Preferences.get({ key: "fcmToken" });
          if (fcm && fcm.length > 80) {
            actualToken = fcm;
            break;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      void sendToken(actualToken, platform);
    });
    await PushNotifications.addListener("registrationError", () => {
      /* sem token; tenta de novo na próxima abertura */
    });

    // Permissão: pede se ainda não concedida.
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      started = false; // permite nova tentativa numa próxima sessão
      return;
    }

    await PushNotifications.register();
  } catch {
    started = false; // falha ao carregar plugin → não trava; tenta depois
  }
}
