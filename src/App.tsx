import { useEffect, useMemo, useRef, useState } from "react";
import { analyzePanel, worstSeverity } from "./domain/analysis";
import { AnalysisView } from "./components/AnalysisView";
import { AssistantView } from "./components/AssistantView";
import { HouseView } from "./components/HouseView";
import { MaterialsView } from "./components/MaterialsView";
import { PanelView } from "./components/PanelView";
import { Modal } from "./components/ui";
import { type SaveStatus, exportFile, importProjectFile, startPersistence } from "./store/persistence";
import { type View, useStore } from "./store/store";

const STATUS_LABEL: Record<SaveStatus, string> = {
  local: "Enregistré sur cet appareil",
  cloud: "Enregistré sur votre compte",
  saving: "Enregistrement…",
  error: "Échec de l'enregistrement",
  memory: "Non enregistré (stockage indisponible)",
};

export function App() {
  const project = useStore((s) => s.project);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const openPanel = useStore((s) => s.openPanel);
  const addPanel = useStore((s) => s.addPanel);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const [status, setStatus] = useState<SaveStatus>("local");
  const [pendingQuestion, setPendingQuestion] = useState<string>();
  const [menu, setMenu] = useState(false);

  useEffect(() => startPersistence(setStatus), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const severities = useMemo(
    () => new Map(project.panels.map((p) => [p.id, worstSeverity(analyzePanel(p, project.house).filter((f) => f.severity !== "conseil"))])),
    [project.panels, project.house],
  );

  const ask = (q: string) => {
    setPendingQuestion(q);
    setView("assistant");
  };

  const tab = (v: View, label: string) => (
    <button type="button" role="tab" className="tab" aria-selected={view === v} onClick={() => setView(v)}>
      {label}
    </button>
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark">
              <span className="wire" aria-hidden="true">
                <i style={{ background: "var(--phase)" }} />
                <i style={{ background: "var(--accent)" }} />
                <i style={{ background: "linear-gradient(180deg, var(--earth-g) 0 33%, var(--earth-y) 33% 66%, var(--earth-g) 66%)" }} />
              </span>
              Quinze-Cent
            </span>
            <span className="brand-sub">{project.house.name} · tableau électrique NF C 15-100</span>
          </div>
          <div className="top-actions">
            <span className="save-status" data-status={status}>
              {STATUS_LABEL[status]}
            </span>
            <button type="button" className="btn ghost icon" onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)" aria-label="Annuler">
              ↶
            </button>
            <button type="button" className="btn ghost icon" onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Y)" aria-label="Rétablir">
              ↷
            </button>
            <button type="button" className="btn small" onClick={() => setMenu(true)}>
              Projet
            </button>
          </div>
        </div>
        <nav className="tabs" role="tablist" aria-label="Sections">
          {tab("house", "Ma maison")}
          <span className="tab-sep" />
          {project.panels.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "panel" && project.activePanelId === p.id}
              onClick={() => openPanel(p.id)}
            >
              <span className="dot" data-sev={severities.get(p.id)} aria-hidden="true" />
              {p.name}
              <span className="role">{p.role === "existing" ? "existant" : "nouveau"}</span>
            </button>
          ))}
          <button type="button" className="tab" onClick={() => addPanel("new")} title="Ajouter un tableau">
            + Tableau
          </button>
          <span className="tab-sep" />
          {tab("analysis", "Conformité")}
          {tab("materials", "Matériel")}
          {tab("assistant", "Assistant IA")}
        </nav>
      </header>

      <main>
        {project.updatedAt === 0 && (
          <div className="banner">
            <span style={{ flex: 1, minWidth: 220 }}>
              Voici un <b>tableau d'exemple</b> des années 1990 avec ses défauts. Modifiez-le pour décrire le vôtre, ou partez d'un tableau vide.
            </span>
            <button type="button" className="btn small" onClick={() => useStore.getState().startBlank()}>
              Partir d'un tableau vide
            </button>
          </div>
        )}
        {view === "house" && <HouseView />}
        {view === "panel" && <PanelView onAsk={ask} />}
        {view === "analysis" && <AnalysisView onAsk={ask} />}
        {view === "materials" && <MaterialsView />}
        {view === "assistant" && <AssistantView pending={pendingQuestion} onPendingHandled={() => setPendingQuestion(undefined)} />}
      </main>

      {menu && <ProjectMenu onClose={() => setMenu(false)} />}
    </div>
  );
}

function ProjectMenu({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const replaceProject = useStore((s) => s.replaceProject);
  const resetToSample = useStore((s) => s.resetToSample);
  const startBlank = useStore((s) => s.startBlank);
  const [message, setMessage] = useState<string>();
  const [confirm, setConfirm] = useState<"blank" | "sample">();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Modal title="Projet" onClose={onClose}>
      <div className="stack">
        <section className="stack">
          <h3>Sauvegarde</h3>
          <p className="muted">Le projet s'enregistre automatiquement. Exportez-le pour le garder en fichier ou le transférer sur un autre appareil.</p>
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={async () => {
                const ok = await exportFile(`quinze-cent-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(project, null, 2), "application/json");
                setMessage(ok ? "Fichier exporté." : "L'export a été refusé.");
              }}
            >
              Exporter le projet
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              Importer un projet
            </button>
            <input
              ref={fileRef}
              id="import-file"
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  replaceProject(await importProjectFile(file), { keepHistory: true });
                  setMessage("Projet importé.");
                } catch (err) {
                  setMessage((err as Error).message || "Fichier illisible.");
                }
              }}
            />
          </div>
        </section>
        <section className="stack">
          <h3>Recommencer</h3>
          {confirm ? (
            <div className="row">
              <span style={{ flex: 1 }}>
                {confirm === "blank" ? "Remplacer le projet par un tableau vide ?" : "Remplacer le projet par l'exemple ?"} (annulable avec Ctrl+Z)
              </span>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  if (confirm === "blank") startBlank();
                  else resetToSample();
                  onClose();
                }}
              >
                Confirmer
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirm(undefined)}>
                Annuler
              </button>
            </div>
          ) : (
            <div className="row">
              <button type="button" className="btn" onClick={() => setConfirm("blank")}>
                Nouveau projet vide
              </button>
              <button type="button" className="btn" onClick={() => setConfirm("sample")}>
                Recharger l'exemple
              </button>
            </div>
          )}
        </section>
        {message && <p className="muted">{message}</p>}
        <p className="muted" style={{ fontSize: "0.8rem" }}>
          Quinze-Cent aide à préparer une mise en conformité. Il ne remplace pas un électricien qualifié ni l'attestation de conformité Consuel.
          Travaillez toujours hors tension.
        </p>
      </div>
    </Modal>
  );
}
