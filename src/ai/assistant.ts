/**
 * Assistant IA. Deux modes :
 * - page publiée sur claude.ai : la capacité `sample` interroge Claude avec le compte du visiteur ;
 * - application locale : l'API Claude avec la clé API de l'utilisateur, conservée dans ce navigateur.
 */
import { type SampleFn, getSample } from "../store/claude-runtime";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export interface AskOptions {
  onText?: (text: string) => void;
  signal?: AbortSignal;
  images?: Blob[];
}

export interface Assistant {
  kind: "claude-ai" | "api";
  ask(system: string, turns: ChatMessage[], opts?: AskOptions): Promise<string>;
  askJson<T>(prompt: string, opts?: AskOptions): Promise<T>;
  canUseImages(): Promise<boolean>;
}

const KEY_STORAGE = "quinze-cent:anthropic-key";
export const IS_ARTIFACT = import.meta.env.MODE === "artifact";
const MODEL = "claude-opus-5";

export function readApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function storeApiKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* navigateur sans stockage : la clé reste en mémoire pour la session */
  }
}

export class AssistantError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly partial?: string,
  ) {
    super(message);
  }
}

const SAMPLE_ERRORS: Record<string, string> = {
  not_granted: "L'accès à Claude n'a pas été autorisé pour cette page.",
  sampling_disabled: "Claude n'est pas disponible pour ce compte.",
  rate_limited: "Trop de demandes ou limite d'utilisation atteinte. Réessayez un peu plus tard.",
  session_expired: "Votre session claude.ai a expiré : reconnectez-vous.",
  prompt_too_large: "La demande est trop longue. Posez une question plus ciblée.",
  refused: "Claude n'a pas pu répondre à cette demande. Reformulez-la.",
  invalid_json: "La réponse n'a pas pu être lue. Réessayez.",
  image_rejected: "L'image n'est pas acceptée (format ou taille). Essayez une autre photo.",
  images_unavailable: "L'envoi de photos n'est pas disponible ici.",
  cancelled: "Demande arrêtée.",
};

function claudeAiAssistant(sample: SampleFn): Assistant {
  const wrap = (e: unknown): never => {
    const err = e as { code?: string; message?: string; text?: string };
    throw new AssistantError(SAMPLE_ERRORS[err.code ?? ""] ?? "Claude est momentanément indisponible. Réessayez.", err.code ?? "upstream_error", err.text);
  };
  return {
    kind: "claude-ai",
    async ask(system, turns, opts) {
      try {
        const input = [{ role: "user" as const, content: system }, ...turns];
        const { text } = await sample(input, {
          cache: false,
          signal: opts?.signal,
          onText: opts?.onText ? ({ text }: { text: string }) => opts.onText!(text) : undefined,
          ...(opts?.images?.length ? { images: opts.images } : {}),
        });
        return text;
      } catch (e) {
        return wrap(e);
      }
    },
    async askJson<T>(prompt: string, opts?: AskOptions) {
      try {
        return await sample.json<T>(prompt, {
          signal: opts?.signal,
          ...(opts?.images?.length ? { images: opts.images } : {}),
        });
      } catch (e) {
        return wrap(e);
      }
    },
    async canUseImages() {
      try {
        return !!(await sample.limits()).images;
      } catch {
        return false;
      }
    },
  };
}

async function toBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  return btoa(binary);
}

function apiAssistant(apiKey: string): Assistant {
  const run = async (system: string, turns: ChatMessage[], opts?: AskOptions): Promise<string> => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    type StreamParams = Parameters<typeof client.beta.messages.stream>[0];

    const images = opts?.images?.length
      ? await Promise.all(
          opts.images.map(async (img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: (img.type || "image/jpeg") as "image/jpeg", data: await toBase64(img) },
          })),
        )
      : [];
    const messages = turns.map((t, i) =>
      i === turns.length - 1 && t.role === "user" && images.length
        ? { role: t.role, content: [...images, { type: "text" as const, text: t.content }] }
        : { role: t.role, content: t.content },
    );
    const params = {
      model: MODEL,
      max_tokens: 16000,
      system,
      messages,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    } as unknown as StreamParams;

    try {
      const stream = client.beta.messages.stream(params);
      opts?.signal?.addEventListener("abort", () => stream.abort());
      stream.on("text", (_delta, snapshot) => opts?.onText?.(snapshot));
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") throw new AssistantError(SAMPLE_ERRORS.refused, "refused");
      const text = message.content
        .filter((b): b is Extract<(typeof message.content)[number], { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (!text.trim()) throw new AssistantError("Réponse vide. Réessayez.", "empty_completion");
      return text;
    } catch (e) {
      if (e instanceof AssistantError) throw e;
      if (opts?.signal?.aborted) throw new AssistantError(SAMPLE_ERRORS.cancelled, "cancelled");
      if (e instanceof Anthropic.AuthenticationError) throw new AssistantError("Clé API refusée : vérifiez-la dans les réglages de l'assistant.", "auth");
      if (e instanceof Anthropic.RateLimitError) throw new AssistantError(SAMPLE_ERRORS.rate_limited, "rate_limited");
      if (e instanceof Anthropic.APIError) throw new AssistantError(`Erreur de l'API Claude (${e.status ?? "réseau"}). Réessayez.`, "upstream_error");
      throw new AssistantError("Impossible de joindre l'API Claude. Vérifiez votre connexion.", "network");
    }
  };

  return {
    kind: "api",
    ask: run,
    async askJson<T>(prompt: string, opts?: AskOptions) {
      const text = await run("Réponds uniquement avec la valeur JSON demandée, sans texte autour.", [{ role: "user", content: prompt }], opts);
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const body = match ? match[1] : text.slice(text.search(/[[{]/), Math.max(text.lastIndexOf("}"), text.lastIndexOf("]")) + 1);
      try {
        return JSON.parse(body) as T;
      } catch {
        throw new AssistantError(SAMPLE_ERRORS.invalid_json, "invalid_json", text);
      }
    },
    async canUseImages() {
      return true;
    },
  };
}

/** Renvoie l'assistant disponible, ou null (clé API à saisir). */
export async function resolveAssistant(apiKey: string): Promise<Assistant | null> {
  const sample = await getSample();
  if (sample) return claudeAiAssistant(sample);
  // La page claude.ai n'embarque pas le SDK : l'assistant y passe par le compte du visiteur.
  if (!IS_ARTIFACT && apiKey) return apiAssistant(apiKey);
  return null;
}

/** Réduit une photo (≤ 1600 px, JPEG) avant envoi. */
export async function shrinkImage(file: File, maxDim = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file;
  }
}
