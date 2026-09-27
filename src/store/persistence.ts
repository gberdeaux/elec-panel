import { syncCatalog } from "../domain/catalog";
import type { Project } from "../domain/types";
import { type DbDoc, getDb, getDownloads, getUser } from "./claude-runtime";
import { useStore } from "./store";

const LOCAL_KEY = "quinze-cent:project:v1";
const CHAT_LIMIT = 40;

export type SaveStatus = "local" | "cloud" | "saving" | "error" | "memory";

function isProject(value: unknown): value is Project {
  const p = value as Project;
  return !!p && p.version === 1 && Array.isArray(p.panels) && p.panels.length > 0 && !!p.house;
}

/** Complète un projet importé avec les champs ajoutés depuis. */
export function normalizeProject(p: Project): Project {
  const customCatalog = p.customCatalog ?? [];
  return {
    ...p,
    // Répare les références restées d'un ancien calibre (versions précédentes).
    panels: p.panels.map((panel) => ({ ...panel, rows: panel.rows.map((row) => row.map((d) => syncCatalog(d, customCatalog))) })),
    inventory: p.inventory ?? {},
    catalogOverrides: p.catalogOverrides ?? {},
    customCatalog,
    chat: p.chat ?? [],
    allowCrossBrandReuse: p.allowCrossBrandReuse ?? false,
    activePanelId: p.panels.some((x) => x.id === p.activePanelId) ? p.activePanelId : p.panels[0].id,
  };
}

export function readLocal(): Project | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isProject(parsed) ? normalizeProject(parsed) : null;
  } catch {
    return null;
  }
}

function writeLocal(p: Project): boolean {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

const forStorage = (p: Project): Project => ({ ...p, chat: p.chat.slice(-CHAT_LIMIT) });

/**
 * Démarre la sauvegarde automatique : navigateur toujours, base claude.ai quand elle est disponible
 * (le projet est alors retrouvé sur tous les appareils du même compte).
 */
export function startPersistence(onStatus: (s: SaveStatus) => void): () => void {
  let cloud: DbDoc | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saving: Promise<void> = Promise.resolve();
  let lastSaved = 0;

  const local = readLocal();
  if (local) useStore.getState().replaceProject(local);
  onStatus(writeLocal(useStore.getState().project) ? "local" : "memory");

  (async () => {
    const [db, user] = await Promise.all([getDb(), getUser()]);
    const uid = await user?.id().catch(() => null);
    if (!db || !uid) return;
    try {
      cloud = db.doc(`data/users/${uid}/project`);
      const snap = await cloud.get();
      const remote = snap.exists ? snap.data() : undefined;
      const current = useStore.getState().project;
      if (isProject(remote) && remote.updatedAt > current.updatedAt) {
        useStore.getState().replaceProject(normalizeProject(remote));
        lastSaved = remote.updatedAt;
      } else if (current.updatedAt > 0) {
        await cloud.set(forStorage(current) as unknown as Record<string, unknown>);
        lastSaved = current.updatedAt;
      }
      onStatus("cloud");
    } catch {
      cloud = null;
      onStatus("local");
    }
  })();

  const unsubscribe = useStore.subscribe((state, prev) => {
    if (state.project === prev.project) return;
    const ok = writeLocal(forStorage(state.project));
    if (!cloud) {
      onStatus(ok ? "local" : "memory");
      return;
    }
    clearTimeout(timer);
    onStatus("saving");
    timer = setTimeout(() => {
      saving = saving.then(async () => {
        const p = useStore.getState().project;
        if (!cloud || p.updatedAt === lastSaved) return;
        try {
          await cloud.set(forStorage(p) as unknown as Record<string, unknown>);
          lastSaved = p.updatedAt;
          onStatus("cloud");
        } catch {
          onStatus("error");
        }
      });
    }, 1500);
  });

  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}

export async function exportFile(filename: string, data: string, mime: string): Promise<boolean> {
  const downloads = await getDownloads();
  if (downloads) {
    try {
      await downloads.save({ filename, data: new Blob([data], { type: mime }) });
      return true;
    } catch {
      return false;
    }
  }
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function importProjectFile(file: File): Promise<Project> {
  const parsed = JSON.parse(await file.text());
  if (!isProject(parsed)) throw new Error("Ce fichier n'est pas un projet Quinze-Cent.");
  return normalizeProject({ ...parsed, updatedAt: Date.now() });
}
