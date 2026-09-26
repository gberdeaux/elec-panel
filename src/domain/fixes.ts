/**
 * Corrections en un clic : pour un constat donné, propose une modification du tableau
 * qui le fait disparaître (sur un nouveau tableau).
 */
import { analyzePanel } from "./analysis";
import { type CatalogItem, findCatalogItem } from "./catalog";
import { MAX_CIRCUITS_PER_RCD, USAGES, expectedProtection, maxPointsFor, maxRatingForSection } from "./norm";
import { circuitsByRcd, findDevice, isHighSensitivity, locatedDevices, newId, protectionMap, rowModules } from "./panel";
import type { Brand, Device, Finding, House, Panel } from "./types";

export interface QuickFix {
  label: string;
  apply(panel: Panel): Panel;
}

const clone = (p: Panel): Panel => structuredClone(p);

function brandOf(panel: Panel): Brand {
  return panel.enclosure.brand;
}

function withCatalog(d: Device, brand: Brand, custom: CatalogItem[]): Device {
  const item = findCatalogItem(brand, { kind: d.kind === "blank" ? "blankStrip" : d.kind, rating: d.rating, rcdType: d.rcdType }, custom);
  if (!item) return { ...d, catalogId: undefined, ref: undefined };
  return { ...d, brand, catalogId: item.id, ref: item.ref, modules: item.modules ?? d.modules, breakingCapacity: item.breakingCapacity ?? d.breakingCapacity };
}

function editDevice(panel: Panel, id: string, patch: (d: Device) => Device): Panel {
  const next = clone(panel);
  const loc = findDevice(next, id);
  if (loc) next.rows[loc.row][loc.index] = patch(next.rows[loc.row][loc.index]);
  return next;
}

/** Différentiels 30 mA qui peuvent encore accueillir un circuit, avec la place dans leur rangée. */
function rcdsWithRoom(panel: Panel, pred: (rcd: Device) => boolean = () => true) {
  const groups = circuitsByRcd(panel);
  return locatedDevices(panel)
    .filter(({ device }) => device.kind === "rcd" && isHighSensitivity(device) && pred(device))
    .map(({ device, row }) => ({
      rcd: device,
      row,
      count: groups.get(device.id)?.length ?? 0,
      free: panel.enclosure.modulesPerRow - rowModules(panel.rows[row]),
    }))
    .filter((r) => r.count < MAX_CIRCUITS_PER_RCD)
    .sort((a, b) => a.count - b.count);
}

/** Déplace un départ sous un différentiel (dans sa rangée s'il y a la place, sinon par affectation). */
function attachTo(panel: Panel, deviceId: string, target: { rcd: Device; row: number; free: number }): Panel {
  const next = clone(panel);
  const loc = findDevice(next, deviceId);
  if (!loc) return next;
  const [dev] = next.rows[loc.row].splice(loc.index, 1);
  if (loc.row !== target.row && target.free >= dev.modules) {
    dev.protectedBy = undefined;
    next.rows[target.row].push(dev);
  } else {
    dev.protectedBy = target.rcd.id;
    next.rows[loc.row].splice(loc.index, 0, dev);
  }
  return next;
}

function addRowWith(panel: Panel, devices: Device[]): Panel {
  const next = clone(panel);
  const empty = next.rows.findIndex((r) => r.length === 0);
  if (empty >= 0) next.rows[empty].push(...devices);
  else {
    next.rows.push(devices);
    next.enclosure.rows = Math.max(next.enclosure.rows, next.rows.length);
  }
  return next;
}

export function quickFixFor(finding: Finding, panel: Panel, _house: House, custom: CatalogItem[] = []): QuickFix | undefined {
  const brand = brandOf(panel);
  const id = finding.deviceIds[0];
  const loc = id ? findDevice(panel, id) : undefined;
  const d = loc?.device;
  const c = d?.circuit;

  switch (finding.ruleId) {
    case "calibre-usage":
    case "surcharge":
    case "section-calibre": {
      if (!d || !c) return undefined;
      const exp = expectedProtection(c.usage, c.powerW, c.sectionMm2);
      const cap = c.sectionMm2 ? maxRatingForSection(c.sectionMm2) : exp.rating;
      if (exp.rating <= cap) {
        return {
          label: `Passer en ${exp.rating} A`,
          apply: (p) => editDevice(p, d.id, (x) => withCatalog({ ...x, rating: exp.rating }, x.brand ?? brand, custom)),
        };
      }
      return {
        label: `Recâbler en ${String(exp.section).replace(".", ",")} mm² et passer en ${exp.rating} A`,
        apply: (p) =>
          editDevice(p, d.id, (x) => withCatalog({ ...x, rating: exp.rating, circuit: { ...x.circuit!, sectionMm2: exp.section, rewire: true } }, x.brand ?? brand, custom)),
      };
    }
    case "chauffage-surcharge": {
      if (!d || !c?.powerW) return undefined;
      const parts = Math.ceil(c.powerW / 4500);
      if (parts > 1) return splitFix(d, parts, brand, custom, (i) => ({ powerW: Math.round(c.powerW! / parts), points: Math.max(1, Math.ceil(c.points / parts)), label: `${d.label ?? "Chauffage"} ${i + 1}/${parts}` }), 20);
      const exp = expectedProtection("chauffage", c.powerW);
      return {
        label: `Recâbler en ${String(exp.section).replace(".", ",")} mm² et passer en ${exp.rating} A`,
        apply: (p) => editDevice(p, d.id, (x) => withCatalog({ ...x, rating: exp.rating, circuit: { ...x.circuit!, sectionMm2: exp.section, rewire: true } }, x.brand ?? brand, custom)),
      };
    }
    case "points-max": {
      if (!d || !c) return undefined;
      const max = maxPointsFor(c.usage, d.rating);
      if (!max) return undefined;
      const parts = Math.ceil(c.points / max);
      const base = Math.floor(c.points / parts);
      const rest = c.points % parts;
      return splitFix(d, parts, brand, custom, (i) => ({ points: base + (i < rest ? 1 : 0), label: `${d.label ?? USAGES[c.usage].label} ${i + 1}/${parts}` }));
    }
    case "coupure-neutre":
      if (!d) return undefined;
      return { label: "Remplacer par un phase + neutre", apply: (p) => editDevice(p, d.id, (x) => withCatalog({ ...x, poles: "1P+N" }, brand, custom)) };
    case "pouvoir-coupure":
      if (!d) return undefined;
      return { label: "Remplacer par un 3 kA", apply: (p) => editDevice(p, d.id, (x) => withCatalog({ ...x, breakingCapacity: 3000 }, brand, custom)) };
    case "fusible": {
      if (!d) return undefined;
      const rating = Math.min(d.rating ?? 16, c?.sectionMm2 ? maxRatingForSection(c.sectionMm2) : 63);
      return {
        label: `Remplacer par un disjoncteur ${rating} A`,
        apply: (p) => editDevice(p, d.id, (x) => withCatalog({ ...x, kind: "mcb", rating, curve: "C", poles: "1P+N", breakingCapacity: 3000, condition: "bon" }, brand, custom)),
      };
    }
    case "etat-hs":
    case "etat-use":
      if (!d) return undefined;
      return { label: "Remplacer par un appareil neuf", apply: (p) => editDevice(p, d.id, (x) => withCatalog({ ...x, condition: "bon" }, brand, custom)) };
    case "rcd-sensibilite":
      if (!d) return undefined;
      return { label: "Remplacer par un 30 mA", apply: (p) => editDevice(p, d.id, (x) => withCatalog({ ...x, sensitivity: 30 }, brand, custom)) };
    case "rcd-calibre":
      if (!d) return undefined;
      return { label: "Passer le différentiel en 63 A", apply: (p) => editDevice(p, d.id, (x) => withCatalog({ ...x, rating: 63 }, brand, custom)) };
    case "sans-30ma": {
      if (!d) return undefined;
      const target = rcdsWithRoom(panel).sort((a, b) => Number(b.row === loc!.row) - Number(a.row === loc!.row) || a.count - b.count)[0];
      const row = panel.rows[loc!.row];
      if (!row.some((x) => x.kind === "rcd") && rowModules(row) + 2 <= panel.enclosure.modulesPerRow) {
        const item = findCatalogItem(brand, { kind: "rcd", rating: 40, rcdType: "AC" }, custom);
        return {
          label: `Ajouter un différentiel 30 mA en tête de la rangée ${loc!.row + 1}`,
          apply: (p) => {
            const next = clone(p);
            next.rows[loc!.row].unshift({ id: newId(), kind: "rcd", modules: 2, rating: 40, poles: "2P", rcdType: "AC", sensitivity: 30, brand, catalogId: item?.id, ref: item?.ref, label: "Différentiel", condition: "bon" });
            return next;
          },
        };
      }
      if (!target) return addRcdFix("AC", brand, custom, "Ajouter un différentiel 30 mA", d.id);
      return { label: `Protéger par le différentiel de la rangée ${target.row + 1}`, apply: (p) => attachTo(p, d.id, target) };
    }
    case "rcd-type": {
      if (!d) return undefined;
      const target = rcdsWithRoom(panel, (r) => r.rcdType === "A" || r.rcdType === "F" || r.rcdType === "B" || r.rcdType === "A-SI").find((r) => r.free >= d.modules) ?? rcdsWithRoom(panel, (r) => r.rcdType !== "AC")[0];
      if (!target) return addRcdFix("A", brand, custom, "Ajouter un différentiel type A", d.id);
      return { label: `Placer sous le différentiel type A (rangée ${target.row + 1})`, apply: (p) => attachTo(p, d.id, target) };
    }
    case "irve-dedie": {
      if (!d || !c) return undefined;
      const rcdType = c.usage === "irve_prise" ? "F" : "A";
      return {
        label: `Remplacer par un disjoncteur différentiel type ${rcdType}`,
        apply: (p) => editDevice(p, d.id, (x) => withCatalog({ ...x, kind: "rcbo", rcdType, sensitivity: 30, modules: 2, protectedBy: null }, brand, custom)),
      };
    }
    case "rcd-min":
      return addRcdFix("AC", brand, custom, "Ajouter un différentiel dans une nouvelle rangée");
    case "rcd-type-a":
      return addRcdFix("A", brand, custom, "Ajouter un différentiel type A");
    case "repartition-eclairage":
    case "repartition-prises": {
      const member = finding.deviceIds[finding.deviceIds.length - 1];
      const mloc = findDevice(panel, member);
      if (!mloc) return undefined;
      const current = protectionMap(panel).get(member)?.id;
      const target = rcdsWithRoom(panel, (r) => r.id !== current).find((r) => r.free >= mloc.device.modules) ?? rcdsWithRoom(panel, (r) => r.id !== current)[0];
      if (!target) return addRcdFix("AC", brand, custom, "Ajouter un second différentiel", member);
      return { label: `Déplacer « ${mloc.device.label ?? "un circuit"} » sous un autre différentiel`, apply: (p) => attachTo(p, member, target) };
    }
    case "contacteur-hc": {
      if (!d) return undefined;
      const item = findCatalogItem(brand, { kind: "contactor" }, custom);
      return {
        label: "Ajouter un contacteur heures creuses",
        apply: (p) => {
          const next = clone(p);
          const l = findDevice(next, d.id);
          if (l) next.rows[l.row].splice(l.index + 1, 0, { id: newId(), kind: "contactor", modules: 1, rating: 20, brand, catalogId: item?.id, ref: item?.ref, label: "Contacteur HC", condition: "bon" });
          return next;
        },
      };
    }
    case "parafoudre": {
      const item = findCatalogItem(brand, { kind: "spd" }, custom);
      const spd: Device = { id: newId(), kind: "spd", modules: 2, brand, catalogId: item?.id, ref: item?.ref, label: "Parafoudre", condition: "bon", protectedBy: null };
      return {
        label: "Ajouter un parafoudre en tête",
        apply: (p) => {
          const next = clone(p);
          const row = next.rows.findIndex((r) => rowModules(r) + 2 <= next.enclosure.modulesPerRow);
          if (row >= 0) next.rows[row].unshift(spd);
          else return addRowWith(next, [spd]);
          return next;
        },
      };
    }
    case "reserve":
    case "coffret-plein":
      return {
        label: panel.enclosure.rows < 4 ? "Ajouter une rangée au coffret" : "Passer en 18 modules",
        apply: (p) => {
          const next = clone(p);
          if (next.enclosure.rows < 4) next.enclosure.rows += 1;
          else next.enclosure.modulesPerRow = 18;
          while (next.rows.length < next.enclosure.rows) next.rows.push([]);
          const enc = findCatalogItem(next.enclosure.brand, { kind: "enclosure", rows: next.enclosure.rows, modulesPerRow: next.enclosure.modulesPerRow }, custom);
          next.enclosure = { ...next.enclosure, catalogId: enc?.id, ref: enc?.ref, label: enc?.label ?? next.enclosure.label };
          return next;
        },
      };
    default:
      return undefined;
  }
}

function splitFix(
  d: Device,
  parts: number,
  brand: Brand,
  custom: CatalogItem[],
  part: (i: number) => { points: number; powerW?: number; label: string },
  rating?: number,
): QuickFix {
  return {
    label: `Scinder en ${parts} circuits`,
    apply: (p) => {
      const next = clone(p);
      const l = findDevice(next, d.id);
      if (!l) return next;
      const copies = Array.from({ length: parts }, (_, i) => {
        const info = part(i);
        const dev: Device = {
          ...structuredClone(d),
          id: i === 0 ? d.id : newId(),
          label: info.label,
          rating: rating ?? d.rating,
          circuit: { ...d.circuit!, points: info.points, powerW: info.powerW ?? d.circuit!.powerW, description: i === 0 ? d.circuit!.description : "Nouveau circuit à tirer" },
        };
        return withCatalog(dev, d.brand ?? brand, custom);
      });
      next.rows[l.row].splice(l.index, 1, ...copies);
      return next;
    },
  };
}

function addRcdFix(type: "A" | "AC", brand: Brand, custom: CatalogItem[], label: string, moveId?: string): QuickFix {
  return {
    label,
    apply: (p) => {
      const item = findCatalogItem(brand, { kind: "rcd", rating: 40, rcdType: type }, custom);
      const rcd: Device = { id: newId(), kind: "rcd", modules: 2, rating: 40, poles: "2P", rcdType: type, sensitivity: 30, brand, catalogId: item?.id, ref: item?.ref, label: type === "A" ? "Différentiel type A" : "Différentiel", condition: "bon" };
      let next = addRowWith(p, [rcd]);
      if (moveId) {
        const l = findDevice(next, moveId);
        const target = findDevice(next, rcd.id);
        if (l && target) {
          const [dev] = next.rows[l.row].splice(l.index, 1);
          dev.protectedBy = undefined;
          next = { ...next, rows: next.rows.map((r, i) => (i === target.row ? [...r, dev] : r)) };
        }
      }
      return next;
    },
  };
}

/** Applique les corrections disponibles jusqu'à ce qu'il n'y en ait plus (limité en nombre de passes). */
export function autoFix(panel: Panel, house: House, custom: CatalogItem[] = [], passes = 40): Panel {
  let current = panel;
  const tried = new Set<string>();
  for (let i = 0; i < passes; i++) {
    const findings = analyzePanel(current, house).filter((f) => f.severity === "danger" || f.severity === "nonconforme");
    const next = findings.map((f) => ({ f, fix: quickFixFor(f, current, house, custom) })).find((x) => x.fix && !tried.has(x.f.id));
    if (!next) break;
    tried.add(next.f.id);
    current = next.fix!.apply(current);
  }
  return current;
}
