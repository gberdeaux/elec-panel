import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { analyzePanel, worstSeverity } from "./domain/analysis";
import { AnalysisView } from "./components/AnalysisView";
import { AssistantView } from "./components/AssistantView";
import { DeviceDefs } from "./components/DeviceArt";
import { HouseView } from "./components/HouseView";
import { MaterialsView } from "./components/MaterialsView";
import { OverviewView } from "./components/OverviewView";
import { PanelView } from "./components/PanelView";
import {
  IconBolt,
  IconBox,
  IconChevronRight,
  IconDashboard,
  IconDownload,
  IconHome,
  IconInfo,
  IconMenu,
  IconMoon,
  IconPanel,
  IconPlus,
  IconRedo,
  IconShield,
  IconSparkles,
  IconSun,
  IconUndo,
  IconUpload,
} from "./components/icons";
import { Modal, Toasts, toast } from "./components/ui";
import { type SaveStatus, exportFile, importProjectFile, startPersistence } from "./store/persistence";
import { type View, useStore } from "./store/store";

const STATUS_LABEL: Record<SaveStatus, string> = {
  local: "Enregistré sur cet appareil",
  cloud: "Synchronisé avec votre compte",
  saving: "Enregistrement…",
  error: "Échec de l'enregistrement",
  memory: "Non enregistré",
};

const VIEW_TITLE: Record<View, string> = {
  overview: "Vue d'ensemble",
  house: "Ma maison",
  panel: "Tableau",
  analysis: "Conformité",
  materials: "Matériel",
  assistant: "Assistant IA",
};

type Theme = "light" | "dark" | "system";
const THEME_KEY = "quinze-cent:theme";

function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as Theme) || "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* préférence non mémorisée */
    }
  }, [theme]);
  return [theme, setTheme];
}

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
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useTheme();

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
    () => new Map(project.panels.map((p) => [p.id, worstSeverity(analyzePanel(p, project.house).filter((f) => f.severity === "danger" || f.severity === "nonconforme"))])),
    [project.panels, project.house],
  );
  const activePanel = project.panels.find((p) => p.id === project.activePanelId);

  const go = (v: View) => {
    setView(v);
    setNavOpen(false);
    window.scrollTo({ top: 0 });
  };
  const ask = (q: string) => {
    setPendingQuestion(q);
    go("assistant");
  };

  const navItem = (v: View, label: string, icon: ReactNode) => (
    <button type="button" className="nav-item" aria-current={view === v ? "page" : undefined} onClick={() => go(v)}>
      {icon}
      <span className="nav-text">{label}</span>
    </button>
  );

  return (
    <div className="shell">
      <DeviceDefs />
      <aside className="sidebar" data-open={navOpen} aria-label="Navigation">
        <div className="logo">
          <span className="logo-mark">
            <IconBolt size={17} />
          </span>
          <span>
            Quinze-Cent
            <small>Tableaux NF C 15-100</small>
          </span>
        </div>

        <button type="button" className="project-card" onClick={() => setMenu(true)}>
          <span className="avatar">{(project.house.name.trim()[0] ?? "M").toUpperCase()}</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <b>{project.house.name || "Mon projet"}</b>
            <span>
              {project.house.surfaceM2} m² · monophasé {project.house.subscriptionKva} kVA
            </span>
          </span>
          <IconChevronRight size={16} />
        </button>

        <nav className="nav">
          {navItem("overview", "Vue d'ensemble", <IconDashboard />)}
          {navItem("house", "Ma maison", <IconHome />)}
          <div className="nav-label">
            Tableaux
            <button type="button" className="nav-add" onClick={() => addPanel("new")} aria-label="Nouveau tableau" title="Nouveau tableau">
              <IconPlus size={14} />
            </button>
          </div>
          {project.panels.map((p) => (
            <button
              key={p.id}
              type="button"
              className="nav-item"
              aria-current={view === "panel" && project.activePanelId === p.id ? "page" : undefined}
              onClick={() => {
                openPanel(p.id);
                setNavOpen(false);
              }}
            >
              <IconPanel />
              <span className="nav-text">{p.name}</span>
              <span className="status-dot" data-tone={p.rows.flat().length === 0 ? "empty" : severities.get(p.id) ?? "ok"} title={p.role === "existing" ? "Existant" : "Nouveau"} />
            </button>
          ))}
          <div className="nav-label">Analyse</div>
          {navItem("analysis", "Conformité", <IconShield />)}
          {navItem("materials", "Matériel & achats", <IconBox />)}
          {navItem("assistant", "Assistant IA", <IconSparkles />)}
        </nav>

        <div className="sidebar-foot">
          <span className="save-status" data-status={status}>
            {STATUS_LABEL[status]}
          </span>
          <div className="segmented" role="group" aria-label="Thème" style={{ alignSelf: "flex-start" }}>
            <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")} aria-label="Thème clair" title="Clair">
              <IconSun size={15} />
            </button>
            <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")} aria-label="Thème sombre" title="Sombre">
              <IconMoon size={15} />
            </button>
            <button type="button" aria-pressed={theme === "system"} onClick={() => setTheme("system")} title="Selon le système">
              Auto
            </button>
          </div>
        </div>
      </aside>
      <div className="scrim" data-open={navOpen} onClick={() => setNavOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button type="button" className="btn btn-ghost btn-icon btn-sm menu-btn" onClick={() => setNavOpen(true)} aria-label="Ouvrir la navigation">
            <IconMenu />
          </button>
          <div className="breadcrumb">
            <span>{project.house.name || "Mon projet"}</span>
            <IconChevronRight size={14} />
            <b>{view === "panel" && activePanel ? activePanel.name : VIEW_TITLE[view]}</b>
          </div>
          <span className="spacer" />
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)" aria-label="Annuler">
            <IconUndo size={17} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Y)" aria-label="Rétablir">
            <IconRedo size={17} />
          </button>
          {view !== "assistant" && (
            <button type="button" className="btn btn-sm" onClick={() => go("assistant")}>
              <IconSparkles size={16} /> Assistant
            </button>
          )}
        </header>

        <main className="content">
          {project.updatedAt === 0 && (
            <div className="alert" style={{ marginBottom: 20 }}>
              <IconInfo size={18} />
              <div className="alert-body">
                <b>Projet d'exemple.</b> Un tableau des années 1990 avec ses défauts est chargé pour découvrir l'outil. Modifiez-le pour décrire le
                vôtre, ou repartez de zéro.
              </div>
              <button type="button" className="btn btn-sm" onClick={() => useStore.getState().startBlank()}>
                Partir de zéro
              </button>
            </div>
          )}
          {view === "overview" && <OverviewView onNavigate={go} />}
          {view === "house" && <HouseView />}
          {view === "panel" && <PanelView onAsk={ask} />}
          {view === "analysis" && <AnalysisView onAsk={ask} />}
          {view === "materials" && <MaterialsView />}
          {view === "assistant" && <AssistantView pending={pendingQuestion} onPendingHandled={() => setPendingQuestion(undefined)} />}
        </main>
      </div>

      {menu && <ProjectMenu onClose={() => setMenu(false)} />}
      <Toasts />
    </div>
  );
}

function ProjectMenu({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const replaceProject = useStore((s) => s.replaceProject);
  const resetToSample = useStore((s) => s.resetToSample);
  const startBlank = useStore((s) => s.startBlank);
  const updateHouse = useStore((s) => s.updateHouse);
  const [confirm, setConfirm] = useState<"blank" | "sample">();
  const [error, setError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Modal title="Projet" subtitle="Le projet s'enregistre automatiquement. Exportez-le pour le conserver ou le transférer." onClose={onClose} size="sm">
      <label className="field">
        <span className="label">Nom du projet</span>
        <input id="project-name" className="input" value={project.house.name} onChange={(e) => updateHouse({ name: e.target.value })} />
      </label>
      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={async () => {
            const ok = await exportFile(`quinze-cent-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(project, null, 2), "application/json");
            if (ok) toast("Projet exporté");
          }}
        >
          <IconDownload size={16} /> Exporter
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          <IconUpload size={16} /> Importer
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
              toast("Projet importé");
              onClose();
            } catch (err) {
              setError((err as Error).message || "Fichier illisible.");
            }
          }}
        />
      </div>
      {error && <p className="error-text">{error}</p>}
      <hr className="divider" />
      <div className="stack">
        <h3>Recommencer</h3>
        {confirm ? (
          <div className="alert" data-tone="warn">
            <IconInfo size={18} />
            <div className="alert-body">
              {confirm === "blank" ? "Remplacer le projet par un tableau vide ?" : "Remplacer le projet par l'exemple ?"} Vous pourrez annuler avec{" "}
              <span className="kbd">Ctrl</span> <span className="kbd">Z</span>.
              <div className="row" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-danger-solid"
                  onClick={() => {
                    if (confirm === "blank") startBlank();
                    else resetToSample();
                    onClose();
                  }}
                >
                  Remplacer
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirm(undefined)}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="row">
            <button type="button" className="btn" onClick={() => setConfirm("blank")}>
              Nouveau projet vide
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm("sample")}>
              Recharger l'exemple
            </button>
          </div>
        )}
      </div>
      <p className="muted xsmall">
        Quinze-Cent aide à préparer une mise en conformité. Il ne remplace pas un électricien qualifié ni l'attestation Consuel. Travaillez toujours hors
        tension.
      </p>
    </Modal>
  );
}
