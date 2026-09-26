/**
 * Génère un tableau conforme à la NF C 15-100 à partir des circuits d'un tableau existant.
 * Principe : un interrupteur différentiel 30 mA par rangée, 8 circuits maximum chacun,
 * au moins 2 différentiels dont un de type A (plaque, lave-linge…), lumières et prises
 * réparties, 20 % de réserve, un disjoncteur différentiel dédié par point de recharge VE.
 */
import { surgeProtection, rcdLoad } from "./analysis";
import { type CatalogItem, catalogById, findCatalogItem } from "./catalog";
import {
  MAX_CIRCUITS_PER_RCD,
  RESERVE_RATIO,
  USAGES,
  expectedProtection,
  heatingMaxPower,
  isTypeAOrBetter,
  maxPointsFor,
} from "./norm";
import { isCircuitDevice, locatedDevices, newId, rowModules } from "./panel";
import type { Brand, Circuit, CircuitUsage, Device, House, Panel, RcdType } from "./types";

export interface GenerateOptions {
  brand: Brand;
  modulesPerRow: 13 | 18;
  name?: string;
}

interface Planned {
  circuit: Circuit;
  rating: number;
  label?: string;
}

const GROUP_ORDER: Record<string, number> = { eclairage: 0, prises: 1, autre: 2, specialise: 3, chauffage: 4 };

function describe(c: Circuit, fallback?: string): string {
  return fallback || `${USAGES[c.usage].label}${c.rooms ? ` (${c.rooms})` : ""}`;
}

/** Transforme un départ existant en un ou plusieurs circuits conformes. */
export function planCircuit(source: Device, notes: string[]): Planned[] {
  const c = source.circuit!;
  const spec = USAGES[c.usage];
  const name = describe(c, source.label);

  if (c.usage === "chauffage") {
    const power = c.powerW ?? (source.rating ? heatingMaxPower(source.rating) : 4500);
    const parts = power > 7250 ? Math.ceil(power / 4500) : 1;
    const each = Math.round(power / parts);
    const exp = expectedProtection("chauffage", each);
    if (parts > 1) notes.push(`Chauffage « ${name} » (${power} W) réparti sur ${parts} circuits de ${exp.rating} A.`);
    if (!c.powerW) notes.push(`Chauffage « ${name} » : puissance inconnue, circuit dimensionné pour ${power} W. Vérifier la puissance des radiateurs.`);
    return Array.from({ length: parts }, (_, i) =>
      withSection(
        { ...c, powerW: each, points: Math.max(1, Math.ceil(c.points / parts)) },
        exp,
        parts > 1 ? `${name} ${i + 1}/${parts}` : source.label,
        notes,
      ),
    );
  }

  if (spec.powerBased) {
    const exp = expectedProtection(c.usage, c.powerW, c.sectionMm2);
    return [withSection(c, exp, source.label, notes)];
  }

  const exp = expectedProtection(c.usage, c.powerW, c.sectionMm2 ?? spec.defaultSection);
  const max = maxPointsFor(c.usage, exp.rating);
  let parts = max && c.points > max ? Math.ceil(c.points / max) : 1;
  if (c.usage === "volets" && c.points >= 4) parts = Math.max(parts, 2);
  if (parts > 1 && !spec.dedicated) {
    notes.push(`« ${name} » : ${c.points} ${spec.pointsLabel} répartis sur ${parts} circuits.`);
  }
  if (spec.dedicated && c.points > 1) {
    notes.push(`« ${name} » alimente ${c.points} appareils : prévoir un circuit spécialisé par appareil (${parts} circuits créés).`);
  }
  const base = Math.floor(c.points / parts);
  let rest = c.points % parts;
  return Array.from({ length: parts }, (_, i) => {
    const points = base + (rest-- > 0 ? 1 : 0);
    return withSection({ ...c, points }, exp, parts > 1 ? `${name} ${i + 1}/${parts}` : source.label, notes);
  });
}

function withSection(
  c: Circuit,
  exp: { rating: number; section: number },
  label: string | undefined,
  notes: string[],
): Planned {
  const rewire = c.sectionMm2 !== undefined && c.sectionMm2 < exp.section;
  if (rewire) {
    notes.push(`Recâbler « ${describe(c, label)} » en ${exp.section} mm² (actuellement ${c.sectionMm2} mm²).`);
  }
  return {
    rating: exp.rating,
    label,
    circuit: { ...c, sectionMm2: exp.section, rewire: rewire || undefined },
  };
}

function newCircuit(usage: CircuitUsage, rooms: string, label: string): Planned {
  const spec = USAGES[usage];
  return {
    rating: spec.defaultRating,
    label,
    circuit: {
      usage,
      rooms,
      points: spec.defaultPoints,
      sectionMm2: spec.defaultSection,
      description: "Circuit à créer",
    },
  };
}

/** Ajoute les circuits exigés par la norme qui manquent dans l'existant. */
export function addMissingCircuits(planned: Planned[], house: House, notes: string[]): Planned[] {
  const result = [...planned];
  const has = (u: CircuitUsage) => result.some((p) => p.circuit.usage === u);

  const lighting = result.filter((p) => p.circuit.usage === "eclairage");
  const minLighting = house.mainRooms <= 1 ? 1 : 2;
  if (lighting.length === 1 && minLighting === 2 && lighting[0].circuit.points >= 2) {
    const only = lighting[0];
    const idx = result.indexOf(only);
    const a = Math.ceil(only.circuit.points / 2);
    const name = describe(only.circuit, only.label);
    result.splice(
      idx,
      1,
      { ...only, label: `${name} — jour`, circuit: { ...only.circuit, points: a } },
      { ...only, label: `${name} — nuit`, circuit: { ...only.circuit, points: only.circuit.points - a } },
    );
    notes.push(`Éclairage séparé en 2 circuits (jour / nuit) : au moins 2 circuits d'éclairage sont exigés.`);
  } else if (lighting.length < minLighting) {
    for (let i = lighting.length; i < minLighting; i++) {
      result.push(newCircuit("eclairage", "", `Éclairage ${i + 1}`));
    }
    notes.push("Circuits d'éclairage ajoutés pour atteindre le minimum de 2.");
  }

  if (!has("plaque")) {
    result.push(newCircuit("plaque", "Cuisine", "Plaque de cuisson"));
    notes.push("Circuit cuisson 32 A en 6 mm² ajouté (exigé dans un logement rénové), sous le différentiel de type A.");
  }
  if (house.hasKitchenOver4m2 && !has("prises_cuisine")) {
    result.push(newCircuit("prises_cuisine", "Cuisine", "Prises plan de travail"));
    notes.push("Circuit dédié aux prises du plan de travail de la cuisine ajouté (6 prises max, 20 A).");
  }
  const specialized = result.filter((p) => USAGES[p.circuit.usage].specialized).length;
  const candidates: CircuitUsage[] = ["lave_linge", "lave_vaisselle", "four", "seche_linge"];
  let missing = 3 - specialized;
  for (const usage of candidates) {
    if (missing <= 0) break;
    if (!has(usage)) {
      result.push(newCircuit(usage, usage === "lave_linge" || usage === "seche_linge" ? "Buanderie" : "Cuisine", USAGES[usage].label));
      notes.push(`Circuit spécialisé « ${USAGES[usage].label} » ajouté : 3 circuits spécialisés 20 A minimum.`);
      missing -= 1;
    }
  }
  return result;
}

interface Group {
  type: RcdType;
  items: Planned[];
}

function groupLoad(g: Group): number {
  return rcdLoad(g.items.map((p) => ({ id: "", kind: "mcb", modules: 1, rating: p.rating, circuit: p.circuit })));
}

/** Répartit les circuits sous des différentiels (type A en premier). */
export function distribute(circuits: Planned[]): Group[] {
  const needsA = (p: Planned) => {
    const spec = USAGES[p.circuit.usage];
    return !!spec.rcdRequired?.some((t) => t === "A") || !!spec.rcdAdvised?.some(isTypeAOrBetter);
  };
  const mandatoryA = circuits.filter((p) => USAGES[p.circuit.usage].rcdRequired);
  const preferA = circuits.filter((p) => !USAGES[p.circuit.usage].rcdRequired && needsA(p));
  const others = circuits.filter((p) => !needsA(p));

  for (let total = Math.max(2, Math.ceil(circuits.length / MAX_CIRCUITS_PER_RCD)); total <= 12; total++) {
    const nA = Math.max(1, Math.ceil(mandatoryA.length / MAX_CIRCUITS_PER_RCD));
    const groups: Group[] = Array.from({ length: total }, (_, i) => ({ type: i < nA ? "A" : "AC", items: [] }));
    const aGroups = groups.filter((g) => g.type === "A");
    mandatoryA.forEach((p, i) => aGroups[i % aGroups.length].items.push(p));

    const place = (p: Planned, pool: Group[]) => {
      const group = USAGES[p.circuit.usage].group;
      const heavy = !!USAGES[p.circuit.usage].heavy;
      const candidates = pool.filter((g) => g.items.length < MAX_CIRCUITS_PER_RCD);
      if (candidates.length === 0) return false;
      candidates.sort((a, b) => score(a) - score(b));
      candidates[0].items.push(p);
      return true;
      function score(g: Group) {
        const same = g.items.filter((x) => USAGES[x.circuit.usage].group === group).length;
        const heavies = g.items.filter((x) => USAGES[x.circuit.usage].heavy).length;
        return same * 100 + (heavy ? heavies * 50 : 0) + g.items.length * 10 + groupLoad(g) / 10;
      }
    };

    let ok = true;
    for (const p of preferA) ok = (place(p, aGroups) || place(p, groups)) && ok;
    const sorted = [...others].sort((a, b) => {
      const ha = USAGES[a.circuit.usage].heavy ? 0 : 1;
      const hb = USAGES[b.circuit.usage].heavy ? 0 : 1;
      return ha - hb || GROUP_ORDER[USAGES[a.circuit.usage].group] - GROUP_ORDER[USAGES[b.circuit.usage].group];
    });
    for (const p of sorted) ok = place(p, groups) && ok;
    if (ok && groups.every((g) => groupLoad(g) <= 63)) {
      // Au moins 2 différentiels sont exigés, même si le second reste vide pour l'instant.
      return groups.filter((g, i) => g.items.length > 0 || i < 2);
    }
  }
  throw new Error("Impossible de répartir les circuits : trop de charge pour un tableau résidentiel.");
}

function deviceFrom(item: CatalogItem | undefined, fallback: Omit<Device, "id">): Device {
  if (!item) return { id: newId(), ...fallback, condition: "bon" };
  return {
    id: newId(),
    ...fallback,
    catalogId: item.id,
    brand: item.brand,
    ref: item.ref,
    modules: item.modules ?? fallback.modules,
    breakingCapacity: item.breakingCapacity ?? fallback.breakingCapacity,
    condition: "bon",
  };
}

function pick(brand: Brand, q: Parameters<typeof findCatalogItem>[1], custom: CatalogItem[]) {
  return findCatalogItem(brand, q, custom) ?? findCatalogItem("Générique", q, custom);
}

export interface GenerationResult {
  panel: Panel;
  notes: string[];
}

export function generateCompliantPanel(
  source: Panel,
  house: House,
  opts: GenerateOptions,
  custom: CatalogItem[] = [],
): GenerationResult {
  const notes: string[] = [];
  const sources = locatedDevices(source)
    .map((l) => l.device)
    .filter(isCircuitDevice);
  const undescribed = sources.filter((d) => !d.circuit);
  if (undescribed.length) {
    notes.push(`${undescribed.length} départ(s) sans description ignoré(s) : décrivez-les dans le tableau existant puis régénérez.`);
  }

  let planned = sources.filter((d) => d.circuit).flatMap((d) => planCircuit(d, notes));
  planned = addMissingCircuits(planned, house, notes);

  const ev = planned.filter((p) => p.circuit.usage === "irve_prise" || p.circuit.usage === "irve_borne");
  const regular = planned.filter((p) => !ev.includes(p));
  const groups = distribute(regular);

  const { brand, modulesPerRow } = opts;
  const rows: Device[][] = [];

  for (const g of groups) {
    const load = groupLoad(g);
    const rating = load <= 40 ? 40 : 63;
    const rcdItem = pick(brand, { kind: "rcd", rating, rcdType: g.type }, custom);
    const rcd = deviceFrom(rcdItem, {
      kind: "rcd",
      modules: 2,
      rating,
      poles: "2P",
      rcdType: g.type,
      sensitivity: 30,
      label: g.type === "A" ? "Différentiel type A" : "Différentiel",
    });
    const row: Device[] = [rcd];
    const items = [...g.items].sort(
      (a, b) =>
        GROUP_ORDER[USAGES[a.circuit.usage].group] - GROUP_ORDER[USAGES[b.circuit.usage].group] ||
        a.rating - b.rating,
    );
    for (const p of items) {
      const mcbItem = pick(brand, { kind: "mcb", rating: p.rating, curve: "C" }, custom);
      row.push(
        deviceFrom(mcbItem, {
          kind: "mcb",
          modules: p.rating >= 40 ? 2 : 1,
          rating: p.rating,
          curve: "C",
          poles: "1P+N",
          breakingCapacity: 3000,
          label: p.label,
          circuit: p.circuit,
        }),
      );
      if (p.circuit.usage === "chauffe_eau" && house.offPeak) {
        const item = pick(brand, { kind: "contactor" }, custom);
        row.push(deviceFrom(item, { kind: "contactor", modules: 1, rating: 20, label: "Contacteur HC chauffe-eau" }));
      }
    }
    rows.push(row);
  }

  const extras: Device[] = [];
  if (surgeProtection(house) !== "facultatif") {
    const item = pick(brand, { kind: "spd" }, custom);
    extras.push(deviceFrom(item, { kind: "spd", modules: 2, label: "Parafoudre" }));
    notes.push("Parafoudre ajouté en tête de tableau (à raccorder à la barrette de terre au plus court). Prévoir aussi un parafoudre sur la ligne téléphonique cuivre si elle existe.");
  }
  for (const p of ev) {
    const rcdType: RcdType = p.circuit.usage === "irve_prise" ? "F" : "A";
    const item = pick(brand, { kind: "rcbo", rating: p.rating, rcdType }, custom);
    extras.push(
      deviceFrom(item, {
        kind: "rcbo",
        modules: 2,
        rating: p.rating,
        curve: "C",
        poles: "1P+N",
        rcdType,
        sensitivity: 30,
        breakingCapacity: 3000,
        label: p.label ?? USAGES[p.circuit.usage].label,
        circuit: p.circuit,
      }),
    );
    if (p.circuit.usage === "irve_borne") {
      notes.push("Borne de recharge : vérifier que la borne intègre la détection de courant continu 6 mA (sinon différentiel type B).");
    }
  }

  // Parafoudre en tête de la première rangée ; les autres appareils là où il reste de la place.
  for (const d of extras) {
    const target =
      d.kind === "spd" && rows.length && rowModules(rows[0]) + d.modules <= modulesPerRow
        ? rows[0]
        : rows.find((r) => rowModules(r) + d.modules <= modulesPerRow);
    if (d.kind === "spd" && target === rows[0]) target.unshift({ ...d, protectedBy: null });
    else if (target) target.push({ ...d, protectedBy: null });
    else rows.push([{ ...d, protectedBy: null }]);
  }

  const used = rows.reduce((s, r) => s + rowModules(r), 0);
  let rowCount = rows.length;
  while ((rowCount * modulesPerRow - used) / (rowCount * modulesPerRow) < RESERVE_RATIO) rowCount += 1;
  if (rowCount > 4) {
    notes.push(`Le tableau nécessite ${rowCount} rangées de ${modulesPerRow} modules : envisager un coffret 18 modules ou un coffret complémentaire.`);
  }
  while (rows.length < rowCount) rows.push([]);

  const enclosureItem = findCatalogItem(brand, { kind: "enclosure", rows: rowCount, modulesPerRow }, custom);
  const panel: Panel = {
    id: newId("p"),
    name: opts.name ?? "Nouveau tableau",
    role: "new",
    enclosure: {
      catalogId: enclosureItem?.id,
      brand,
      ref: enclosureItem?.ref,
      label: enclosureItem?.label ?? `Coffret ${rowCount} rangées ${modulesPerRow} modules`,
      rows: rowCount,
      modulesPerRow,
    },
    rows,
    controlHeightM: source.controlHeightM,
    notes,
  };
  return { panel, notes };
}

/** Réapplique le catalogue d'une marque sur un tableau (changement de marque). */
export function rebrandPanel(panel: Panel, brand: Brand, custom: CatalogItem[] = []): Panel {
  const rows = panel.rows.map((row) =>
    row.map((d) => {
      const current = catalogById(d.catalogId, custom);
      const kind = current?.kind ?? d.kind;
      if (kind === "blank" || kind === "other") return d;
      const item = findCatalogItem(brand, { kind, rating: d.rating, rcdType: d.rcdType }, custom);
      if (!item) return { ...d, brand, catalogId: undefined, ref: undefined };
      return { ...d, brand, catalogId: item.id, ref: item.ref, modules: item.modules ?? d.modules, breakingCapacity: item.breakingCapacity ?? d.breakingCapacity };
    }),
  );
  const enc = findCatalogItem(brand, { kind: "enclosure", rows: panel.enclosure.rows, modulesPerRow: panel.enclosure.modulesPerRow }, custom);
  return {
    ...panel,
    rows,
    enclosure: { ...panel.enclosure, brand, catalogId: enc?.id, ref: enc?.ref, label: enc?.label ?? panel.enclosure.label },
  };
}
