/**
 * Valeurs de la NF C 15-100 (révision du 23 août 2024, applicable à toutes les installations
 * neuves ou entièrement rénovées depuis le 23 août 2025) pour un logement monophasé.
 * Sources : norme NF C 15-100-10 (bâtiments d'habitation) telle que résumée dans le guide
 * Legrand « NF C 15-100 révision 23 août 2024 — points clés ».
 */
import type { CircuitUsage, RcdType } from "./types";

export const STANDARD_RATINGS = [2, 6, 10, 16, 20, 25, 32, 40, 50, 63];

/** Calibre maximal du disjoncteur selon la section des conducteurs cuivre (usage domestique). */
export const MAX_RATING_BY_SECTION: Record<number, number> = {
  1.5: 16,
  2.5: 20,
  4: 25,
  6: 32,
  10: 40,
  16: 63,
};

export const SECTIONS = [1.5, 2.5, 4, 6, 10, 16];

export function maxRatingForSection(section: number): number {
  const known = SECTIONS.filter((s) => s <= section);
  if (known.length === 0) return 0;
  return MAX_RATING_BY_SECTION[known[known.length - 1]];
}

export function minSectionForRating(rating: number): number {
  return SECTIONS.find((s) => MAX_RATING_BY_SECTION[s] >= rating) ?? 16;
}

/** Chauffage : puissance totale maximale par circuit selon le calibre. */
export const HEATING_MAX_POWER: { rating: number; section: number; maxW: number }[] = [
  { rating: 16, section: 1.5, maxW: 3500 },
  { rating: 20, section: 2.5, maxW: 4500 },
  { rating: 25, section: 4, maxW: 5750 },
  { rating: 32, section: 6, maxW: 7250 },
];

export function heatingMaxPower(rating: number): number {
  const row = [...HEATING_MAX_POWER].reverse().find((r) => r.rating <= rating);
  return row?.maxW ?? 0;
}

export const MIN_BREAKING_CAPACITY = 3000;
export const MAX_CIRCUITS_PER_RCD = 8;
export const RESERVE_RATIO = 0.2;
export const CONTROL_HEIGHT_MIN = 0.9;
export const CONTROL_HEIGHT_MAX = 1.8;
export const MAX_EARTH_OHMS = 100;
export const GOOD_EARTH_OHMS = 50;

export type UsageGroup = "eclairage" | "prises" | "specialise" | "chauffage" | "autre";

export interface UsageSpec {
  label: string;
  group: UsageGroup;
  /** Nom de ce que compte `points`. */
  pointsLabel: string;
  defaultRating: number;
  defaultSection: number;
  defaultPoints: number;
  /** Combinaisons calibre / section / nombre de points admises. */
  allowed?: { rating: number; section: number; maxPoints?: number }[];
  /** Un seul appareil par circuit. */
  dedicated?: boolean;
  /** Compte dans les 3 circuits spécialisés 20 A minimum. */
  specialized?: boolean;
  /** Types de différentiel obligatoires. */
  rcdRequired?: RcdType[];
  /** Types de différentiel recommandés. */
  rcdAdvised?: RcdType[];
  /** Coefficient 1 dans le calcul du calibre du différentiel (chauffage, chauffe-eau). */
  fullLoad?: boolean;
  /** Circuit à forte consommation (à répartir entre différentiels). */
  heavy?: boolean;
  /** Le calibre dépend de la puissance saisie. */
  powerBased?: boolean;
  normRef: string;
  normText: string;
}

const TYPE_A_OR_F: RcdType[] = ["A", "A-SI", "F", "B"];

export const USAGES: Record<CircuitUsage, UsageSpec> = {
  eclairage: {
    label: "Éclairage",
    group: "eclairage",
    pointsLabel: "points lumineux",
    defaultRating: 16,
    defaultSection: 1.5,
    defaultPoints: 6,
    allowed: [
      { rating: 10, section: 1.5, maxPoints: 8 },
      { rating: 16, section: 1.5, maxPoints: 8 },
    ],
    normRef: "NF C 15-100-10 · circuits d'éclairage",
    normText:
      "Fils 1,5 mm², disjoncteur 10 ou 16 A, 8 points d'éclairage maximum par circuit (plafonniers, appliques, prises commandées). Au moins 2 circuits d'éclairage par logement (1 seul admis pour un studio ou T1). Tous les circuits d'éclairage comportent un conducteur de terre.",
  },
  prises: {
    label: "Prises de courant",
    group: "prises",
    pointsLabel: "prises",
    defaultRating: 20,
    defaultSection: 2.5,
    defaultPoints: 8,
    allowed: [
      { rating: 16, section: 1.5, maxPoints: 8 },
      { rating: 20, section: 2.5, maxPoints: 12 },
    ],
    normRef: "NF C 15-100-10 · circuits prises de courant",
    normText:
      "Prises 2P+T : 8 prises maximum sur un circuit 16 A en 1,5 mm², 12 prises maximum sur un circuit 20 A en 2,5 mm². Une prise double compte pour 2. Une prise commandée par un interrupteur compte comme un point d'éclairage.",
  },
  prises_cuisine: {
    label: "Prises cuisine (plan de travail)",
    group: "prises",
    pointsLabel: "prises",
    defaultRating: 20,
    defaultSection: 2.5,
    defaultPoints: 6,
    allowed: [{ rating: 20, section: 2.5, maxPoints: 6 }],
    normRef: "NF C 15-100-10 · prises de la cuisine",
    normText:
      "Cuisine de plus de 4 m² : 6 prises minimum dont 4 au-dessus du plan de travail, alimentées par un circuit dédié 20 A en 2,5 mm² de 6 prises maximum (hors circuits spécialisés).",
  },
  volets: {
    label: "Volets roulants",
    group: "autre",
    pointsLabel: "moteurs",
    defaultRating: 16,
    defaultSection: 1.5,
    defaultPoints: 4,
    allowed: [
      { rating: 16, section: 1.5 },
      { rating: 20, section: 2.5 },
    ],
    normRef: "NF C 15-100-10 · circuit volets roulants",
    normText:
      "Volets roulants motorisés : au moins 1 circuit spécialisé dédié aux moteurs, 16 A en 1,5 mm² ou 20 A en 2,5 mm². Conseillé : répartir les moteurs sur 2 circuits.",
  },
  chauffage: {
    label: "Chauffage électrique",
    group: "chauffage",
    pointsLabel: "radiateurs",
    defaultRating: 20,
    defaultSection: 2.5,
    defaultPoints: 2,
    fullLoad: true,
    heavy: true,
    powerBased: true,
    normRef: "NF C 15-100-10 · circuit chauffage",
    normText:
      "Circuit dédié au chauffage. Puissance totale maximale par circuit : 3 500 W en 1,5 mm² / 16 A, 4 500 W en 2,5 mm² / 20 A, 5 750 W en 4 mm² / 25 A, 7 250 W en 6 mm² / 32 A.",
  },
  chauffe_eau: {
    label: "Chauffe-eau",
    group: "specialise",
    pointsLabel: "appareil",
    defaultRating: 20,
    defaultSection: 2.5,
    defaultPoints: 1,
    allowed: [{ rating: 20, section: 2.5, maxPoints: 1 }],
    dedicated: true,
    specialized: true,
    fullLoad: true,
    heavy: true,
    normRef: "NF C 15-100-10 · circuits spécialisés",
    normText:
      "Chauffe-eau électrique : circuit spécialisé 20 A en 2,5 mm², un seul appareil par circuit. Commandé par un contacteur heures creuses si l'abonnement le prévoit.",
  },
  plaque: {
    label: "Plaque de cuisson / cuisinière",
    group: "specialise",
    pointsLabel: "appareil",
    defaultRating: 32,
    defaultSection: 6,
    defaultPoints: 1,
    allowed: [{ rating: 32, section: 6, maxPoints: 1 }],
    dedicated: true,
    rcdRequired: TYPE_A_OR_F,
    heavy: true,
    normRef: "NF C 15-100-10 · circuit cuisson",
    normText:
      "Plaque de cuisson ou cuisinière : circuit dédié 32 A en 6 mm² (monophasé), obligatoirement protégé par un interrupteur différentiel 30 mA de type A ou F.",
  },
  four: {
    label: "Four",
    group: "specialise",
    pointsLabel: "appareil",
    defaultRating: 20,
    defaultSection: 2.5,
    defaultPoints: 1,
    allowed: [{ rating: 20, section: 2.5, maxPoints: 1 }],
    dedicated: true,
    specialized: true,
    heavy: true,
    normRef: "NF C 15-100-10 · circuits spécialisés",
    normText: "Four électrique : circuit spécialisé 20 A en 2,5 mm², un seul appareil par circuit.",
  },
  lave_linge: {
    label: "Lave-linge",
    group: "specialise",
    pointsLabel: "appareil",
    defaultRating: 20,
    defaultSection: 2.5,
    defaultPoints: 1,
    allowed: [{ rating: 20, section: 2.5, maxPoints: 1 }],
    dedicated: true,
    specialized: true,
    rcdRequired: TYPE_A_OR_F,
    heavy: true,
    normRef: "NF C 15-100-10 · protection des personnes / circuits spécialisés",
    normText:
      "Lave-linge : circuit spécialisé 20 A en 2,5 mm², un seul appareil, obligatoirement protégé par un interrupteur différentiel 30 mA de type A ou F.",
  },
  seche_linge: {
    label: "Sèche-linge",
    group: "specialise",
    pointsLabel: "appareil",
    defaultRating: 20,
    defaultSection: 2.5,
    defaultPoints: 1,
    allowed: [{ rating: 20, section: 2.5, maxPoints: 1 }],
    dedicated: true,
    specialized: true,
    rcdAdvised: TYPE_A_OR_F,
    heavy: true,
    normRef: "NF C 15-100-10 · circuits spécialisés",
    normText:
      "Sèche-linge : circuit spécialisé 20 A en 2,5 mm², un seul appareil. Le type A est adapté à cet appareil (électronique de puissance).",
  },
  lave_vaisselle: {
    label: "Lave-vaisselle",
    group: "specialise",
    pointsLabel: "appareil",
    defaultRating: 20,
    defaultSection: 2.5,
    defaultPoints: 1,
    allowed: [{ rating: 20, section: 2.5, maxPoints: 1 }],
    dedicated: true,
    specialized: true,
    heavy: true,
    normRef: "NF C 15-100-10 · circuits spécialisés",
    normText: "Lave-vaisselle : circuit spécialisé 20 A en 2,5 mm², un seul appareil par circuit.",
  },
  congelateur: {
    label: "Congélateur",
    group: "specialise",
    pointsLabel: "appareil",
    defaultRating: 20,
    defaultSection: 2.5,
    defaultPoints: 1,
    allowed: [{ rating: 20, section: 2.5, maxPoints: 1 }],
    dedicated: true,
    specialized: true,
    rcdAdvised: ["A-SI"],
    normRef: "NF C 15-100-10 · circuits spécialisés",
    normText:
      "Congélateur : circuit spécialisé 20 A en 2,5 mm², un seul appareil. Un différentiel haute immunité (type A-SI / Hpi) limite les coupures intempestives.",
  },
  refrigerateur: {
    label: "Réfrigérateur",
    group: "specialise",
    pointsLabel: "appareil",
    defaultRating: 20,
    defaultSection: 2.5,
    defaultPoints: 1,
    allowed: [
      { rating: 16, section: 1.5, maxPoints: 1 },
      { rating: 20, section: 2.5, maxPoints: 1 },
    ],
    dedicated: true,
    rcdAdvised: ["A-SI"],
    normRef: "NF C 15-100-10 · circuits prises et spécialisés",
    normText:
      "Réfrigérateur : il peut être branché sur une prise du circuit de la cuisine. Un circuit dédié n'est pas obligatoire mais conseillé (20 A en 2,5 mm² ou 16 A en 1,5 mm², un seul appareil), de préférence sous un différentiel haute immunité (A-SI / Hpi) pour ne pas perdre la chaîne du froid en cas de coupure intempestive.",
  },
  micro_ondes: {
    label: "Micro-ondes",
    group: "specialise",
    pointsLabel: "appareil",
    defaultRating: 20,
    defaultSection: 2.5,
    defaultPoints: 1,
    allowed: [{ rating: 20, section: 2.5, maxPoints: 1 }],
    dedicated: true,
    specialized: true,
    normRef: "NF C 15-100-10 · circuits spécialisés",
    normText: "Micro-ondes : circuit spécialisé 20 A en 2,5 mm², un seul appareil par circuit.",
  },
  vmc: {
    label: "VMC",
    group: "autre",
    pointsLabel: "appareil",
    defaultRating: 2,
    defaultSection: 1.5,
    defaultPoints: 1,
    allowed: [
      { rating: 2, section: 1.5, maxPoints: 1 },
      { rating: 6, section: 1.5, maxPoints: 1 },
    ],
    dedicated: true,
    normRef: "NF C 15-100-10 · circuits spécialisés",
    normText: "VMC : circuit dédié, disjoncteur 2 A en 1,5 mm² (jusqu'à 6 A selon la notice du groupe).",
  },
  irve_prise: {
    label: "Prise renforcée véhicule électrique",
    group: "specialise",
    pointsLabel: "prise",
    defaultRating: 20,
    defaultSection: 2.5,
    defaultPoints: 1,
    allowed: [{ rating: 20, section: 2.5, maxPoints: 1 }],
    dedicated: true,
    rcdRequired: ["A", "A-SI", "F", "B"],
    heavy: true,
    normRef: "NF C 15-100-7-722 · alimentation des véhicules électriques",
    normText:
      "Prise renforcée (mode 2) : circuit dédié 20 A en 2,5 mm², 1 point de recharge par circuit, protégé par un différentiel 30 mA de type A ou F.",
  },
  irve_borne: {
    label: "Borne de recharge (wallbox)",
    group: "specialise",
    pointsLabel: "borne",
    defaultRating: 40,
    defaultSection: 10,
    defaultPoints: 1,
    dedicated: true,
    rcdRequired: ["A", "A-SI", "F", "B"],
    heavy: true,
    fullLoad: true,
    powerBased: true,
    normRef: "NF C 15-100-7-722 · alimentation des véhicules électriques",
    normText:
      "Borne monophasée (mode 3) : circuit dédié, 1 point de recharge par circuit, différentiel 30 mA de type A associé à un dispositif de détection des courants continus 6 mA (souvent intégré à la borne), ou type F + détection 6 mA. Calibre et section selon la puissance (7,4 kW ≈ 40 A en 10 mm²).",
  },
  pac_clim: {
    label: "Pompe à chaleur / climatisation",
    group: "chauffage",
    pointsLabel: "appareil",
    defaultRating: 20,
    defaultSection: 2.5,
    defaultPoints: 1,
    dedicated: true,
    rcdAdvised: ["F", "A"],
    heavy: true,
    fullLoad: true,
    powerBased: true,
    normRef: "NF C 15-100-10 · protection des personnes",
    normText:
      "PAC / climatiseur à variateur de vitesse : circuit dédié dimensionné selon la notice du fabricant ; différentiel de type F (ou A) adapté aux variateurs monophasés.",
  },
  exterieur: {
    label: "Extérieur / dépendance",
    group: "prises",
    pointsLabel: "points",
    defaultRating: 20,
    defaultSection: 2.5,
    defaultPoints: 3,
    allowed: [
      { rating: 16, section: 1.5, maxPoints: 8 },
      { rating: 20, section: 2.5, maxPoints: 12 },
    ],
    normRef: "NF C 15-100-10 · circuits prises de courant",
    normText:
      "Circuits extérieurs (jardin, portail, dépendance) : mêmes règles que les prises (8 prises en 16 A / 1,5 mm², 12 en 20 A / 2,5 mm²), matériel IP adapté. Une dépendance avec plusieurs pièces peut nécessiter son propre tableau.",
  },
  chaudiere: {
    label: "Chaudière (gaz, fioul)",
    group: "specialise",
    pointsLabel: "appareil",
    defaultRating: 16,
    defaultSection: 1.5,
    defaultPoints: 1,
    allowed: [
      { rating: 10, section: 1.5, maxPoints: 1 },
      { rating: 16, section: 1.5, maxPoints: 1 },
      { rating: 20, section: 2.5, maxPoints: 1 },
    ],
    dedicated: true,
    normRef: "NF C 15-100-10 · circuits spécialisés",
    normText:
      "Chaudière gaz ou fioul : alimentée par un circuit dédié, disjoncteur 10 ou 16 A en 1,5 mm² (20 A en 2,5 mm² si la notice le demande), un seul appareil par circuit. Différentiel de type AC ou A.",
  },
  adoucisseur: {
    label: "Adoucisseur d'eau",
    group: "prises",
    pointsLabel: "prises",
    defaultRating: 16,
    defaultSection: 1.5,
    defaultPoints: 1,
    allowed: [
      { rating: 16, section: 1.5, maxPoints: 8 },
      { rating: 20, section: 2.5, maxPoints: 12 },
    ],
    normRef: "NF C 15-100-10 · circuits prises de courant",
    normText:
      "Adoucisseur d'eau : appareil de très faible puissance (quelques watts pour la vanne électronique), branché sur une prise 2P+T d'un circuit prises (16 A en 1,5 mm² ou 20 A en 2,5 mm²). Pas de circuit spécialisé obligatoire ; prévoir une prise à proximité de l'arrivée d'eau, hors volumes 0 à 2 en pièce d'eau.",
  },
  informatique: {
    label: "Informatique / box",
    group: "prises",
    pointsLabel: "prises",
    defaultRating: 16,
    defaultSection: 1.5,
    defaultPoints: 4,
    allowed: [
      { rating: 16, section: 1.5, maxPoints: 8 },
      { rating: 20, section: 2.5, maxPoints: 12 },
    ],
    rcdAdvised: ["A-SI"],
    normRef: "NF C 15-100-10 · circuits prises de courant",
    normText:
      "Circuit prises dédié aux équipements sensibles : règles des circuits prises ; un différentiel haute immunité (A-SI / Hpi) est conseillé.",
  },
  autre: {
    label: "Autre usage",
    group: "autre",
    pointsLabel: "points",
    defaultRating: 16,
    defaultSection: 1.5,
    defaultPoints: 1,
    normRef: "NF C 15-100-1 · protection contre les surintensités",
    normText: "Tout circuit est protégé par un disjoncteur adapté à la section de ses conducteurs.",
  },
};

export const USAGE_ORDER: CircuitUsage[] = [
  "eclairage",
  "prises",
  "prises_cuisine",
  "volets",
  "chauffage",
  "chauffe_eau",
  "plaque",
  "four",
  "lave_linge",
  "seche_linge",
  "lave_vaisselle",
  "congelateur",
  "refrigerateur",
  "micro_ondes",
  "vmc",
  "irve_prise",
  "irve_borne",
  "pac_clim",
  "chaudiere",
  "adoucisseur",
  "exterieur",
  "informatique",
  "autre",
];

/** Calibre et section attendus pour un usage (et une puissance le cas échéant). */
export function expectedProtection(
  usage: CircuitUsage,
  powerW?: number,
  section?: number,
): { rating: number; section: number } {
  const spec = USAGES[usage];
  if (usage === "chauffage" && powerW) {
    const row = HEATING_MAX_POWER.find((r) => r.maxW >= powerW);
    if (row) return { rating: row.rating, section: row.section };
    return { rating: 32, section: 6 };
  }
  if ((usage === "irve_borne" || usage === "pac_clim") && powerW) {
    const needed = (powerW / 230) * (usage === "irve_borne" ? 1.2 : 1.25);
    const rating = STANDARD_RATINGS.find((r) => r >= needed) ?? 63;
    return { rating, section: minSectionForRating(rating) };
  }
  if (spec.allowed && section) {
    // Le calibre usuel de l'usage s'il convient à la section, sinon le plus fort admis.
    const fitting = spec.allowed.filter((a) => a.section <= section);
    const match = fitting.find((a) => a.rating === spec.defaultRating) ?? fitting[fitting.length - 1];
    if (match) return { rating: match.rating, section: match.section };
  }
  return { rating: spec.defaultRating, section: spec.defaultSection };
}

/** Nombre maximal de points pour un usage selon le calibre. */
export function maxPointsFor(usage: CircuitUsage, rating?: number): number | undefined {
  const spec = USAGES[usage];
  if (!spec.allowed) return spec.dedicated ? 1 : undefined;
  const rows = spec.allowed.filter((a) => a.maxPoints !== undefined);
  if (rows.length === 0) return spec.dedicated ? 1 : undefined;
  if (rating === undefined) return Math.max(...rows.map((r) => r.maxPoints!));
  const exact = rows.find((r) => r.rating === rating);
  if (exact) return exact.maxPoints;
  const lower = [...rows].sort((a, b) => b.rating - a.rating).find((r) => r.rating <= rating);
  return (lower ?? rows[0]).maxPoints;
}

export const RCD_TYPE_LABEL: Record<RcdType, string> = {
  AC: "Type AC",
  A: "Type A",
  "A-SI": "Type A-SI (Hpi)",
  F: "Type F",
  B: "Type B",
};

export function isTypeAOrBetter(t?: RcdType): boolean {
  return t === "A" || t === "A-SI" || t === "F" || t === "B";
}

/** Section au format français : 1,5 mm². */
export const mm2 = (n: number | undefined) => (n === undefined ? "?" : String(n).replace(".", ","));

/** Le calibre est-il admis pour cet usage, compte tenu de la section et de la puissance ? */
export function ratingAllowed(usage: CircuitUsage, rating: number | undefined, section?: number, powerW?: number): boolean {
  if (!rating) return false;
  if (section && rating > maxRatingForSection(section)) return false;
  const spec = USAGES[usage];
  if (usage === "chauffage") return !powerW || powerW <= heatingMaxPower(rating);
  if (spec.powerBased) return !powerW || rating >= expectedProtection(usage, powerW).rating;
  if (!spec.allowed) return true;
  return spec.allowed.some((a) => a.rating === rating && (!section || a.section <= section));
}

/**
 * Calibre à conseiller : le calibre actuel s'il est admis (2 A pour une VMC, 10 A pour
 * l'éclairage…), sinon le calibre attendu, plafonné par la section des fils.
 */
export function recommendedRating(usage: CircuitUsage, rating: number | undefined, section?: number, powerW?: number): number {
  if (ratingAllowed(usage, rating, section, powerW)) return rating!;
  const exp = expectedProtection(usage, powerW, section);
  return section ? Math.min(exp.rating, maxRatingForSection(section)) : exp.rating;
}
