import { describe, expect, it } from "vitest";
import { analyzePanel } from "../domain/analysis";
import { generateCompliantPanel } from "../domain/generator";
import { rowModules } from "../domain/panel";
import { defaultHouse } from "../domain/sample";
import { type PhotoDevice, type PhotoResult, panelFromPhoto, parsePhotoAnswer } from "./photo";

const sch = (label: string, usage: string, rooms: string): PhotoDevice => ({ kind: "mcb", rating: 20, curve: "C", brand: "Schneider", series: "D'clic", label, icon: "prises", usage, rooms });
const lg = (rating: number, label: string, usage: string, icon: string): PhotoDevice => ({ kind: "mcb", rating, curve: "C", brand: "Legrand", series: "DNX3", label, icon, usage });
const id = (label: string): PhotoDevice => ({ kind: "rcd", modules: 2, rating: 40, rcdType: "AC", sensitivity: 30, brand: "Schneider", series: "Resi9", label, icon: "rcd" });

/** Réponse attendue de l'IA pour une photo de tableau réel (trois rangées de 13 modules). */
const PHOTO: PhotoResult = {
  enclosure: { rows: 3, modulesPerRow: 13, brand: "Legrand" },
  rows: [
    [
      id("Différentiel Etage Télérupteur"),
      sch("Chambre 1 Chambre parentale", "prises", "Chambre 1"),
      sch("Chambre 2 Bureau Chloé", "prises", "Chambre 2"),
      sch("Chambre 3 Chambre Amis", "prises", "Chambre 3"),
      sch("Chambre 4 Bureau Guillaume", "prises", "Chambre 4"),
      sch("SDB Prise + Miroir", "prises", "Salle de bain"),
      lg(16, "Volets", "volets", "volets"),
      lg(10, "Lumières Chambres", "eclairage", "eclairage"),
      lg(10, "Lumières Couloir + SDB", "eclairage", "eclairage"),
      { kind: "mcb", rating: 2, curve: "C", brand: "Schneider", series: "Resi9", label: "VMC", icon: "vmc", usage: "vmc" },
    ],
    [
      id("Différentiel Rez-de-chaussée"),
      lg(32, "Four + Plaque + Vaisselle", "plaque", "four"),
      sch("Salon TV", "prises", "Salon"),
      sch("Salon Canapé", "prises", "Salon"),
      sch("Salle à manger", "prises", "Salle à manger"),
      sch("Poêle", "prises", "Séjour"),
      sch("Veranda", "prises", "Véranda"),
      lg(20, "Cuisine mur garage", "prises_cuisine", "prises"),
      lg(20, "Cuisine mur intérieur + ?", "prises_cuisine", "prises"),
      { ...lg(10, "Garage", "eclairage", "eclairage"), condition: "usé" },
      lg(10, "Cuisine", "eclairage", "eclairage"),
      lg(10, "Toilette", "eclairage", "eclairage"),
    ],
    [
      id("Différentiel Technique"),
      lg(20, "Adoucisseur + Prise", "adoucisseur", "eau"),
      lg(20, "Chaudière", "chaudiere", "chaudiere"),
      lg(20, "Garage", "prises", "prises"),
      { kind: "blank", modules: 2 },
      lg(20, "Télérupteur Salon / Salle à manger", "eclairage", "teleruptor"),
      { kind: "teleruptor", rating: 16, brand: "Legrand", label: "Télérupteur Salon / Salle à manger", icon: "teleruptor" },
      lg(20, "Télérupteur Couloir", "eclairage", "teleruptor"),
      { kind: "teleruptor", rating: 16, brand: "Legrand", label: "Télérupteur Couloir", icon: "teleruptor" },
      { kind: "blank", modules: 2 },
    ],
  ],
};

describe("import d'un tableau depuis une photo", () => {
  const { panel } = panelFromPhoto(PHOTO);

  it("reconstruit les rangées, les gammes et les étiquettes", () => {
    expect(panel.rows).toHaveLength(3);
    expect(panel.enclosure.modulesPerRow).toBe(13);
    expect(panel.rows.map(rowModules)).toEqual([11, 13, 11]);
    const first = panel.rows[0];
    expect(first[0].kind).toBe("rcd");
    expect(first[1].series).toBe("D'clic");
    expect(first[1].circuit?.usage).toBe("prises");
    expect(first[1].label).toBe("Chambre 1 Chambre parentale");
    expect(panel.rows[1][9].condition).toBe("usé");
  });

  it("garde un obturateur au milieu d'une rangée mais pas en fin de rangée", () => {
    const row = panel.rows[2];
    expect(row[4].kind).toBe("blank");
    expect(row[row.length - 1].kind).toBe("teleruptor");
    expect(row.filter((d) => d.kind === "teleruptor")).toHaveLength(2);
  });

  it("permet l'analyse puis la génération d'un tableau conforme", () => {
    const house = defaultHouse();
    expect(analyzePanel(panel, house).some((f) => f.ruleId === "rcd-type-a")).toBe(true);
    const { panel: generated } = generateCompliantPanel(panel, house, { brand: "Legrand", modulesPerRow: 13 });
    const bad = analyzePanel(generated, house).filter((f) => f.severity === "danger" || f.severity === "nonconforme");
    expect(bad.map((f) => f.title)).toEqual([]);
  });

  it("ignore les valeurs incohérentes", () => {
    const { panel: odd } = panelFromPhoto({ rows: [[{ kind: "mcb", rating: 9999, brand: "Inconnue", modules: 40 }, { kind: "blank" }]] });
    expect(odd.rows[0]).toHaveLength(1);
    expect(odd.rows[0][0].rating).toBeUndefined();
    expect(odd.rows[0][0].brand).toBeUndefined();
    expect(odd.rows[0][0].modules).toBe(1);
  });
});

describe("réponse collée depuis une conversation Claude", () => {
  it("lit un bloc de code entouré de texte", () => {
    const answer = ["Voici le relevé :", "```json", JSON.stringify(PHOTO), "```", "Bonne journée"].join(String.fromCharCode(10));
    expect(panelFromPhoto(parsePhotoAnswer(answer)).panel.rows).toHaveLength(3);
  });

  it("accepte directement la liste des rangées", () => {
    expect(parsePhotoAnswer(JSON.stringify(PHOTO.rows)).rows).toHaveLength(3);
  });

  it("explique quand la réponse est tronquée", () => {
    expect(() => parsePhotoAnswer('{"rows": [[{"kind": "mcb"')).toThrow(/incomplète|JSON/);
    expect(() => parsePhotoAnswer("pas de json")).toThrow(/JSON/);
  });
});
