/** Modèle de données du simulateur de tableau électrique (installation monophasée). */

export type Brand = "Schneider" | "Legrand" | "Hager" | "Lexman" | "Générique";

export const BRANDS: Brand[] = ["Schneider", "Legrand", "Hager", "Lexman", "Générique"];

export type DeviceKind =
  | "mcb" // disjoncteur divisionnaire
  | "rcd" // interrupteur différentiel
  | "rcbo" // disjoncteur différentiel
  | "fuse" // coupe-circuit à fusible
  | "spd" // parafoudre
  | "contactor" // contacteur heures creuses
  | "teleruptor" // télérupteur
  | "switch" // interrupteur / sectionneur modulaire
  | "timer" // minuterie, programmateur, délesteur…
  | "socket" // prise modulaire
  | "blank" // obturateur / emplacement vide volontaire
  | "other";

export type Curve = "B" | "C" | "D";
export type Poles = "1P" | "1P+N" | "2P";
export type RcdType = "AC" | "A" | "A-SI" | "F" | "B";
export type Condition = "bon" | "usé" | "HS" | "inconnu";

export type CircuitUsage =
  | "eclairage"
  | "prises"
  | "prises_cuisine"
  | "volets"
  | "chauffage"
  | "chauffe_eau"
  | "plaque"
  | "four"
  | "lave_linge"
  | "seche_linge"
  | "lave_vaisselle"
  | "congelateur"
  | "micro_ondes"
  | "vmc"
  | "irve_prise"
  | "irve_borne"
  | "pac_clim"
  | "exterieur"
  | "informatique"
  | "autre";

export interface Circuit {
  usage: CircuitUsage;
  /** Pièces desservies, texte libre (« Séjour, entrée »). */
  rooms: string;
  /** Nombre de prises (circuits prises) ou de points lumineux (éclairage) ou d'appareils. */
  points: number;
  /** Puissance installée en W (chauffage, borne, appareil). */
  powerW?: number;
  /** Section des conducteurs en mm². */
  sectionMm2?: number;
  /** Détail libre de ce qui est branché. */
  description?: string;
  /** Généré : le câble doit être remplacé pour respecter la section minimale. */
  rewire?: boolean;
}

export interface Device {
  id: string;
  kind: DeviceKind;
  catalogId?: string;
  brand?: Brand;
  ref?: string;
  modules: number;
  rating?: number; // A
  curve?: Curve;
  poles?: Poles;
  breakingCapacity?: number; // A (3000, 4500, 6000)
  rcdType?: RcdType;
  sensitivity?: number; // mA
  label?: string;
  condition?: Condition;
  /** Id du différentiel qui protège ce départ. undefined = automatique (différentiel à gauche dans la rangée). null = aucun. */
  protectedBy?: string | null;
  circuit?: Circuit;
  note?: string;
}

export interface Enclosure {
  catalogId?: string;
  brand: Brand;
  ref?: string;
  label?: string;
  rows: number;
  modulesPerRow: number;
}

export type PanelRole = "existing" | "new";

export interface Panel {
  id: string;
  name: string;
  role: PanelRole;
  enclosure: Enclosure;
  rows: Device[][];
  /** Hauteur des manettes par rapport au sol fini, en mètres. */
  controlHeightM?: number;
  /** Travaux à prévoir, renseignés par la génération automatique. */
  notes?: string[];
}

export interface House {
  name: string;
  surfaceM2: number;
  /** Nombre de pièces principales (séjour + chambres). */
  mainRooms: number;
  subscriptionKva: number;
  /** Calibre du disjoncteur de branchement (AGCP), en A. */
  agcpRating: number;
  /** Sensibilité du disjoncteur de branchement, en mA. */
  agcpSensitivity: number;
  /** Résistance de la prise de terre mesurée, en ohms (undefined = inconnue). */
  earthOhms?: number;
  offPeak: boolean;
  electricHeating: boolean;
  /** Zone AQ2 : niveau kéraunique élevé (Nk > 25 jours d'orage par an). */
  aq2Zone: boolean;
  overheadSupply: boolean;
  lightningRod: boolean;
  /** Équipement pour la sécurité des personnes (médical à domicile, alarme…). */
  safetyEquipment: boolean;
  sensitiveEquipment: boolean;
  hasKitchenOver4m2: boolean;
  department?: string;
}

export interface InventoryEntry {
  /** Quantité possédée saisie à la main (remplace le calcul automatique). */
  owned?: number;
  /** Prix unitaire saisi à la main. */
  price?: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface Project {
  version: 1;
  updatedAt: number;
  house: House;
  panels: Panel[];
  activePanelId: string;
  /** Tableau source (existant) et cible (nouveau) pour le matériel. */
  sourcePanelId?: string;
  targetPanelId?: string;
  inventory: Record<string, InventoryEntry>;
  allowCrossBrandReuse: boolean;
  catalogOverrides: Record<string, { ref?: string; price?: number }>;
  customCatalog: import("./catalog").CatalogItem[];
  chat: ChatTurn[];
}

export type Severity = "danger" | "nonconforme" | "avertissement" | "conseil";

export interface Finding {
  id: string;
  ruleId: string;
  severity: Severity;
  title: string;
  /** Ce qui est constaté sur le tableau. */
  detail: string;
  /** Ce que dit la norme. */
  norm: string;
  /** Référence dans la norme. */
  normRef: string;
  /** Comment mettre en conformité. */
  fix: string;
  deviceIds: string[];
}
