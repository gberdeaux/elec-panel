import { describe, expect, it } from "vitest";
import { analyzePanel, rcdLoad, surgeProtection, verdict } from "./analysis";
import { bomTotals, computeBom, isReusable } from "./bom";
import { generateCompliantPanel, planCircuit } from "./generator";
import { expectedProtection, maxPointsFor, maxRatingForSection, recommendedRating } from "./norm";
import { circuitsByRcd, newId, protectionMap } from "./panel";
import { defaultHouse, samplePanel, sampleProject } from "./sample";
import type { Device, Panel } from "./types";

const ruleIds = (panel: Panel) => analyzePanel(panel, defaultHouse()).map((f) => f.ruleId);

describe("norme", () => {
  it("donne le calibre maximal selon la section", () => {
    expect(maxRatingForSection(1.5)).toBe(16);
    expect(maxRatingForSection(2.5)).toBe(20);
    expect(maxRatingForSection(6)).toBe(32);
  });

  it("dimensionne le chauffage et les bornes selon la puissance", () => {
    expect(expectedProtection("chauffage", 4000)).toEqual({ rating: 20, section: 2.5 });
    expect(expectedProtection("chauffage", 6000)).toEqual({ rating: 32, section: 6 });
    expect(expectedProtection("irve_borne", 7400)).toEqual({ rating: 40, section: 10 });
    expect(expectedProtection("irve_borne", 3700)).toEqual({ rating: 20, section: 2.5 });
  });

  it("limite le nombre de prises selon le calibre", () => {
    expect(maxPointsFor("prises", 16)).toBe(8);
    expect(maxPointsFor("prises", 20)).toBe(12);
    expect(maxPointsFor("eclairage", 16)).toBe(8);
    expect(maxPointsFor("lave_linge", 20)).toBe(1);
  });
});

describe("calibre conseillé", () => {
  it("accepte tout calibre admis par la norme", () => {
    expect(recommendedRating("vmc", 2, 1.5)).toBe(2);
    expect(recommendedRating("eclairage", 10, 1.5)).toBe(10);
    expect(recommendedRating("eclairage", 16, 1.5)).toBe(16);
    expect(recommendedRating("chaudiere", 10, 1.5)).toBe(10);
  });

  it("corrige un calibre non admis en tenant compte de la section", () => {
    expect(recommendedRating("eclairage", 20, 1.5)).toBe(16);
    expect(recommendedRating("prises", 25, 2.5)).toBe(20);
    expect(recommendedRating("lave_linge", 20, 1.5)).toBe(16);
    expect(recommendedRating("vmc", undefined, 1.5)).toBe(2);
  });

  it("vérifie la puissance du chauffage", () => {
    expect(recommendedRating("chauffage", 20, 2.5, 4000)).toBe(20);
    expect(recommendedRating("chauffage", 16, 2.5, 4000)).toBe(20);
  });
});

describe("tableau existant d'exemple", () => {
  const panel = samplePanel();
  const ids = ruleIds(panel);

  it("rattache les départs au différentiel de leur rangée", () => {
    const map = protectionMap(panel);
    expect(map.get(panel.rows[0][1].id)?.kind).toBe("rcd");
    expect(map.get(panel.rows[1][0].id)).toBeNull();
    expect(circuitsByRcd(panel).get(panel.rows[0][0].id)?.length).toBe(10);
  });

  it("détecte les non-conformités attendues", () => {
    for (const rule of [
      "sans-30ma",
      "rcd-8-circuits",
      "fusible",
      "coupure-neutre",
      "section-calibre",
      "points-max",
      "calibre-usage",
      "chauffage-surcharge",
      "rcd-type",
      "rcd-min",
      "rcd-type-a",
      "prises-cuisine",
      "repartition-eclairage",
      "terre-inconnue",
    ]) {
      expect(ids, rule).toContain(rule);
    }
    expect(verdict(analyzePanel(panel, defaultHouse())).status).toBe("dangereux");
  });

  it("calcule la charge d'un différentiel selon la règle de l'aval", () => {
    const circuits: Device[] = [
      { id: "a", kind: "mcb", modules: 1, rating: 20, circuit: { usage: "chauffage", rooms: "", points: 2 } },
      { id: "b", kind: "mcb", modules: 1, rating: 16, circuit: { usage: "prises", rooms: "", points: 6 } },
      { id: "c", kind: "mcb", modules: 1, rating: 10, circuit: { usage: "eclairage", rooms: "", points: 4 } },
    ];
    expect(rcdLoad(circuits)).toBe(33);
  });
});

describe("parafoudre", () => {
  it("est obligatoire en zone AQ2 avec alimentation aérienne", () => {
    expect(surgeProtection({ ...defaultHouse(), aq2Zone: true, overheadSupply: true })).toBe("obligatoire");
    expect(surgeProtection({ ...defaultHouse(), lightningRod: true })).toBe("obligatoire");
    expect(surgeProtection({ ...defaultHouse(), sensitiveEquipment: false })).toBe("facultatif");
  });
});

describe("génération du tableau conforme", () => {
  const house = defaultHouse();
  const source = samplePanel();

  for (const brand of ["Schneider", "Legrand", "Hager", "Lexman"] as const) {
    for (const modulesPerRow of [13, 18] as const) {
      it(`ne laisse aucune non-conformité (${brand}, ${modulesPerRow} modules)`, () => {
        const { panel } = generateCompliantPanel(source, house, { brand, modulesPerRow });
        const findings = analyzePanel(panel, house).filter((f) => f.severity === "danger" || f.severity === "nonconforme");
        expect(findings.map((f) => `${f.ruleId}: ${f.title}`)).toEqual([]);
      });
    }
  }

  it("scinde les circuits surchargés et signale le recâblage", () => {
    const notes: string[] = [];
    const parts = planCircuit(source.rows[0][4], notes);
    expect(parts).toHaveLength(2);
    expect(parts.every((p) => p.circuit.points <= 12)).toBe(true);

    const dishwasher = planCircuit(source.rows[0][8], notes)[0];
    expect(dishwasher.rating).toBe(20);
    expect(dishwasher.circuit.rewire).toBe(true);
    expect(notes.some((n) => n.includes("Recâbler"))).toBe(true);
  });

  it("conserve les calibres déjà admis (VMC 2 A, éclairage 10 A)", () => {
    const { panel } = generateCompliantPanel(source, house, { brand: "Schneider", modulesPerRow: 13 });
    const vmc = panel.rows.flat().find((d) => d.circuit?.usage === "vmc");
    expect(vmc?.rating).toBe(2);
    const withTen = { ...source, rows: source.rows.map((r) => r.map((d) => (d.circuit?.usage === "eclairage" ? { ...d, rating: 10 } : d))) };
    const lights = generateCompliantPanel(withTen, house, { brand: "Schneider", modulesPerRow: 13 }).panel.rows.flat().filter((d) => d.circuit?.usage === "eclairage");
    expect(lights.every((d) => d.rating === 10)).toBe(true);
  });

  it("protège une borne de recharge par un disjoncteur différentiel dédié", () => {
    const panel = samplePanel();
    panel.rows[2].push({
      id: newId(),
      kind: "mcb",
      modules: 1,
      rating: 32,
      curve: "C",
      poles: "1P+N",
      label: "Borne VE",
      circuit: { usage: "irve_borne", rooms: "Garage", points: 1, powerW: 7400, sectionMm2: 10 },
    });
    const { panel: generated } = generateCompliantPanel(panel, house, { brand: "Legrand", modulesPerRow: 13 });
    const rcbo = generated.rows.flat().find((d) => d.kind === "rcbo");
    expect(rcbo?.rating).toBe(40);
    expect(rcbo?.rcdType).toBe("A");
    const bad = analyzePanel(generated, house).filter((f) => f.severity === "nonconforme" || f.severity === "danger");
    expect(bad).toEqual([]);
  });
});

describe("liste de matériel", () => {
  it("réemploie les appareils conformes de même marque", () => {
    const project = sampleProject();
    const source = project.panels[0];
    const { panel } = generateCompliantPanel(source, project.house, { brand: "Legrand", modulesPerRow: 13 });
    const lines = computeBom(project, panel, source);
    const totals = bomTotals(lines);
    expect(totals.reused).toBeGreaterThan(0);
    expect(totals.toBuy).toBe(totals.items - totals.reused);
    const mcb20 = lines.find((l) => l.kind === "mcb" && l.label.includes("20 A"));
    expect(mcb20?.reuse.length).toBeGreaterThan(0);
  });

  it("ne réemploie pas une autre marque sans autorisation", () => {
    const project = sampleProject();
    const source = project.panels[0];
    const { panel } = generateCompliantPanel(source, project.house, { brand: "Schneider", modulesPerRow: 13 });
    expect(bomTotals(computeBom(project, panel, source)).reused).toBe(0);
    const cross = bomTotals(computeBom({ ...project, allowCrossBrandReuse: true }, panel, source));
    expect(cross.reused).toBeGreaterThan(0);
  });

  it("respecte les quantités saisies à la main", () => {
    const project = sampleProject();
    const source = project.panels[0];
    const { panel } = generateCompliantPanel(source, project.house, { brand: "Schneider", modulesPerRow: 13 });
    const first = computeBom(project, panel, source).find((l) => l.kind === "mcb")!;
    project.inventory[first.key] = { owned: first.needed };
    expect(computeBom(project, panel, source).find((l) => l.key === first.key)!.toBuy).toBe(0);
  });

  it("écarte les fusibles et disjoncteurs unipolaires du réemploi", () => {
    const panel = samplePanel();
    const fuse = panel.rows[0].find((d) => d.kind === "fuse")!;
    const onePole = panel.rows[1].find((d) => d.poles === "1P")!;
    expect(isReusable(fuse)).toBe(false);
    expect(isReusable(onePole)).toBe(false);
  });
});
