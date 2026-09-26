/** Projet d'exemple : un tableau des années 1990 typique, avec ses défauts. */
import { newId } from "./panel";
import type { Circuit, Device, House, Panel, Project } from "./types";

export function defaultHouse(): House {
  return {
    name: "Ma maison",
    surfaceM2: 110,
    mainRooms: 5,
    subscriptionKva: 9,
    agcpRating: 45,
    agcpSensitivity: 500,
    earthOhms: undefined,
    offPeak: true,
    electricHeating: true,
    aq2Zone: false,
    overheadSupply: false,
    lightningRod: false,
    safetyEquipment: false,
    sensitiveEquipment: true,
    hasKitchenOver4m2: true,
  };
}

const mcb = (rating: number, label: string, circuit: Circuit, extra: Partial<Device> = {}): Device => ({
  id: newId(),
  kind: "mcb",
  brand: "Legrand",
  modules: 1,
  rating,
  curve: "C",
  poles: "1P+N",
  breakingCapacity: 3000,
  label,
  condition: "bon",
  circuit,
  ...extra,
});

export function samplePanel(): Panel {
  const row1: Device[] = [
    {
      id: newId(),
      kind: "rcd",
      brand: "Legrand",
      modules: 2,
      rating: 40,
      poles: "2P",
      rcdType: "AC",
      sensitivity: 30,
      label: "Différentiel",
      condition: "bon",
    },
    mcb(16, "Lumières RDC", { usage: "eclairage", rooms: "Séjour, cuisine, entrée, WC", points: 11, sectionMm2: 1.5 }),
    mcb(16, "Lumières étage", { usage: "eclairage", rooms: "Chambres, SdB, couloir", points: 6, sectionMm2: 1.5 }),
    mcb(20, "Prises séjour", { usage: "prises", rooms: "Séjour, entrée", points: 10, sectionMm2: 2.5 }),
    mcb(20, "Prises chambres", { usage: "prises", rooms: "Chambres 1 à 3, bureau", points: 14, sectionMm2: 2.5 }),
    mcb(20, "Prises cuisine", { usage: "prises", rooms: "Cuisine", points: 5, sectionMm2: 2.5 }),
    {
      id: newId(),
      kind: "fuse",
      brand: "Générique",
      modules: 1,
      rating: 32,
      poles: "1P+N",
      label: "Plaque de cuisson",
      condition: "usé",
      circuit: { usage: "plaque", rooms: "Cuisine", points: 1, sectionMm2: 6, powerW: 7000 },
    },
    mcb(20, "Lave-linge", { usage: "lave_linge", rooms: "Buanderie", points: 1, sectionMm2: 2.5 }),
    mcb(20, "Lave-vaisselle", { usage: "lave_vaisselle", rooms: "Cuisine", points: 1, sectionMm2: 1.5 }),
    mcb(20, "Four", { usage: "four", rooms: "Cuisine", points: 1, sectionMm2: 2.5 }),
    mcb(20, "Chauffe-eau", { usage: "chauffe_eau", rooms: "Buanderie", points: 1, sectionMm2: 2.5, powerW: 2400 }),
    { id: newId(), kind: "contactor", brand: "Legrand", modules: 1, rating: 20, label: "Contacteur HC", condition: "bon" },
  ];
  const row2: Device[] = [
    mcb(20, "Radiateurs séjour", { usage: "chauffage", rooms: "Séjour, cuisine", points: 3, sectionMm2: 2.5, powerW: 5000 }),
    mcb(16, "Radiateurs chambres", { usage: "chauffage", rooms: "Chambres", points: 3, sectionMm2: 1.5, powerW: 3000 }),
    mcb(10, "Volets roulants", { usage: "volets", rooms: "Toute la maison", points: 6, sectionMm2: 1.5 }, { poles: "1P", brand: "Générique" }),
    mcb(25, "Prises garage", { usage: "prises", rooms: "Garage, atelier", points: 4, sectionMm2: 2.5 }),
    mcb(20, "Congélateur", { usage: "congelateur", rooms: "Garage", points: 1 }),
  ];
  const row3: Device[] = [
    mcb(2, "VMC", { usage: "vmc", rooms: "Combles", points: 1, sectionMm2: 1.5 }),
  ];
  return {
    id: newId("p"),
    name: "Tableau existant",
    role: "existing",
    enclosure: { brand: "Legrand", rows: 3, modulesPerRow: 13, label: "Coffret 3 rangées 13 modules" },
    rows: [row1, row2, row3],
    controlHeightM: 1.6,
  };
}

export function emptyPanel(name: string, role: Panel["role"]): Panel {
  return {
    id: newId("p"),
    name,
    role,
    enclosure: { brand: "Schneider", rows: 3, modulesPerRow: 13 },
    rows: [[], [], []],
    controlHeightM: 1.6,
  };
}

export function sampleProject(): Project {
  const existing = samplePanel();
  return {
    version: 1,
    updatedAt: 0,
    house: defaultHouse(),
    panels: [existing],
    activePanelId: existing.id,
    sourcePanelId: existing.id,
    inventory: {},
    allowCrossBrandReuse: false,
    catalogOverrides: {},
    customCatalog: [],
    chat: [],
  };
}
