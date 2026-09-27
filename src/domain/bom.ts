/** Nomenclature du nouveau tableau, réemploi de l'existant et liste d'achat. */
import { type CatalogItem, type CatalogKind, KIND_LABEL, catalogById, catalogItemFor, findCatalogItem, refFor } from "./catalog";
import { MIN_BREAKING_CAPACITY } from "./norm";
import { deviceTitle, locatedDevices, rowModules } from "./panel";
import type { Brand, Device, Panel, Project } from "./types";

export interface BomLine {
  key: string;
  kind: CatalogKind;
  label: string;
  brand?: Brand;
  ref?: string;
  catalogId?: string;
  needed: number;
  autoOwned: number;
  owned: number;
  ownedOverridden: boolean;
  toBuy: number;
  unitPrice: number;
  total: number;
  reuse: string[];
  note?: string;
}

/** Pôles par défaut quand ils ne sont pas précisés (relevé photo, saisie rapide) : en monophasé, un différentiel est bipolaire et un disjoncteur phase + neutre. */
function polesOf(d: Pick<Device, "kind" | "poles">): string {
  if (d.poles) return d.poles;
  if (d.kind === "rcd") return "2P";
  if (d.kind === "mcb" || d.kind === "rcbo") return "1P+N";
  return "";
}

function specKey(d: Pick<Device, "kind" | "rating" | "curve" | "rcdType" | "sensitivity" | "poles">): string {
  return [d.kind, d.rating ?? "", d.curve ?? "", d.rcdType ?? "", d.kind === "rcd" || d.kind === "rcbo" ? d.sensitivity ?? 30 : "", polesOf(d)].join("|");
}

/** Un appareil existant peut être réemployé s'il est en bon état et conforme en lui-même. */
export function isReusable(d: Device): boolean {
  if (d.condition === "HS" || d.condition === "usé") return false;
  if (d.kind === "fuse" || d.kind === "blank" || d.kind === "other") return false;
  if ((d.kind === "mcb" || d.kind === "rcbo") && d.poles === "1P") return false;
  if ((d.kind === "mcb" || d.kind === "rcbo") && d.breakingCapacity !== undefined && d.breakingCapacity < MIN_BREAKING_CAPACITY) return false;
  if ((d.kind === "rcd" || d.kind === "rcbo") && (d.sensitivity ?? 30) > 30) return false;
  return true;
}

function deviceLabel(d: Device, item?: CatalogItem): string {
  if (item) return item.label;
  switch (d.kind) {
    case "mcb":
      return `Disjoncteur ${d.rating} A courbe ${d.curve ?? "C"} ${d.poles ?? "1P+N"}`;
    case "rcd":
      return `Interrupteur différentiel ${d.rating} A ${d.sensitivity ?? 30} mA type ${d.rcdType ?? "AC"}`;
    case "rcbo":
      return `Disjoncteur différentiel ${d.rating} A ${d.sensitivity ?? 30} mA type ${d.rcdType ?? "A"}`;
    default:
      return deviceTitle(d);
  }
}

export function computeBom(project: Project, target: Panel, source?: Panel): BomLine[] {
  return computeBomDetailed(project, target, source).lines;
}

function computeBomDetailed(project: Project, target: Panel, source?: Panel): { lines: BomLine[]; used: Set<string>; enclosureReused: boolean } {
  const custom = project.customCatalog;
  const lines = new Map<string, BomLine>();
  const priceOf = (key: string, catalogId?: string, fallback = 0) =>
    project.inventory[key]?.price ??
    (catalogId ? project.catalogOverrides[catalogId]?.price : undefined) ??
    catalogById(catalogId, custom)?.price ??
    fallback;
  const refOf = (catalogId?: string, ref?: string) =>
    (catalogId ? project.catalogOverrides[catalogId]?.ref : undefined) ?? ref;

  const addLine = (
    key: string,
    kind: CatalogKind,
    label: string,
    qty: number,
    extra: Partial<BomLine> = {},
  ) => {
    const line = lines.get(key);
    if (line) {
      line.needed += qty;
      return;
    }
    lines.set(key, {
      key,
      kind,
      label,
      needed: qty,
      autoOwned: 0,
      owned: 0,
      ownedOverridden: false,
      toBuy: 0,
      unitPrice: 0,
      total: 0,
      reuse: [],
      ...extra,
    });
  };

  // Coffret
  const enc = target.enclosure;
  const encItem =
    catalogById(enc.catalogId, custom) ??
    findCatalogItem(enc.brand, { kind: "enclosure", rows: enc.rows, modulesPerRow: enc.modulesPerRow }, custom);
  addLine(`enclosure|${enc.brand}|${enc.rows}|${enc.modulesPerRow}`, "enclosure", encItem?.label ?? `Coffret ${enc.rows} rangées ${enc.modulesPerRow} modules`, 1, {
    brand: enc.brand,
    catalogId: encItem?.id,
    ref: refOf(encItem?.id, encItem?.ref ?? enc.ref),
  });

  // Appareils
  for (const { device } of locatedDevices(target)) {
    if (device.kind === "blank") continue;
    const item = catalogItemFor(device, custom);
    const key = `${specKey(device)}|${device.brand ?? ""}`;
    addLine(key, device.kind, deviceLabel(device, item), 1, {
      brand: device.brand,
      catalogId: item?.id,
      ref: refOf(item?.id, refFor(device, custom)),
    });
  }

  // Peignes et obturateurs
  const activeRows = target.rows.filter((r) => r.some((d) => d.kind !== "spd"));
  if (activeRows.length) {
    const comb = findCatalogItem(enc.brand, { kind: "comb", modulesPerRow: enc.modulesPerRow }, custom);
    addLine(`comb|${enc.brand}|${enc.modulesPerRow}`, "comb", comb?.label ?? `Peigne d'alimentation ${enc.modulesPerRow} modules`, activeRows.length, {
      brand: enc.brand,
      catalogId: comb?.id,
      ref: refOf(comb?.id, comb?.ref),
      note: "Un peigne par rangée, recoupé à la longueur utile.",
    });
  }
  const freeTotal = Array.from({ length: enc.rows }, (_, i) => Math.max(0, enc.modulesPerRow - rowModules(target.rows[i] ?? []))).reduce(
    (a, b) => a + b,
    0,
  );
  if (freeTotal > 0) {
    const blank = findCatalogItem(enc.brand, { kind: "blankStrip" }, custom);
    addLine(`blank|${enc.brand}`, "blankStrip", blank?.label ?? "Obturateur sécable 5 modules", Math.ceil(freeTotal / 5), {
      brand: enc.brand,
      catalogId: blank?.id,
      ref: refOf(blank?.id, blank?.ref),
      note: `${freeTotal} modules libres à obturer (souvent fournis avec le coffret).`,
    });
  }

  // Réemploi automatique depuis le tableau existant
  const pool = source
    ? locatedDevices(source)
        .map((l) => l.device)
        .filter(isReusable)
    : [];
  const used = new Set<string>();
  let enclosureReused = false;
  for (const line of lines.values()) {
    if (line.kind === "enclosure") {
      if (
        source &&
        source.enclosure.brand === enc.brand &&
        source.enclosure.rows === enc.rows &&
        source.enclosure.modulesPerRow === enc.modulesPerRow
      ) {
        enclosureReused = true;
        line.autoOwned = 1;
        line.reuse.push("Coffret existant");
      }
      continue;
    }
    if (line.kind === "comb" || line.kind === "blankStrip") continue;
    const spec = line.key.split("|").slice(0, 6).join("|");
    for (const d of pool) {
      if (line.autoOwned >= line.needed) break;
      if (used.has(d.id) || specKey(d) !== spec) continue;
      const sameBrand = !line.brand || !d.brand || d.brand === line.brand || d.brand === "Générique";
      if (!sameBrand && !project.allowCrossBrandReuse) continue;
      used.add(d.id);
      line.autoOwned += 1;
      line.reuse.push(`${d.label || deviceTitle(d)}${d.brand && d.brand !== line.brand ? ` (${d.brand})` : ""}`);
    }
  }

  for (const line of lines.values()) {
    const override = project.inventory[line.key]?.owned;
    line.ownedOverridden = override !== undefined;
    line.owned = override ?? line.autoOwned;
    line.toBuy = Math.max(0, line.needed - line.owned);
    line.unitPrice = priceOf(line.key, line.catalogId);
    line.total = line.toBuy * line.unitPrice;
  }

  const order: CatalogKind[] = ["enclosure", "rcd", "rcbo", "mcb", "spd", "contactor", "teleruptor", "switch", "timer", "socket", "fuse", "other", "comb", "blankStrip"];
  const sorted = [...lines.values()].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.label.localeCompare(b.label, "fr", { numeric: true }),
  );
  return { lines: sorted, used, enclosureReused };
}

export type LeftoverReason = "hs" | "use" | "nonconforme" | "autre-marque" | "remplace" | "surplus" | "inutile" | "obturateur";

export interface Leftover {
  device?: Device;
  row?: number;
  label: string;
  reason: LeftoverReason;
  detail: string;
}

/** Pourquoi un appareil existant ne peut pas être réemployé tel quel, ou undefined s'il le peut. */
function unusableReason(d: Device): { reason: LeftoverReason; detail: string } | undefined {
  if (d.kind === "fuse") return { reason: "nonconforme", detail: "Fusible : remplacé par un disjoncteur" };
  if ((d.kind === "mcb" || d.kind === "rcbo") && d.poles === "1P") return { reason: "nonconforme", detail: "Pas de coupure du neutre" };
  if ((d.kind === "mcb" || d.kind === "rcbo") && d.breakingCapacity !== undefined && d.breakingCapacity < MIN_BREAKING_CAPACITY)
    return { reason: "nonconforme", detail: `Pouvoir de coupure insuffisant (${d.breakingCapacity} A)` };
  if ((d.kind === "rcd" || d.kind === "rcbo") && (d.sensitivity ?? 30) > 30) return { reason: "nonconforme", detail: `Sensibilité ${d.sensitivity} mA au lieu de 30 mA` };
  if (d.condition === "HS") return { reason: "hs", detail: "Hors service" };
  if (d.condition === "usé") return { reason: "use", detail: "Usé ou d'aspect douteux" };
  if (d.kind === "other") return { reason: "obturateur", detail: "Appareil non identifié" };
  return undefined;
}

/** Matériel de l'ancien tableau qui ne sera pas réemployé dans le nouveau, avec la raison. */
export function leftoversFrom(project: Project, target: Panel, source: Panel): Leftover[] {
  const { used, enclosureReused, lines } = computeBomDetailed(project, target, source);
  const out: Leftover[] = [];
  if (!enclosureReused) {
    out.push({
      label: `Coffret ${source.enclosure.brand} ${source.enclosure.rows} × ${source.enclosure.modulesPerRow} modules`,
      reason: "remplace",
      detail: `Remplacé par un coffret ${target.enclosure.brand} ${target.enclosure.rows} × ${target.enclosure.modulesPerRow} modules`,
    });
  }
  for (const { device: d, row } of locatedDevices(source)) {
    if (used.has(d.id) || d.kind === "blank") continue;
    const label = `${deviceLabel(d)}${d.label ? ` — ${d.label}` : ""}${d.brand && d.brand !== "Générique" ? ` (${d.brand})` : ""}`;
    const bad = unusableReason(d);
    if (bad) {
      out.push({ device: d, row, label, ...bad });
      continue;
    }
    const spec = specKey(d);
    const sameSpec = lines.filter((l) => l.key.split("|").slice(0, 6).join("|") === spec);
    if (sameSpec.length && !project.allowCrossBrandReuse && sameSpec.every((l) => l.brand && d.brand && l.brand !== d.brand && d.brand !== "Générique")) {
      out.push({ device: d, row, label, reason: "autre-marque", detail: `Autre marque que le nouveau tableau (${sameSpec[0].brand}) : réemploi désactivé` });
    } else if (sameSpec.length) {
      out.push({ device: d, row, label, reason: "surplus", detail: "En surplus : le nouveau tableau en utilise moins" });
    } else if (lines.some((l) => l.kind === d.kind)) {
      const kin = lines.filter((l) => l.kind === d.kind);
      const sameRating = kin.filter((l) => l.key.split("|")[1] === String(d.rating ?? ""));
      const instead = [...new Set((sameRating.length ? sameRating : kin).map((l) => l.label))];
      out.push({
        device: d,
        row,
        label,
        reason: "remplace",
        detail:
          sameRating.length || d.kind === "rcd"
            ? `Remplacé : le nouveau tableau utilise ${instead.slice(0, 2).join(" et ")}${instead.length > 2 ? "…" : ""}`
            : `Remplacé : plus aucun ${d.rating} A de ce type dans le nouveau tableau`,
      });
    } else {
      out.push({ device: d, row, label, reason: "inutile", detail: "Plus nécessaire dans le nouveau tableau" });
    }
  }
  return out;
}

export function bomTotals(lines: BomLine[]) {
  return {
    items: lines.reduce((s, l) => s + l.needed, 0),
    reused: lines.reduce((s, l) => s + Math.min(l.owned, l.needed), 0),
    toBuy: lines.reduce((s, l) => s + l.toBuy, 0),
    cost: lines.reduce((s, l) => s + l.total, 0),
  };
}

export function bomToCsv(lines: BomLine[]): string {
  const esc = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Catégorie", "Article", "Marque", "Référence", "Nécessaire", "Possédé", "À acheter", "Prix unitaire (€)", "Total (€)"];
  const rows = lines.map((l) =>
    [KIND_LABEL[l.kind], l.label, l.brand, l.ref, l.needed, l.owned, l.toBuy, l.unitPrice.toFixed(2), l.total.toFixed(2)].map(esc).join(";"),
  );
  return [header.map(esc).join(";"), ...rows].join("\n");
}

export function bomToText(lines: BomLine[]): string {
  return lines
    .filter((l) => l.toBuy > 0)
    .map((l) => `- ${l.toBuy} × ${l.label}${l.brand ? ` — ${l.brand}` : ""}${l.ref ? ` (réf. ${l.ref})` : ""} ≈ ${l.total.toFixed(2)} €`)
    .join("\n");
}
