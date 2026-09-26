import type { Device, Panel } from "./types";

let counter = 0;
export function newId(prefix = "d"): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${counter}`;
}

export interface Located {
  device: Device;
  row: number;
  index: number;
}

export function locatedDevices(panel: Panel): Located[] {
  return panel.rows.flatMap((row, r) => row.map((device, index) => ({ device, row: r, index })));
}

export function findDevice(panel: Panel, id: string): Located | undefined {
  return locatedDevices(panel).find((l) => l.device.id === id);
}

export function rowModules(row: Device[]): number {
  return row.reduce((sum, d) => sum + d.modules, 0);
}

export function panelCapacity(panel: Panel): number {
  return panel.enclosure.rows * panel.enclosure.modulesPerRow;
}

export function usedModules(panel: Panel): number {
  return panel.rows.reduce((sum, row) => sum + rowModules(row.filter((d) => d.kind !== "blank")), 0);
}

export function freeModules(panel: Panel): number {
  return panelCapacity(panel) - usedModules(panel);
}

export const isCircuitDevice = (d: Device) => d.kind === "mcb" || d.kind === "rcbo" || d.kind === "fuse";

export const isRcd = (d: Device) => d.kind === "rcd";

/** Les appareils qui assurent une protection différentielle 30 mA. */
export const isHighSensitivity = (d: Device) =>
  (d.kind === "rcd" || d.kind === "rcbo") && (d.sensitivity ?? 30) <= 30;

/**
 * Détermine le différentiel qui protège chaque départ.
 * - `protectedBy` explicite (id ou null) prioritaire ;
 * - sinon le dernier interrupteur différentiel situé à gauche dans la même rangée ;
 * - un disjoncteur différentiel se protège lui-même.
 */
export function protectionMap(panel: Panel): Map<string, Device | null> {
  const byId = new Map(locatedDevices(panel).map((l) => [l.device.id, l.device]));
  const result = new Map<string, Device | null>();
  for (const row of panel.rows) {
    let current: Device | null = null;
    for (const d of row) {
      if (isRcd(d)) {
        current = d;
        continue;
      }
      if (d.kind === "rcbo") {
        result.set(d.id, d);
        continue;
      }
      if (d.protectedBy === null) result.set(d.id, null);
      else if (d.protectedBy) result.set(d.id, byId.get(d.protectedBy) ?? null);
      else result.set(d.id, current);
    }
  }
  return result;
}

/** Départs regroupés par différentiel (id du différentiel -> départs). */
export function circuitsByRcd(panel: Panel): Map<string, Device[]> {
  const map = protectionMap(panel);
  const groups = new Map<string, Device[]>();
  for (const { device } of locatedDevices(panel)) {
    if (!isCircuitDevice(device) || device.kind === "rcbo") continue;
    const rcd = map.get(device.id);
    if (!rcd || rcd.kind !== "rcd") continue;
    const list = groups.get(rcd.id) ?? [];
    list.push(device);
    groups.set(rcd.id, list);
  }
  return groups;
}

export function deviceTitle(d: Device): string {
  switch (d.kind) {
    case "mcb":
      return `Disjoncteur ${d.rating ?? "?"} A`;
    case "rcd":
      return `Différentiel ${d.rating ?? "?"} A ${d.sensitivity ?? 30} mA ${d.rcdType ?? ""}`.trim();
    case "rcbo":
      return `Disj. différentiel ${d.rating ?? "?"} A ${d.rcdType ?? ""}`.trim();
    case "fuse":
      return `Fusible ${d.rating ?? "?"} A`;
    case "spd":
      return "Parafoudre";
    case "contactor":
      return "Contacteur HC";
    case "teleruptor":
      return "Télérupteur";
    case "switch":
      return "Interrupteur / sectionneur";
    case "timer":
      return "Minuterie / programmateur";
    case "socket":
      return "Prise modulaire";
    case "blank":
      return "Obturateur";
    default:
      return d.label || "Appareil";
  }
}

/** Repère court affiché sur la face de l'appareil. */
export function deviceBadge(d: Device): string {
  switch (d.kind) {
    case "mcb":
      return `${d.curve ?? ""}${d.rating ?? "?"}`;
    case "fuse":
      return `${d.rating ?? "?"}A`;
    case "rcd":
      return `${d.rating ?? "?"}A`;
    case "rcbo":
      return `${d.curve ?? ""}${d.rating ?? "?"}`;
    case "spd":
      return "SPD";
    case "contactor":
      return "HC";
    case "teleruptor":
      return "TL";
    case "switch":
      return "I/O";
    case "timer":
      return "⏱";
    case "socket":
      return "2P+T";
    default:
      return "";
  }
}

/** Repères de schéma : ID1, ID2… pour les différentiels, Q1, Q2… pour les départs, F1… pour les autres appareils. */
export function repereMap(panel: Panel): Map<string, string> {
  const map = new Map<string, string>();
  let id = 0;
  let q = 0;
  let f = 0;
  for (const row of panel.rows)
    for (const d of row) {
      if (d.kind === "rcd") map.set(d.id, `ID${++id}`);
      else if (d.kind === "mcb" || d.kind === "rcbo" || d.kind === "fuse") map.set(d.id, `Q${++q}`);
      else if (d.kind !== "blank") map.set(d.id, `F${++f}`);
    }
  return map;
}
