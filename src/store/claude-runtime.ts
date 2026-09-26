/**
 * Accès aux capacités de la page quand l'application est publiée comme page claude.ai.
 * Hors claude.ai, `window.claude` n'existe pas : toutes les fonctions renvoient null.
 */

export interface DbDoc {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(data: Record<string, unknown>): Promise<void>;
}
export interface Db {
  doc(path: string): DbDoc;
}
export interface UserCap {
  id(): Promise<string | null>;
}
export interface SampleFn {
  (
    input: string | { role: "user" | "assistant"; content: string }[],
    opts?: Record<string, unknown>,
  ): Promise<{ text: string; truncated: boolean }>;
  json<T = unknown>(input: string | { role: "user" | "assistant"; content: string }[], opts?: Record<string, unknown>): Promise<T>;
  limits(): Promise<{ maxPromptBytes: number; images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] } }>;
}
export interface DownloadsCap {
  save(opts: { filename: string; data: Blob | string }): Promise<unknown>;
}

interface ClaudeGlobal {
  use(name: string): Promise<unknown>;
}

declare global {
  interface Window {
    claude?: ClaudeGlobal;
  }
}

export const inClaudeViewer = () => typeof window !== "undefined" && typeof window.claude?.use === "function";

async function use<T>(name: string): Promise<T | null> {
  if (!inClaudeViewer()) return null;
  try {
    return ((await window.claude!.use(name)) as T) ?? null;
  } catch {
    return null;
  }
}

export const getDb = () => use<Db>("db");
export const getUser = () => use<UserCap>("user");
export const getSample = () => use<SampleFn>("sample");
export const getDownloads = () => use<DownloadsCap>("downloads");
