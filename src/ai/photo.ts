/** Lecture d'un tableau électrique à partir d'une photo, par l'assistant IA. */
import { USAGES, USAGE_ORDER } from "../domain/norm";
import { newId } from "../domain/panel";
import { BRANDS, type Brand, type CircuitUsage, type Curve, type Device, type DeviceKind, type Panel, type Poles, type RcdType } from "../domain/types";
import type { Assistant } from "./assistant";

export interface PhotoDevice {
  kind?: string;
  rating?: number;
  curve?: string;
  poles?: string;
  rcdType?: string;
  sensitivity?: number;
  modules?: number;
  brand?: string;
  series?: string;
  label?: string;
  icon?: string;
  usage?: string;
  rooms?: string;
  condition?: string;
}

export interface PhotoResult {
  enclosure?: { rows?: number; modulesPerRow?: number; brand?: string };
  rows?: PhotoDevice[][];
  remarks?: string;
}

const ICONS = [
  "eclairage", "prises", "prises_cuisine", "volets", "chauffage", "chauffe_eau", "plaque", "four", "lave_linge", "seche_linge",
  "lave_vaisselle", "congelateur", "micro_ondes", "vmc", "irve_prise", "irve_borne", "pac_clim", "chaudiere", "poele", "eau", "sdb",
  "tv", "informatique", "garage", "portail", "exterieur", "piscine", "alarme", "teleruptor", "contactor", "rcd", "spd", "autre",
] as const;

export const PHOTO_PROMPT = `Voici la photo d'un tableau électrique domestique français (monophasé). Relève chaque rangée de gauche à droite, appareil par appareil, en t'aidant du porte-étiquette situé au-dessus de chaque rangée : chaque case d'étiquette est alignée sur l'appareil qu'elle décrit.

Réponds uniquement avec un objet JSON de cette forme :
{"enclosure":{"rows":3,"modulesPerRow":13,"brand":"Legrand"},
 "rows":[[
   {"kind":"rcd","modules":2,"rating":40,"rcdType":"AC","sensitivity":30,"brand":"Schneider","series":"Resi9","label":"Différentiel Etage","icon":"rcd"},
   {"kind":"mcb","modules":1,"rating":20,"curve":"C","poles":"1P+N","brand":"Schneider","series":"D'clic","label":"Chambre 1 Chambre parentale","icon":"prises","usage":"prises","rooms":"Chambre 1"},
   {"kind":"blank","modules":2},
   {"kind":"teleruptor","modules":1,"rating":16,"brand":"Legrand","label":"Télérupteur Couloir","icon":"teleruptor"}
 ]],
 "remarks":"ce que tu n'as pas pu lire ou dont tu doutes"}

Règles :
- kind : mcb (disjoncteur), rcd (interrupteur différentiel, souvent 2 modules avec bouton test), rcbo (disjoncteur différentiel), fuse (porte-fusible), spd (parafoudre), contactor (contacteur heures creuses), teleruptor (télérupteur), switch, timer, socket, blank (obturateur ou emplacement vide situé ENTRE deux appareils), other.
- N'ajoute pas les emplacements vides en fin de rangée : ils sont déduits de modulesPerRow.
- modules : largeur en modules de 17,5 mm (un disjoncteur 1P+N = 1, un différentiel = 2).
- rating en ampères (le nombre après C : C20 → 20) ; curve B, C ou D ; poles 1P, 1P+N ou 2P ; rcdType AC, A, A-SI, F ou B ; sensitivity en mA.
- brand : Schneider, Legrand, Hager, Lexman ou Générique. series si visible : Resi9, D'clic, DNX3, DX3…
- label : le texte de l'étiquette au-dessus de l'appareil, recopié tel quel (sans retour à la ligne).
- icon, parmi : ${ICONS.join(", ")}.
- usage, déduit de l'étiquette et du calibre, parmi : ${USAGE_ORDER.join(", ")}. Une chambre, un salon ou un bureau en 16/20 A sont des « prises » ; un libellé « Lumières » ou en 10 A est « eclairage ».
- rooms : les pièces citées dans l'étiquette.
- condition : "usé" si l'appareil paraît sale, jauni ou brûlé.
N'invente rien : omets un champ illisible et signale-le dans remarks. N'inclus pas le disjoncteur de branchement s'il est séparé.`;

const KINDS: DeviceKind[] = ["mcb", "rcd", "rcbo", "fuse", "spd", "contactor", "teleruptor", "switch", "timer", "socket", "blank", "other"];

const oneOf = <T extends string>(value: unknown, list: readonly T[]): T | undefined =>
  list.find((v) => typeof value === "string" && v.toLowerCase() === value.trim().toLowerCase());

const num = (value: unknown, min: number, max: number): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

const text = (value: unknown, max = 80) => (typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim().slice(0, max) : undefined);

export function photoDeviceToDevice(p: PhotoDevice): Device {
  const kind = oneOf(p.kind, KINDS) ?? "other";
  const usage = oneOf(p.usage, USAGE_ORDER) as CircuitUsage | undefined;
  const series = text(p.series, 20);
  const device: Device = {
    id: newId(),
    kind,
    modules: num(p.modules, 1, 12) ?? (kind === "rcd" || kind === "spd" || kind === "rcbo" ? 2 : 1),
    rating: kind === "blank" ? undefined : num(p.rating, 1, 125),
    curve: oneOf(p.curve, ["B", "C", "D"] as Curve[]),
    poles: oneOf(p.poles, ["1P", "1P+N", "2P"] as Poles[]),
    rcdType: oneOf(p.rcdType, ["AC", "A", "A-SI", "F", "B"] as RcdType[]),
    sensitivity: num(p.sensitivity, 10, 1000),
    brand: oneOf(p.brand, BRANDS) as Brand | undefined,
    series: series && /d.?clic/i.test(series) ? "D'clic" : series,
    label: text(p.label),
    labelIcon: oneOf(p.icon, ICONS),
    condition: oneOf(p.condition, ["bon", "usé", "HS"] as const) ?? "inconnu",
  };
  if (kind === "mcb" || kind === "rcbo" || kind === "fuse") {
    if (!device.curve && kind !== "fuse") device.curve = "C";
    if (!device.poles) device.poles = "1P+N";
    if (usage) device.circuit = { usage, rooms: text(p.rooms, 60) ?? "", points: USAGES[usage].defaultPoints };
  }
  if ((kind === "rcd" || kind === "rcbo") && !device.sensitivity) device.sensitivity = 30;
  if (kind === "rcd" && !device.rcdType) device.rcdType = "AC";
  return device;
}

/** Construit un tableau existant à partir de la réponse de l'IA. */
export function panelFromPhoto(result: PhotoResult, name = "Tableau existant (photo)"): { panel: Panel; remarks?: string } {
  const rows = (Array.isArray(result?.rows) ? result.rows : []).map((r) => (Array.isArray(r) ? r.map(photoDeviceToDevice) : []));
  // Un obturateur en fin de rangée n'apporte rien : l'emplacement libre est déjà implicite.
  for (const row of rows) while (row.length && row[row.length - 1].kind === "blank") row.pop();
  if (!rows.some((r) => r.length)) throw new Error("Aucun appareil n'a été reconnu sur la photo.");
  const widest = Math.max(...rows.map((r) => r.reduce((s, d) => s + d.modules, 0)));
  const declared = num(result.enclosure?.modulesPerRow, 8, 24);
  const modulesPerRow = declared && declared >= widest ? (declared > 13 ? 18 : 13) : widest > 13 ? 18 : 13;
  const brands = rows.flat().map((d) => d.brand).filter(Boolean) as Brand[];
  const brand = (oneOf(result.enclosure?.brand, BRANDS) ?? brands[0] ?? "Générique") as Brand;
  return {
    panel: {
      id: newId("p"),
      name,
      role: "existing",
      enclosure: { brand, rows: Math.max(rows.length, num(result.enclosure?.rows, 1, 8) ?? 1), modulesPerRow },
      rows,
      controlHeightM: 1.6,
    },
    remarks: text(result.remarks, 600),
  };
}

export async function readPanelFromPhoto(assistant: Assistant, image: Blob, signal?: AbortSignal): Promise<{ panel: Panel; remarks?: string }> {
  const result = await assistant.askJson<PhotoResult>(PHOTO_PROMPT, { images: [image], signal });
  return panelFromPhoto(result);
}

/**
 * Lit la réponse JSON collée depuis une conversation Claude : accepte un bloc de code,
 * du texte autour, ou directement la liste des rangées.
 */
export function parsePhotoAnswer(answer: string): PhotoResult {
  const fenced = answer.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : answer;
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  if (start < 0 || end <= start) throw new Error("Aucune donnée JSON trouvée dans la réponse collée.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new Error("La réponse collée est incomplète ou mal formée. Copiez toute la réponse de Claude.");
  }
  if (Array.isArray(parsed)) return { rows: parsed as PhotoDevice[][] };
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as PhotoResult).rows)) return parsed as PhotoResult;
  throw new Error("La réponse ne contient pas de rangées d'appareils.");
}
