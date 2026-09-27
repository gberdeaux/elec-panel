import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../store/store";
import { analyzePanel } from "./analysis";
import { generateCompliantPanel } from "./generator";
import { newId, protectionMap, rowModules } from "./panel";
import { defaultHouse, samplePanel } from "./sample";
import type { Device } from "./types";

const feeder = (): Device => ({
  id: newId(),
  kind: "mcb",
  modules: 1,
  rating: 32,
  curve: "C",
  poles: "1P+N",
  label: "Garage",
  protectedBy: null,
  condition: "bon",
  circuit: { usage: "tableau_secondaire", rooms: "Garage", points: 1, sectionMm2: 10 },
});

describe("alimentation d'un tableau secondaire", () => {
  it("peut rester hors différentiel 30 mA : un simple rappel remplace le danger", () => {
    const panel = samplePanel();
    const f = feeder();
    panel.rows[0].push(f);
    const findings = analyzePanel(panel, defaultHouse()).filter((x) => x.deviceIds?.includes(f.id));
    expect(findings.some((x) => x.ruleId === "sans-30ma")).toBe(false);
    expect(findings.find((x) => x.ruleId === "tableau-secondaire")?.severity).toBe("conseil");
  });

  it("est placée hors différentiel dans le tableau généré", () => {
    const source = samplePanel();
    source.rows[0].push(feeder());
    const { panel, notes } = generateCompliantPanel(source, defaultHouse(), { brand: "Schneider", modulesPerRow: 13 });
    const out = panel.rows.flat().find((d) => d.circuit?.usage === "tableau_secondaire");
    expect(out?.protectedBy).toBeNull();
    expect(protectionMap(panel).get(out!.id)).toBeFalsy();
    expect(notes.some((n) => n.includes("tableau secondaire"))).toBe(true);
  });
});

describe("placement libre dans une rangée", () => {
  beforeEach(() => {
    const project = useStore.getState().project;
    useStore.getState().replacePanel({ ...project.panels[0], rows: [[], [], []] });
  });

  it("laisse un obturateur entre les autres appareils et le départ écarté", () => {
    const { project, addDevice } = useStore.getState();
    const panelId = project.panels[0].id;
    addDevice(panelId, 0, { kind: "rcd", modules: 2, rating: 40, rcdType: "AC", sensitivity: 30, condition: "bon" });
    addDevice(panelId, 0, feeder(), undefined, 9);
    const row = useStore.getState().project.panels[0].rows[0];
    expect(row.map((d) => d.kind)).toEqual(["rcd", "blank", "mcb"]);
    expect(row[1].modules).toBe(7);
    expect(rowModules(row)).toBe(10);
  });

  it("ne fait jamais déborder la rangée", () => {
    const { project, addDevice, moveDevice } = useStore.getState();
    const panelId = project.panels[0].id;
    const id = addDevice(panelId, 1, { kind: "mcb", modules: 1, rating: 16, condition: "bon" });
    moveDevice(panelId, id, 1, 1, 40);
    const row = useStore.getState().project.panels[0].rows[1];
    expect(rowModules(row)).toBe(project.panels[0].enclosure.modulesPerRow);
    expect(row[row.length - 1].id).toBe(id);
  });
});
