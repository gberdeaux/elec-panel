import { create } from "zustand";
import { produce } from "immer";
import { type CatalogItem, syncCatalog } from "../domain/catalog";
import { type GenerateOptions, generateCompliantPanel, rebrandPanel } from "../domain/generator";
import { findDevice, newId } from "../domain/panel";
import { emptyPanel, sampleProject } from "../domain/sample";
import { type Brand, type ChatTurn, DEFAULT_LABEL_SETTINGS, type Device, type Enclosure, type House, type InventoryEntry, type LabelSettings, type Panel, type PanelRole, type Project } from "../domain/types";

export type View = "overview" | "house" | "panel" | "compare" | "labels" | "analysis" | "materials" | "assistant";

interface State {
  project: Project;
  past: Project[];
  future: Project[];
  view: View;
  selectedDeviceId?: string;
  lastNotes: string[];

  setView(view: View): void;
  selectDevice(id?: string): void;
  undo(): void;
  redo(): void;
  replaceProject(p: Project, opts?: { keepHistory?: boolean }): void;
  resetToSample(): void;
  startBlank(): void;

  updateHouse(patch: Partial<House>): void;

  addPanel(role: PanelRole): void;
  duplicatePanel(id: string): void;
  removePanel(id: string): void;
  openPanel(id: string): void;
  updatePanel(id: string, patch: Partial<Pick<Panel, "name" | "role" | "controlHeightM">>): void;
  updateEnclosure(id: string, patch: Partial<Enclosure>): void;
  rebrand(id: string, brand: Brand): void;
  generate(sourceId: string, opts: GenerateOptions, replaceId?: string): void;
  createPanelFrom(panel: Panel): void;

  addDevice(panelId: string, row: number, device: Omit<Device, "id">, index?: number): string;
  /** Remplace un tableau entier (corrections automatiques). */
  replacePanel(panel: Panel): void;
  updateDevice(panelId: string, deviceId: string, patch: Partial<Device>): void;
  removeDevice(panelId: string, deviceId: string): void;
  moveDevice(panelId: string, deviceId: string, toRow: number, toIndex: number): void;
  duplicateDevice(panelId: string, deviceId: string): void;

  setInventory(key: string, patch: Partial<InventoryEntry> | null): void;
  setCrossBrand(value: boolean): void;
  setMaterialPanels(sourceId?: string, targetId?: string): void;
  addCustomItem(item: Omit<CatalogItem, "id" | "custom">): string;

  setChat(chat: ChatTurn[]): void;
  setLabelSettings(patch: Partial<LabelSettings>): void;
}

const HISTORY_LIMIT = 60;

export const useStore = create<State>((set, get) => {
  /** Applique une modification au projet en gardant l'historique. */
  let lastKey: string | undefined;
  let lastAt = 0;
  /** Les saisies successives d'un même champ (frappe au clavier) forment une seule étape d'annulation. */
  const commit = (recipe: (draft: Project) => void, coalesceKey?: string) => {
    const current = get().project;
    const next = produce(current, (draft) => {
      recipe(draft);
      draft.updatedAt = Date.now();
    });
    if (next === current) return;
    const now = Date.now();
    const merge = coalesceKey !== undefined && coalesceKey === lastKey && now - lastAt < 1200;
    lastKey = coalesceKey;
    lastAt = now;
    set({ project: next, past: merge ? get().past : [...get().past, current].slice(-HISTORY_LIMIT), future: [] });
  };

  /** Modification sans historique (navigation, conversation). */
  const quiet = (recipe: (draft: Project) => void) => {
    set({ project: produce(get().project, (draft) => { recipe(draft); draft.updatedAt = Date.now(); }) });
  };

  const panelOf = (draft: Project, id: string) => draft.panels.find((p) => p.id === id);

  return {
    project: sampleProject(),
    past: [],
    future: [],
    view: "overview",
    selectedDeviceId: undefined,
    lastNotes: [],

    setView: (view) => set({ view }),
    selectDevice: (id) => set({ selectedDeviceId: id }),

    undo: () => {
      const { past, project, future } = get();
      if (!past.length) return;
      set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future] });
    },
    redo: () => {
      const { past, project, future } = get();
      if (!future.length) return;
      set({ project: future[0], past: [...past, project], future: future.slice(1) });
    },

    replaceProject: (p, opts) =>
      set({
        project: p,
        past: opts?.keepHistory ? [...get().past, get().project] : [],
        future: [],
        selectedDeviceId: undefined,
      }),
    resetToSample: () => get().replaceProject({ ...sampleProject(), updatedAt: Date.now() }, { keepHistory: true }),
    startBlank: () => {
      const base = sampleProject();
      const panel = emptyPanel("Tableau existant", "existing");
      get().replaceProject(
        { ...base, updatedAt: Date.now(), panels: [panel], activePanelId: panel.id, sourcePanelId: panel.id, targetPanelId: undefined },
        { keepHistory: true },
      );
      set({ view: "panel" });
    },

    updateHouse: (patch) =>
      commit((d) => {
        Object.assign(d.house, patch);
      }, `house:${Object.keys(patch).join()}`),

    addPanel: (role) => {
      const panel = emptyPanel(role === "new" ? "Nouveau tableau" : "Tableau existant", role);
      commit((d) => {
        d.panels.push(panel);
        d.activePanelId = panel.id;
        if (role === "new" && !d.targetPanelId) d.targetPanelId = panel.id;
        if (role === "existing" && !d.sourcePanelId) d.sourcePanelId = panel.id;
      });
      set({ view: "panel", selectedDeviceId: undefined });
    },
    duplicatePanel: (id) => {
      const src = get().project.panels.find((p) => p.id === id);
      if (!src) return;
      const copy: Panel = {
        ...structuredClone(src),
        id: newId("p"),
        name: `${src.name} (copie)`,
        role: "new",
        rows: src.rows.map((r) => r.map((dev) => ({ ...structuredClone(dev), id: newId() }))),
      };
      get().createPanelFrom(copy);
    },
    removePanel: (id) =>
      commit((d) => {
        if (d.panels.length <= 1) return;
        d.panels = d.panels.filter((p) => p.id !== id);
        if (d.activePanelId === id) d.activePanelId = d.panels[0].id;
        if (d.sourcePanelId === id) d.sourcePanelId = d.panels.find((p) => p.role === "existing")?.id;
        if (d.targetPanelId === id) d.targetPanelId = d.panels.find((p) => p.role === "new")?.id;
      }),
    openPanel: (id) => {
      quiet((d) => {
        d.activePanelId = id;
      });
      set({ view: "panel", selectedDeviceId: undefined });
    },
    updatePanel: (id, patch) =>
      commit((d) => {
        const p = panelOf(d, id);
        if (p) Object.assign(p, patch);
      }, `panel:${id}:${Object.keys(patch).join()}`),
    updateEnclosure: (id, patch) =>
      commit((d) => {
        const p = panelOf(d, id);
        if (!p) return;
        Object.assign(p.enclosure, patch);
        const wanted = p.enclosure.rows;
        while (p.rows.length < wanted) p.rows.push([]);
        // On ne supprime que des rangées vides en fin de coffret.
        while (p.rows.length > wanted && p.rows[p.rows.length - 1].length === 0) p.rows.pop();
        p.enclosure.rows = Math.max(wanted, p.rows.length);
      }),
    rebrand: (id, brand) =>
      commit((d) => {
        const idx = d.panels.findIndex((p) => p.id === id);
        if (idx >= 0) d.panels[idx] = rebrandPanel(d.panels[idx] as Panel, brand, d.customCatalog as CatalogItem[]);
      }),
    generate: (sourceId, opts, replaceId) => {
      const { project } = get();
      const source = project.panels.find((p) => p.id === sourceId);
      if (!source) return;
      const { panel, notes } = generateCompliantPanel(source, project.house, opts, project.customCatalog);
      commit((d) => {
        if (replaceId) {
          const idx = d.panels.findIndex((p) => p.id === replaceId);
          if (idx >= 0) {
            panel.id = replaceId;
            panel.name = d.panels[idx].name;
            d.panels[idx] = panel;
          } else d.panels.push(panel);
        } else d.panels.push(panel);
        d.activePanelId = panel.id;
        d.sourcePanelId = sourceId;
        d.targetPanelId = panel.id;
      });
      set({ view: "panel", selectedDeviceId: undefined, lastNotes: notes });
    },
    createPanelFrom: (panel) => {
      commit((d) => {
        d.panels.push(panel);
        d.activePanelId = panel.id;
        if (panel.role === "new") d.targetPanelId = panel.id;
        else d.sourcePanelId = d.sourcePanelId ?? panel.id;
      });
      set({ view: "panel", selectedDeviceId: undefined });
    },

    addDevice: (panelId, row, device, index) => {
      const id = newId();
      commit((d) => {
        const p = panelOf(d, panelId);
        if (!p) return;
        while (p.rows.length <= row) p.rows.push([]);
        p.enclosure.rows = Math.max(p.enclosure.rows, p.rows.length);
        const target = p.rows[row];
        target.splice(index ?? target.length, 0, { ...device, id } as Device);
      });
      set({ selectedDeviceId: id });
      return id;
    },
    replacePanel: (panel) =>
      commit((d) => {
        const idx = d.panels.findIndex((p) => p.id === panel.id);
        if (idx >= 0) d.panels[idx] = panel;
      }),
    updateDevice: (panelId, deviceId, patch) =>
      commit((d) => {
        const p = panelOf(d, panelId);
        if (!p) return;
        const loc = findDevice(p as Panel, deviceId);
        if (!loc) return;
        const device = p.rows[loc.row][loc.index];
        Object.assign(device, patch);
        // Un calibre, un type ou une marque changés : l'article et la référence suivent.
        if (["kind", "rating", "rcdType", "curve", "brand"].some((k) => k in patch) && !("catalogId" in patch)) {
          const synced = syncCatalog(device as Device, d.customCatalog);
          device.catalogId = synced.catalogId;
          device.ref = synced.ref;
        }
      }, `device:${deviceId}:${Object.keys(patch).join()}`),
    removeDevice: (panelId, deviceId) => {
      commit((d) => {
        const p = panelOf(d, panelId);
        if (!p) return;
        p.rows = p.rows.map((r) => r.filter((x) => x.id !== deviceId));
        for (const row of p.rows) for (const x of row) if (x.protectedBy === deviceId) x.protectedBy = undefined;
      });
      if (get().selectedDeviceId === deviceId) set({ selectedDeviceId: undefined });
    },
    moveDevice: (panelId, deviceId, toRow, toIndex) =>
      commit((d) => {
        const p = panelOf(d, panelId);
        if (!p) return;
        const loc = findDevice(p as Panel, deviceId);
        if (!loc) return;
        const [dev] = p.rows[loc.row].splice(loc.index, 1);
        while (p.rows.length <= toRow) p.rows.push([]);
        p.enclosure.rows = Math.max(p.enclosure.rows, p.rows.length);
        const adjusted = loc.row === toRow && toIndex > loc.index ? toIndex - 1 : toIndex;
        p.rows[toRow].splice(Math.max(0, Math.min(adjusted, p.rows[toRow].length)), 0, dev);
      }),
    duplicateDevice: (panelId, deviceId) => {
      const p = get().project.panels.find((x) => x.id === panelId);
      const loc = p && findDevice(p, deviceId);
      if (!loc) return;
      const { id: _id, ...rest } = structuredClone(loc.device);
      void _id;
      get().addDevice(panelId, loc.row, rest, loc.index + 1);
    },

    setInventory: (key, patch) =>
      commit((d) => {
        if (patch === null) {
          delete d.inventory[key];
          return;
        }
        const next = { ...d.inventory[key], ...patch };
        for (const k of Object.keys(next) as (keyof InventoryEntry)[]) if (next[k] === undefined) delete next[k];
        if (Object.keys(next).length) d.inventory[key] = next;
        else delete d.inventory[key];
      }, `inv:${key}:${patch ? Object.keys(patch).join() : ""}`),
    setCrossBrand: (value) =>
      commit((d) => {
        d.allowCrossBrandReuse = value;
      }),
    setMaterialPanels: (sourceId, targetId) =>
      commit((d) => {
        d.sourcePanelId = sourceId;
        d.targetPanelId = targetId;
      }),
    addCustomItem: (item) => {
      const id = newId("c");
      commit((d) => {
        d.customCatalog.push({ ...item, id, custom: true });
      });
      return id;
    },

    setLabelSettings: (patch) =>
      commit((d) => {
        d.labelSettings = { ...DEFAULT_LABEL_SETTINGS, ...d.labelSettings, ...patch };
      }, `labels:${Object.keys(patch).join()}`),
    setChat: (chat) =>
      quiet((d) => {
        d.chat = chat;
      }),
  };
});

export const useActivePanel = () =>
  useStore((s) => s.project.panels.find((p) => p.id === s.project.activePanelId) ?? s.project.panels[0]);
