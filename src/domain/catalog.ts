/**
 * Catalogue d'appareillage modulaire par marque.
 * Les références et prix sont indicatifs (prix constatés en grande surface de bricolage type
 * Leroy Merlin) : ils sont modifiables dans l'application et doivent être vérifiés avant achat.
 */
import type { Brand, Curve, DeviceKind, Poles, RcdType } from "./types";

export type CatalogKind = DeviceKind | "enclosure" | "comb" | "blankStrip";

export interface CatalogItem {
  id: string;
  brand: Brand;
  range: string;
  kind: CatalogKind;
  label: string;
  ref?: string;
  modules?: number;
  rating?: number;
  curve?: Curve;
  poles?: Poles;
  breakingCapacity?: number;
  rcdType?: RcdType;
  sensitivity?: number;
  rows?: number;
  modulesPerRow?: number;
  /** Prix unitaire indicatif TTC en euros. */
  price: number;
  custom?: boolean;
}

interface BrandProfile {
  brand: Brand;
  enclosureRange: string;
  deviceRange: string;
  priceFactor: number;
  enclosureRef?: (rows: number, modules: number) => string | undefined;
  mcbRef?: (rating: number) => string | undefined;
  rcdRef?: (rating: number, type: RcdType) => string | undefined;
  combRef?: (modules: number) => string | undefined;
  breakingCapacity: number;
  hasTypeB: boolean;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

const PROFILES: BrandProfile[] = [
  {
    brand: "Schneider",
    enclosureRange: "Resi9",
    deviceRange: "Resi9 XP",
    priceFactor: 1.05,
    enclosureRef: (rows, modules) => `R9H${modules}40${rows}`,
    mcbRef: (rating) => (rating <= 32 ? `R9PFC6${pad2(rating)}` : undefined),
    rcdRef: (rating, type) =>
      type === "AC" && (rating === 40 || rating === 63) ? `R9PRC2${rating}` : undefined,
    combRef: (modules) => `R9PXH2${modules}`,
    breakingCapacity: 3000,
    hasTypeB: false,
  },
  {
    brand: "Legrand",
    enclosureRange: "Drivia",
    deviceRange: "DX³ / DNX³",
    priceFactor: 1.15,
    enclosureRef: (rows, modules) => `4012${modules === 13 ? 1 : 2}${rows}`,
    rcdRef: (rating, type) => {
      if (rating === 40 && type === "AC") return "411611";
      if (rating === 40 && type === "A") return "411617";
      return undefined;
    },
    breakingCapacity: 4500,
    hasTypeB: true,
  },
  {
    brand: "Hager",
    enclosureRange: "Gamma",
    deviceRange: "MFN / CD",
    priceFactor: 1.1,
    enclosureRef: (rows, modules) => `GD${rows}${modules}A`,
    mcbRef: (rating) => (rating <= 32 ? `MFN7${pad2(rating)}` : undefined),
    rcdRef: (rating, type) => {
      if (rating !== 40 && rating !== 63) return undefined;
      if (type === "AC") return `CDC7${rating}F`;
      if (type === "A") return `CDA7${rating}F`;
      return undefined;
    },
    breakingCapacity: 3000,
    hasTypeB: false,
  },
  {
    brand: "Lexman",
    enclosureRange: "Lexman",
    deviceRange: "Lexman",
    priceFactor: 0.75,
    breakingCapacity: 3000,
    hasTypeB: false,
  },
];

const ENCLOSURE_BASE: Record<number, Record<number, number>> = {
  13: { 1: 24, 2: 45, 3: 68, 4: 92 },
  18: { 1: 32, 2: 60, 3: 88, 4: 118 },
};

const MCB_BASE: Record<number, number> = { 2: 11, 6: 10, 10: 9, 16: 9, 20: 9.5, 25: 11, 32: 12, 40: 22 };
const RCD_BASE: Record<RcdType, Record<number, number>> = {
  AC: { 25: 38, 40: 42, 63: 58 },
  A: { 25: 62, 40: 68, 63: 86 },
  "A-SI": { 40: 110, 63: 130 },
  F: { 40: 95, 63: 120 },
  B: { 40: 290 },
};

const round = (n: number) => Math.round(n * 2) / 2;

function buildBrand(p: BrandProfile): CatalogItem[] {
  const items: CatalogItem[] = [];
  const slug = p.brand.toLowerCase();
  for (const modules of [13, 18]) {
    for (const rows of [1, 2, 3, 4]) {
      items.push({
        id: `${slug}-coffret-${modules}x${rows}`,
        brand: p.brand,
        range: p.enclosureRange,
        kind: "enclosure",
        label: `Coffret ${p.enclosureRange} ${rows} rangée${rows > 1 ? "s" : ""} ${modules} modules`,
        ref: p.enclosureRef?.(rows, modules),
        rows,
        modulesPerRow: modules,
        price: round(ENCLOSURE_BASE[modules][rows] * p.priceFactor),
      });
    }
    items.push({
      id: `${slug}-peigne-${modules}`,
      brand: p.brand,
      range: p.deviceRange,
      kind: "comb",
      label: `Peigne d'alimentation horizontal ${modules} modules phase + neutre`,
      ref: p.combRef?.(modules),
      modulesPerRow: modules,
      price: round((modules === 13 ? 9 : 12) * p.priceFactor),
    });
  }
  for (const rating of [2, 6, 10, 16, 20, 25, 32, 40]) {
    items.push({
      id: `${slug}-mcb-c${rating}`,
      brand: p.brand,
      range: p.deviceRange,
      kind: "mcb",
      label: `Disjoncteur ${rating} A courbe C phase + neutre`,
      ref: p.mcbRef?.(rating),
      modules: rating >= 40 ? 2 : 1,
      rating,
      curve: "C",
      poles: "1P+N",
      breakingCapacity: p.breakingCapacity,
      price: round(MCB_BASE[rating] * p.priceFactor),
    });
  }
  for (const type of ["AC", "A", "A-SI", "F", "B"] as RcdType[]) {
    if (type === "B" && !p.hasTypeB) continue;
    for (const rating of Object.keys(RCD_BASE[type]).map(Number)) {
      items.push({
        id: `${slug}-rcd-${type.toLowerCase()}-${rating}`,
        brand: p.brand,
        range: p.deviceRange,
        kind: "rcd",
        label: `Interrupteur différentiel ${rating} A 30 mA type ${type}`,
        ref: p.rcdRef?.(rating, type),
        modules: 2,
        rating,
        poles: "2P",
        rcdType: type,
        sensitivity: 30,
        price: round(RCD_BASE[type][rating] * p.priceFactor),
      });
    }
  }
  items.push(
    {
      id: `${slug}-rcbo-f-20`,
      brand: p.brand,
      range: p.deviceRange,
      kind: "rcbo",
      label: "Disjoncteur différentiel 20 A 30 mA type F (prise véhicule électrique)",
      modules: 2,
      rating: 20,
      curve: "C",
      poles: "1P+N",
      rcdType: "F",
      sensitivity: 30,
      breakingCapacity: p.breakingCapacity,
      price: round(115 * p.priceFactor),
    },
    {
      id: `${slug}-rcbo-a-40`,
      brand: p.brand,
      range: p.deviceRange,
      kind: "rcbo",
      label: "Disjoncteur différentiel 40 A 30 mA type A (borne de recharge)",
      modules: 2,
      rating: 40,
      curve: "C",
      poles: "1P+N",
      rcdType: "A",
      sensitivity: 30,
      breakingCapacity: p.breakingCapacity,
      price: round(125 * p.priceFactor),
    },
    {
      id: `${slug}-rcbo-a-16`,
      brand: p.brand,
      range: p.deviceRange,
      kind: "rcbo",
      label: "Disjoncteur différentiel 16 A 30 mA type A",
      modules: 2,
      rating: 16,
      curve: "C",
      poles: "1P+N",
      rcdType: "A",
      sensitivity: 30,
      breakingCapacity: p.breakingCapacity,
      price: round(80 * p.priceFactor),
    },
    {
      id: `${slug}-spd`,
      brand: p.brand,
      range: p.deviceRange,
      kind: "spd",
      label: "Parafoudre type 2 phase + neutre avec protection intégrée",
      modules: 2,
      price: round(95 * p.priceFactor),
    },
    {
      id: `${slug}-contactor`,
      brand: p.brand,
      range: p.deviceRange,
      kind: "contactor",
      label: "Contacteur heures creuses 20 A 2P avec commande manuelle",
      modules: 1,
      rating: 20,
      price: round(32 * p.priceFactor),
    },
    {
      id: `${slug}-teleruptor`,
      brand: p.brand,
      range: p.deviceRange,
      kind: "teleruptor",
      label: "Télérupteur 16 A",
      modules: 1,
      rating: 16,
      price: round(24 * p.priceFactor),
    },
    {
      id: `${slug}-socket`,
      brand: p.brand,
      range: p.deviceRange,
      kind: "socket",
      label: "Prise de courant modulaire 2P+T 16 A",
      modules: 3,
      rating: 16,
      price: round(15 * p.priceFactor),
    },
    {
      id: `${slug}-obturateur`,
      brand: p.brand,
      range: p.enclosureRange,
      kind: "blankStrip",
      label: "Obturateur sécable 5 modules",
      modules: 5,
      price: round(3 * p.priceFactor),
    },
  );
  return items;
}

/** Appareils anciens ou génériques, surtout utiles pour décrire un tableau existant. */
const GENERIC: CatalogItem[] = [
  ...[10, 16, 20, 25, 32].map<CatalogItem>((rating) => ({
    id: `gen-fuse-${rating}`,
    brand: "Générique",
    range: "Ancien",
    kind: "fuse",
    label: `Coupe-circuit à fusible ${rating} A`,
    modules: 1,
    rating,
    poles: "1P+N",
    price: 6,
  })),
  ...[10, 16, 20, 32].map<CatalogItem>((rating) => ({
    id: `gen-mcb1p-${rating}`,
    brand: "Générique",
    range: "Ancien",
    kind: "mcb",
    label: `Disjoncteur ${rating} A unipolaire (phase seule)`,
    modules: 1,
    rating,
    curve: "C",
    poles: "1P",
    breakingCapacity: 3000,
    price: 7,
  })),
  ...[2, 10, 16, 20, 25, 32].map<CatalogItem>((rating) => ({
    id: `gen-mcb-c${rating}`,
    brand: "Générique",
    range: "Standard",
    kind: "mcb",
    label: `Disjoncteur ${rating} A courbe C phase + neutre`,
    modules: 1,
    rating,
    curve: "C",
    poles: "1P+N",
    breakingCapacity: 3000,
    price: 8,
  })),
  {
    id: "gen-rcd-ac-40-500",
    brand: "Générique",
    range: "Ancien",
    kind: "rcd",
    label: "Interrupteur différentiel 40 A 500 mA",
    modules: 2,
    rating: 40,
    poles: "2P",
    rcdType: "AC",
    sensitivity: 500,
    price: 40,
  },
  ...[25, 40, 63].map<CatalogItem>((rating) => ({
    id: `gen-rcd-ac-${rating}`,
    brand: "Générique",
    range: "Standard",
    kind: "rcd",
    label: `Interrupteur différentiel ${rating} A 30 mA type AC`,
    modules: 2,
    rating,
    poles: "2P",
    rcdType: "AC",
    sensitivity: 30,
    price: 35,
  })),
  {
    id: "gen-rcd-a-40",
    brand: "Générique",
    range: "Standard",
    kind: "rcd",
    label: "Interrupteur différentiel 40 A 30 mA type A",
    modules: 2,
    rating: 40,
    poles: "2P",
    rcdType: "A",
    sensitivity: 30,
    price: 55,
  },
  {
    id: "gen-contactor",
    brand: "Générique",
    range: "Standard",
    kind: "contactor",
    label: "Contacteur heures creuses 20 A",
    modules: 1,
    rating: 20,
    price: 25,
  },
  {
    id: "gen-switch",
    brand: "Générique",
    range: "Standard",
    kind: "switch",
    label: "Interrupteur sectionneur 40 A",
    modules: 2,
    rating: 40,
    price: 18,
  },
  {
    id: "gen-timer",
    brand: "Générique",
    range: "Standard",
    kind: "timer",
    label: "Programmateur / minuterie modulaire",
    modules: 1,
    price: 25,
  },
  {
    id: "gen-other",
    brand: "Générique",
    range: "Standard",
    kind: "other",
    label: "Autre appareil modulaire",
    modules: 1,
    price: 0,
  },
];

export const CATALOG: CatalogItem[] = [...PROFILES.flatMap(buildBrand), ...GENERIC];

export const DEVICE_BRANDS: Brand[] = PROFILES.map((p) => p.brand);

export function allCatalog(custom: CatalogItem[] = []): CatalogItem[] {
  return [...CATALOG, ...custom];
}

export function catalogById(id: string | undefined, custom: CatalogItem[] = []): CatalogItem | undefined {
  if (!id) return undefined;
  return CATALOG.find((c) => c.id === id) ?? custom.find((c) => c.id === id);
}

export interface DeviceQuery {
  kind: CatalogKind;
  rating?: number;
  rcdType?: RcdType;
  curve?: Curve;
  modulesPerRow?: number;
  rows?: number;
}

/** Cherche l'article du catalogue d'une marque qui correspond à une spécification. */
export function findCatalogItem(brand: Brand, q: DeviceQuery, custom: CatalogItem[] = []): CatalogItem | undefined {
  const pool = allCatalog(custom).filter((c) => c.brand === brand && c.kind === q.kind);
  return pool.find(
    (c) =>
      (q.rating === undefined || c.rating === q.rating) &&
      (q.rcdType === undefined || c.rcdType === q.rcdType) &&
      (q.curve === undefined || c.curve === undefined || c.curve === q.curve) &&
      (q.modulesPerRow === undefined || c.modulesPerRow === q.modulesPerRow) &&
      (q.rows === undefined || c.rows === q.rows),
  );
}

export const KIND_LABEL: Record<CatalogKind, string> = {
  mcb: "Disjoncteur",
  rcd: "Interrupteur différentiel",
  rcbo: "Disjoncteur différentiel",
  fuse: "Fusible",
  spd: "Parafoudre",
  contactor: "Contacteur HC",
  teleruptor: "Télérupteur",
  switch: "Interrupteur / sectionneur",
  timer: "Minuterie / programmateur",
  socket: "Prise modulaire",
  blank: "Obturateur",
  other: "Autre",
  enclosure: "Coffret",
  comb: "Peigne",
  blankStrip: "Obturateurs",
};

export function leroyMerlinSearchUrl(text: string): string {
  return `https://www.leroymerlin.fr/resultats/?q=${encodeURIComponent(text)}`;
}
