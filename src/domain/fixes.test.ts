import { describe, expect, it } from "vitest";
import { analyzePanel } from "./analysis";
import { autoFix, quickFixFor } from "./fixes";
import { defaultHouse, samplePanel } from "./sample";
import type { Panel } from "./types";

const house = defaultHouse();
const serious = (p: Panel) => analyzePanel(p, house).filter((f) => f.severity === "danger" || f.severity === "nonconforme");

describe("corrections en un clic", () => {
  it("proposent une correction pour la plupart des non-conformités", () => {
    const panel: Panel = { ...samplePanel(), role: "new" };
    const findings = serious(panel);
    const fixable = findings.filter((f) => quickFixFor(f, panel, house));
    expect(fixable.length / findings.length).toBeGreaterThan(0.7);
  });

  it("font disparaître le constat corrigé", () => {
    const panel: Panel = { ...samplePanel(), role: "new" };
    for (const f of serious(panel)) {
      const fix = quickFixFor(f, panel, house);
      if (!fix) continue;
      const after = analyzePanel(fix.apply(panel), house);
      expect(after.some((x) => x.id === f.id && x.title === f.title), `${f.ruleId} : ${fix.label}`).toBe(false);
    }
  });

  it("rendent le tableau d'exemple nettement plus conforme en série", () => {
    const panel: Panel = { ...samplePanel(), role: "new" };
    const before = serious(panel);
    const after = serious(autoFix(panel, house));
    expect(after.filter((f) => f.severity === "danger")).toEqual([]);
    expect(after.length).toBeLessThan(before.length / 3);
  });

  it("scindent un circuit trop chargé", () => {
    const panel: Panel = { ...samplePanel(), role: "new" };
    const f = serious(panel).find((x) => x.ruleId === "points-max")!;
    const next = quickFixFor(f, panel, house)!.apply(panel);
    expect(next.rows.flat().length).toBe(panel.rows.flat().length + 1);
  });
});
