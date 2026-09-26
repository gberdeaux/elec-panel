import { describe, expect, it } from "vitest";
import { samplePanel } from "../domain/sample";
import { DEFAULT_LABEL_SETTINGS } from "../domain/types";
import { stripsFor, wrapText } from "./Labels";
import { labelSheetMarkup } from "./labelSheetMarkup";

describe("étiquettes", () => {
  it("coupent le texte en lignes qui tiennent dans la case", () => {
    const lines = wrapText("Chambre 1 Chambre parentale", 16, 2.5, 4);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => l.length <= Math.floor(16 / (2.5 * 0.54)))).toBe(true);
  });

  it("limitent le nombre de lignes", () => {
    expect(wrapText("un texte beaucoup trop long pour une seule petite case", 10, 2.5, 2)).toHaveLength(2);
  });

  it("découpent une rangée plus large que la feuille", () => {
    const panel = { ...samplePanel(), enclosure: { ...samplePanel().enclosure, modulesPerRow: 18 } };
    const strips = stripsFor(panel, DEFAULT_LABEL_SETTINGS);
    expect(strips.filter((s) => s.row === 0)).toHaveLength(2);
    expect(strips.every((s) => s.modules * DEFAULT_LABEL_SETTINGS.moduleMm <= 270)).toBe(true);
  });

  it("produisent une planche SVG à l'échelle réelle", () => {
    const svg = labelSheetMarkup(samplePanel(), DEFAULT_LABEL_SETTINGS);
    expect(svg.startsWith("<?xml")).toBe(true);
    expect(svg).toMatch(/width="[\d.]+mm"/);
    expect(svg).toContain(">Lumières<");
    expect(svg).toContain(">RDC<");
    expect(svg).toContain("Rangée 3");
  });
});
