/** Lecture d'un tableau électrique à partir d'une photo, par l'assistant IA. */
import { BRANDS, type Brand, type CircuitUsage, type Curve, type Device, type DeviceKind, type Panel, type Poles, type RcdType } from "../domain/types";
import { USAGES, USAGE_ORDER } from "../domain/norm";
import { newId } from "../domain/panel";
import type { Assistant } from "./assistant";

interface PhotoDevice {
  kind?: string;
  rating?: number;
  curve?: string;
  poles?: string;
  rcdType?: string;
  sensitivity?: number;
  modules?: number;
  brand?: string;
  label?: string;
  usage?: string;
}

interface PhotoResult {
  enclosure?: { rows?: number; modulesPerRow?: number; brand?: string };
  rows?: PhotoDevice[][];
  remarks?: string;
}

export const PHOTO_PROMPT = `Voici la photo d'un tableau électrique domestique français (monophasé). Relève chaque appareil modulaire, rangée par rangée, de gauche à droite.
Réponds uniquement avec un objet JSON de cette forme :
{"enclosure":{"rows":3,"modulesPerRow":13,"brand":"Legrand"},
 "rows":[[{"kind":"rcd","rating":40,"rcdType":"AC","sensitivity":30,"modules":2,"brand":"Legrand","label":"texte de l'étiquette"},
          {"kind":"mcb","rating":16,"curve":"C","poles":"1P+N","modules":1,"label":"Lumière salon","usage":"eclairage"}]],
 "remarks":"ce que tu n'as pas pu lire"}
Valeurs possibles :
- kind : mcb (disjoncteur), rcd (interrupteur différentiel), rcbo (disjoncteur différentiel), fuse (porte-fusible), spd (parafoudre), contactor (contacteur heures creuses), teleruptor, switch, timer, socket, other ;
- curve : B, C ou D ; poles : 1P, 1P+N ou 2P ; rcdType : AC, A, A-SI, F ou B ; sensitivity en mA (30, 300, 500) ;
- brand : Schneider, Legrand, Hager, Lexman ou Générique ;
- usage (déduit de l'étiquette si possible) : ${USAGE_ORDER.join(", ")}.
N'invente pas : omets un champ illisible. Le disjoncteur de branchement (souvent gris, à part) n'est pas à inclure.`;

const KINDS: DeviceKind[] = ["mcb", "rcd", "rcbo", "fuse", "spd", "contactor", "teleruptor", "switch", "timer", "socket", "other"];

const oneOf = <T extends string>(value: unknown, list: readonly T[]): T | undefined =>
  list.find((v) => typeof value === "string" && v.toLowerCase() === value.toLowerCase());

const num = (value: unknown, min: number, max: number): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

function toDevice(p: PhotoDevice): Device {
  const kind = oneOf(p.kind, KINDS) ?? "other";
  const usage = oneOf(p.usage, USAGE_ORDER) as CircuitUsage | undefined;
  const rating = num(p.rating, 1, 125);
  const device: Device = {
    id: newId(),
    kind,
    modules: num(p.modules, 1, 8) ?? (kind === "rcd" || kind === "spd" ? 2 : 1),
    rating,
    curve: oneOf(p.curve, ["B", "C", "D"] as Curve[]),
    poles: oneOf(p.poles, ["1P", "1P+N", "2P"] as Poles[]),
    rcdType: oneOf(p.rcdType, ["AC", "A", "A-SI", "F", "B"] as RcdType[]),
    sensitivity: num(p.sensitivity, 10, 1000),
    brand: oneOf(p.brand, BRANDS) as Brand | undefined,
    label: typeof p.label === "string" ? p.label.slice(0, 60) : undefined,
    condition: "inconnu",
  };
  if ((kind === "mcb" || kind === "fuse" || kind === "rcbo") && usage) {
    device.circuit = { usage, rooms: "", points: USAGES[usage].defaultPoints };
  }
  if (kind === "rcd" && !device.sensitivity) device.sensitivity = 30;
  return device;
}

export async function readPanelFromPhoto(assistant: Assistant, image: Blob, signal?: AbortSignal): Promise<{ panel: Panel; remarks?: string }> {
  const result = await assistant.askJson<PhotoResult>(PHOTO_PROMPT, { images: [image], signal });
  const rows = (Array.isArray(result?.rows) ? result.rows : []).map((r) => (Array.isArray(r) ? r.map(toDevice) : []));
  if (!rows.some((r) => r.length)) throw new Error("Aucun appareil n'a été reconnu sur la photo.");
  const modulesPerRow = result.enclosure?.modulesPerRow === 18 ? 18 : 13;
  const brand = (oneOf(result.enclosure?.brand, BRANDS) ?? rows.flat().find((d) => d.brand)?.brand ?? "Générique") as Brand;
  return {
    panel: {
      id: newId("p"),
      name: "Tableau existant (photo)",
      role: "existing",
      enclosure: { brand, rows: Math.max(rows.length, num(result.enclosure?.rows, 1, 8) ?? 1), modulesPerRow },
      rows,
      controlHeightM: 1.6,
    },
    remarks: typeof result.remarks === "string" ? result.remarks : undefined,
  };
}
