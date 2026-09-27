import {
  CONTROL_HEIGHT_MAX,
  CONTROL_HEIGHT_MIN,
  GOOD_EARTH_OHMS,
  MAX_CIRCUITS_PER_RCD,
  MAX_EARTH_OHMS,
  MIN_BREAKING_CAPACITY,
  RCD_TYPE_LABEL,
  RESERVE_RATIO,
  USAGES,
  expectedProtection,
  heatingMaxPower,
  isTypeAOrBetter,
  maxPointsFor,
  maxRatingForSection,
  mm2,
} from "./norm";
import {
  circuitsByRcd,
  deviceTitle,
  freeModules,
  isCircuitDevice,
  isHighSensitivity,
  locatedDevices,
  panelCapacity,
  protectionMap,
  rowModules,
} from "./panel";
import type { Device, Finding, House, Panel, Severity } from "./types";

export const SEVERITY_ORDER: Severity[] = ["danger", "nonconforme", "avertissement", "conseil"];

export const SEVERITY_LABEL: Record<Severity, string> = {
  danger: "Danger",
  nonconforme: "Non conforme",
  avertissement: "À vérifier",
  conseil: "Conseil",
};

/** Obligation de parafoudre au tableau (logement). */
export function surgeProtection(house: House): "obligatoire" | "recommande" | "facultatif" {
  if (house.lightningRod) return "obligatoire";
  if (house.aq2Zone && (house.overheadSupply || house.safetyEquipment)) return "obligatoire";
  if (house.aq2Zone || house.sensitiveEquipment || house.safetyEquipment) return "recommande";
  return "facultatif";
}

/** Intensité à retenir pour un différentiel selon la règle de l'aval. */
export function rcdLoad(circuits: Device[]): number {
  return circuits.reduce((sum, d) => {
    const usage = d.circuit?.usage;
    const full = usage ? USAGES[usage].fullLoad : false;
    return sum + (d.rating ?? 0) * (full ? 1 : 0.5);
  }, 0);
}

function label(d: Device): string {
  const where = d.circuit?.rooms ? ` (${d.circuit.rooms})` : "";
  const usage = d.circuit ? USAGES[d.circuit.usage].label : d.label || deviceTitle(d);
  return `${d.label || usage}${where}`;
}

export function analyzePanel(panel: Panel, house: House): Finding[] {
  const findings: Finding[] = [];
  const add = (f: Omit<Finding, "id">) =>
    findings.push({ ...f, id: `${panel.id}:${f.ruleId}:${f.deviceIds.join(",")}` });

  const devices = locatedDevices(panel).map((l) => l.device);
  const circuits = devices.filter(isCircuitDevice);
  const described = circuits.filter((d) => d.circuit);
  const protection = protectionMap(panel);
  const rcds = devices.filter((d) => d.kind === "rcd");
  const rcds30 = rcds.filter(isHighSensitivity);
  const isNew = panel.role === "new";

  // ---------- Appareils ----------
  for (const d of devices) {
    if (d.condition === "HS") {
      add({
        ruleId: "etat-hs",
        severity: "danger",
        title: `${label(d)} : appareil hors service`,
        detail: "L'appareil est déclaré hors service ou endommagé (traces de chauffe, boîtier cassé, ne réarme plus).",
        norm: "Aucun matériel vétuste, détérioré ou présentant un risque de contact direct ne doit rester en service (point de contrôle du diagnostic électrique obligatoire).",
        normRef: "NF C 15-100-1 · maintien en bon état",
        fix: "Remplacer l'appareil par un modèle neuf de mêmes caractéristiques, installation hors tension.",
        deviceIds: [d.id],
      });
    } else if (d.condition === "usé") {
      add({
        ruleId: "etat-use",
        severity: "avertissement",
        title: `${label(d)} : appareil usé`,
        detail: "L'appareil est déclaré usé ou d'aspect douteux.",
        norm: "Les matériels doivent être maintenus en bon état de fonctionnement.",
        normRef: "NF C 15-100-1 · maintien en bon état",
        fix: "Tester le fonctionnement (bouton test pour un différentiel) et prévoir son remplacement.",
        deviceIds: [d.id],
      });
    }

    if (d.kind === "fuse") {
      add({
        ruleId: "fusible",
        severity: "nonconforme",
        title: `${label(d)} : protection par fusible`,
        detail: isNew
          ? "Un coupe-circuit à fusible est prévu dans le nouveau tableau."
          : "Le circuit est protégé par un fusible. C'est toléré dans une installation ancienne si le calibre correspond à la section, mais pas conforme à la norme actuelle.",
        norm: "Tous les circuits sont protégés contre les surintensités par un disjoncteur ; les coupe-circuits à fusible sont interdits en neuf et en rénovation importante. Un disjoncteur par circuit, un circuit par disjoncteur.",
        normRef: "NF C 15-100-10 · protection des circuits",
        fix: `Remplacer le fusible par un disjoncteur phase + neutre${d.rating ? ` de ${Math.min(d.rating, d.circuit?.sectionMm2 ? maxRatingForSection(d.circuit.sectionMm2) : d.rating)} A` : ""} courbe C, pouvoir de coupure 3 kA minimum.`,
        deviceIds: [d.id],
      });
    }

    if ((d.kind === "mcb" || d.kind === "rcbo") && d.poles === "1P") {
      add({
        ruleId: "coupure-neutre",
        severity: "nonconforme",
        title: `${label(d)} : pas de coupure du neutre`,
        detail: "Disjoncteur unipolaire : seule la phase est coupée.",
        norm: "Les disjoncteurs divisionnaires des logements coupent la phase et le neutre (disjoncteurs phase + neutre).",
        normRef: "NF C 15-100-10 · protection des circuits",
        fix: "Remplacer par un disjoncteur phase + neutre (1P+N) du même calibre.",
        deviceIds: [d.id],
      });
    }

    if ((d.kind === "mcb" || d.kind === "rcbo") && d.breakingCapacity && d.breakingCapacity < MIN_BREAKING_CAPACITY) {
      add({
        ruleId: "pouvoir-coupure",
        severity: "nonconforme",
        title: `${label(d)} : pouvoir de coupure insuffisant`,
        detail: `Pouvoir de coupure déclaré : ${d.breakingCapacity} A.`,
        norm: "En logement, les disjoncteurs divisionnaires ont un pouvoir de coupure d'au moins 3 000 A (3 kA).",
        normRef: "NF C 15-100-10 · protection des circuits",
        fix: "Remplacer par un disjoncteur 3 kA, 4,5 kA ou 6 kA.",
        deviceIds: [d.id],
      });
    }

    if ((d.kind === "mcb" || d.kind === "rcbo") && d.curve === "D") {
      add({
        ruleId: "courbe-d",
        severity: "conseil",
        title: `${label(d)} : courbe D`,
        detail: "La courbe D est réservée aux moteurs à fort courant de démarrage.",
        norm: "Les circuits domestiques utilisent normalement la courbe C.",
        normRef: "NF C 15-100-1 · protection contre les surintensités",
        fix: "Vérifier le besoin, sinon passer en courbe C.",
        deviceIds: [d.id],
      });
    }

    if (d.kind === "rcd" && (d.sensitivity ?? 30) > 30) {
      add({
        ruleId: "rcd-sensibilite",
        severity: "nonconforme",
        title: `${deviceTitle(d)} : sensibilité insuffisante`,
        detail: `Différentiel ${d.sensitivity} mA en tableau divisionnaire : il ne protège pas les personnes contre les contacts directs.`,
        norm: "Tous les circuits d'un logement sont protégés par des interrupteurs différentiels haute sensibilité 30 mA.",
        normRef: "NF C 15-100-10 · protection des personnes",
        fix: "Remplacer par un interrupteur différentiel 30 mA (type AC ou A selon les circuits protégés).",
        deviceIds: [d.id],
      });
    }
  }

  // ---------- Départs ----------
  for (const d of circuits) {
    const guard = protection.get(d.id) ?? null;
    if (!guard || !isHighSensitivity(guard)) {
      add({
        ruleId: "sans-30ma",
        severity: "danger",
        title: `${label(d)} : pas de protection différentielle 30 mA`,
        detail: guard
          ? `Le circuit dépend de « ${deviceTitle(guard)} », qui n'est pas un 30 mA.`
          : "Aucun interrupteur différentiel 30 mA en amont de ce départ (ni dans la rangée, ni affecté manuellement).",
        norm: "Tous les circuits d'un logement sont protégés par un dispositif différentiel 30 mA : c'est la protection des personnes contre l'électrocution.",
        normRef: "NF C 15-100-10 · protection des personnes",
        fix: "Raccorder ce départ en aval d'un interrupteur différentiel 30 mA (dans la même rangée, via le peigne), ou utiliser un disjoncteur différentiel 30 mA.",
        deviceIds: [d.id],
      });
    }

    const c = d.circuit;
    if (!c) continue;
    const spec = USAGES[c.usage];
    const rating = d.rating ?? 0;

    if (c.sectionMm2 && rating > maxRatingForSection(c.sectionMm2)) {
      add({
        ruleId: "section-calibre",
        severity: "danger",
        title: `${label(d)} : câble trop fin pour le calibre`,
        detail: `Disjoncteur ${rating} A sur des fils de ${mm2(c.sectionMm2)} mm² (maximum ${maxRatingForSection(c.sectionMm2)} A). Le câble peut chauffer sans que le disjoncteur ne coupe.`,
        norm: "Le calibre du disjoncteur est adapté à la section : 1,5 mm² → 16 A max, 2,5 mm² → 20 A, 4 mm² → 25 A, 6 mm² → 32 A.",
        normRef: "NF C 15-100-10 · protection des circuits",
        fix: `Descendre le disjoncteur à ${maxRatingForSection(c.sectionMm2)} A (en vérifiant l'usage) ou recâbler le circuit en ${mm2(expectedProtection(c.usage, c.powerW, undefined).section)} mm².`,
        deviceIds: [d.id],
      });
    }

    if (spec.allowed && !spec.powerBased && rating && !spec.allowed.some((a) => a.rating === rating)) {
      const exp = expectedProtection(c.usage, c.powerW, c.sectionMm2);
      add({
        ruleId: "calibre-usage",
        severity: "nonconforme",
        title: `${label(d)} : calibre ${rating} A inadapté`,
        detail: `Un circuit « ${spec.label} » ne doit pas être protégé en ${rating} A.`,
        norm: spec.normText,
        normRef: spec.normRef,
        fix: `Utiliser un disjoncteur ${exp.rating} A avec des fils de ${mm2(exp.section)} mm².`,
        deviceIds: [d.id],
      });
    }

    const maxPoints = maxPointsFor(c.usage, rating || undefined);
    if (maxPoints !== undefined && c.points > maxPoints) {
      const split = Math.ceil(c.points / maxPoints);
      add({
        ruleId: "points-max",
        severity: "nonconforme",
        title: `${label(d)} : ${c.points} ${spec.pointsLabel} sur un seul circuit`,
        detail: `Maximum ${maxPoints} ${spec.pointsLabel} pour ce circuit${rating ? ` en ${rating} A` : ""}.`,
        norm: spec.normText,
        normRef: spec.normRef,
        fix: spec.dedicated
          ? "Créer un circuit spécialisé par appareil."
          : `Répartir sur ${split} circuits (ajouter ${split - 1} disjoncteur${split > 2 ? "s" : ""}).`,
        deviceIds: [d.id],
      });
    }

    if (c.usage === "chauffage") {
      if (!c.powerW) {
        add({
          ruleId: "chauffage-puissance",
          severity: "avertissement",
          title: `${label(d)} : puissance du chauffage non renseignée`,
          detail: "Impossible de vérifier le calibre sans la puissance totale des radiateurs du circuit.",
          norm: spec.normText,
          normRef: spec.normRef,
          fix: "Renseigner la puissance totale (somme des radiateurs) dans le détail du circuit.",
          deviceIds: [d.id],
        });
      } else if (c.powerW > heatingMaxPower(rating)) {
        const exp = expectedProtection("chauffage", c.powerW);
        add({
          ruleId: "chauffage-surcharge",
          severity: "nonconforme",
          title: `${label(d)} : ${c.powerW} W de chauffage en ${rating} A`,
          detail: `Un circuit ${rating} A accepte ${heatingMaxPower(rating)} W de chauffage au maximum.`,
          norm: spec.normText,
          normRef: spec.normRef,
          fix:
            c.powerW > 7250
              ? `Répartir les radiateurs sur ${Math.ceil(c.powerW / 4500)} circuits de 20 A en 2,5 mm².`
              : `Passer en ${exp.rating} A avec des fils de ${mm2(exp.section)} mm², ou répartir sur ${Math.ceil(c.powerW / 4500)} circuits 20 A.`,
          deviceIds: [d.id],
        });
      }
    } else if (c.powerW && rating && c.powerW / 230 > rating) {
      const exp = expectedProtection(c.usage, c.powerW);
      add({
        ruleId: "surcharge",
        severity: "nonconforme",
        title: `${label(d)} : puissance trop élevée pour ${rating} A`,
        detail: `${c.powerW} W représentent ${(c.powerW / 230).toFixed(1)} A.`,
        norm: spec.normText,
        normRef: spec.normRef,
        fix: `Prévoir un disjoncteur ${exp.rating} A avec des fils de ${mm2(exp.section)} mm².`,
        deviceIds: [d.id],
      });
    }

    if (spec.rcdRequired && guard && !spec.rcdRequired.includes(guard.rcdType ?? "AC")) {
      add({
        ruleId: "rcd-type",
        severity: "nonconforme",
        title: `${label(d)} : différentiel de ${RCD_TYPE_LABEL[guard.rcdType ?? "AC"]}`,
        detail: `Ce circuit est protégé par un différentiel de ${RCD_TYPE_LABEL[guard.rcdType ?? "AC"]}.`,
        norm: spec.normText,
        normRef: spec.normRef,
        fix: `Déplacer ce départ sous un différentiel ${spec.rcdRequired.includes("A") ? "de type A ou F" : "adapté"} 30 mA.`,
        deviceIds: [d.id, guard.id],
      });
    } else if (spec.rcdAdvised && guard && !spec.rcdAdvised.includes(guard.rcdType ?? "AC")) {
      add({
        ruleId: "rcd-type-conseil",
        severity: "conseil",
        title: `${label(d)} : type de différentiel à améliorer`,
        detail: `Protégé par un ${RCD_TYPE_LABEL[guard.rcdType ?? "AC"]}.`,
        norm: spec.normText,
        normRef: spec.normRef,
        fix: `Placer ce circuit sous un différentiel ${spec.rcdAdvised.map((t) => RCD_TYPE_LABEL[t]).join(" ou ")}.`,
        deviceIds: [d.id],
      });
    }

    if ((c.usage === "irve_prise" || c.usage === "irve_borne") && guard?.kind === "rcd") {
      add({
        ruleId: "irve-dedie",
        severity: "nonconforme",
        title: `${label(d)} : point de recharge sans protection individuelle`,
        detail: "Le point de recharge partage un interrupteur différentiel avec d'autres circuits.",
        norm: USAGES[c.usage].normText + " Chaque point de recharge est protégé individuellement par son propre dispositif différentiel 30 mA.",
        normRef: USAGES[c.usage].normRef,
        fix: `Remplacer le disjoncteur par un disjoncteur différentiel 30 mA ${c.usage === "irve_prise" ? "type F 20 A" : "type A"} dédié.`,
        deviceIds: [d.id],
      });
    }

    if (c.usage === "irve_borne") {
      add({
        ruleId: "irve-6ma",
        severity: "avertissement",
        title: `${label(d)} : détection des fuites continues 6 mA`,
        detail: "Le simulateur ne sait pas si la borne intègre la détection 6 mA DC.",
        norm: USAGES.irve_borne.normText,
        normRef: USAGES.irve_borne.normRef,
        fix: "Vérifier sur la notice que la borne intègre un dispositif de détection 6 mA DC (RDC-DD), sinon utiliser un différentiel type B.",
        deviceIds: [d.id],
      });
    }
  }

  const unknownSection = described.filter((d) => !d.circuit?.sectionMm2);
  if (unknownSection.length) {
    add({
      ruleId: "section-inconnue",
      severity: "avertissement",
      title: `Section des fils inconnue sur ${unknownSection.length} circuit${unknownSection.length > 1 ? "s" : ""}`,
      detail: unknownSection.map(label).join(", "),
      norm: "Le calibre de chaque disjoncteur dépend de la section des conducteurs qu'il protège.",
      normRef: "NF C 15-100-10 · protection des circuits",
      fix: "Relever la section (marquée sur la gaine ou mesurée : 1,5 mm² ≈ Ø 1,4 mm ; 2,5 mm² ≈ Ø 1,8 mm ; 6 mm² ≈ Ø 2,8 mm) et la renseigner.",
      deviceIds: unknownSection.map((d) => d.id),
    });
  }

  const undescribed = circuits.filter((d) => !d.circuit);
  if (undescribed.length) {
    add({
      ruleId: "circuit-non-decrit",
      severity: "conseil",
      title: `${undescribed.length} départ${undescribed.length > 1 ? "s" : ""} sans description`,
      detail: "Ce qui est branché sur ces protections n'est pas renseigné : les règles de calibre et de répartition ne peuvent pas être vérifiées.",
      norm: "L'installateur fournit un schéma avec le repérage de chaque circuit.",
      normRef: "NF C 15-100-10 · repérage des circuits",
      fix: "Sélectionner chaque départ et décrire son usage, les pièces desservies, le nombre de points et la section.",
      deviceIds: undescribed.map((d) => d.id),
    });
  }

  // ---------- Différentiels ----------
  if (circuits.length > 0) {
    if (rcds30.length < 2) {
      add({
        ruleId: "rcd-min",
        severity: "nonconforme",
        title: `${rcds30.length} interrupteur différentiel 30 mA seulement`,
        detail: "Le logement doit disposer d'au moins deux interrupteurs différentiels 30 mA.",
        norm: "Au moins 2 interrupteurs différentiels 30 mA par logement, dont au minimum 1 de type A ; 8 circuits maximum par différentiel.",
        normRef: "NF C 15-100-10 · protection des personnes",
        fix: "Ajouter des interrupteurs différentiels 30 mA et répartir les circuits (un par rangée est la disposition la plus lisible).",
        deviceIds: rcds30.map((d) => d.id),
      });
    }
    if (!rcds30.some((d) => isTypeAOrBetter(d.rcdType))) {
      add({
        ruleId: "rcd-type-a",
        severity: "nonconforme",
        title: "Aucun interrupteur différentiel de type A",
        detail: "Aucun différentiel 30 mA de type A (ou F) n'est présent.",
        norm: "Au moins un interrupteur différentiel 30 mA de type A par logement ; il protège obligatoirement la plaque de cuisson et le lave-linge (et la prise de recharge VE si elle n'a pas son propre disjoncteur différentiel).",
        normRef: "NF C 15-100-10 · protection des personnes",
        fix: "Installer un interrupteur différentiel 40 A 30 mA type A et y raccorder plaque de cuisson et lave-linge.",
        deviceIds: [],
      });
    }
  }

  const groups = circuitsByRcd(panel);
  for (const rcd of rcds) {
    const list = groups.get(rcd.id) ?? [];
    if (list.length > MAX_CIRCUITS_PER_RCD) {
      add({
        ruleId: "rcd-8-circuits",
        severity: "nonconforme",
        title: `${deviceTitle(rcd)} : ${list.length} circuits protégés`,
        detail: `Un interrupteur différentiel protège ici ${list.length} circuits.`,
        norm: "8 circuits maximum par interrupteur différentiel.",
        normRef: "NF C 15-100-10 · protection des personnes",
        fix: `Ajouter ${Math.ceil(list.length / MAX_CIRCUITS_PER_RCD) - 1} interrupteur différentiel et y déplacer une partie des circuits.`,
        deviceIds: [rcd.id],
      });
    }
    const load = rcdLoad(list);
    if (rcd.rating && load > rcd.rating && rcd.rating < house.agcpRating) {
      add({
        ruleId: "rcd-calibre",
        severity: "nonconforme",
        title: `${deviceTitle(rcd)} : calibre insuffisant`,
        detail: `Charge calculée : ${load.toFixed(0)} A (chauffage et chauffe-eau comptés à 100 %, autres circuits à 50 %), pour un différentiel de ${rcd.rating} A.`,
        norm: "Le calibre de l'interrupteur différentiel est au moins égal au calibre du disjoncteur de branchement (règle de l'amont) ou à la somme des disjoncteurs chauffage/chauffe-eau + 0,5 × la somme des autres disjoncteurs qu'il protège (règle de l'aval).",
        normRef: "NF C 15-100-10 · calcul de l'intensité",
        fix: (() => {
          const target = suitableRcdRating(load, house.agcpRating);
          return target
            ? `Choisir un différentiel de ${target} A${target >= house.agcpRating ? ` (au moins égal au disjoncteur de branchement de ${house.agcpRating} A)` : ""}, ou répartir les circuits lourds sur un autre différentiel.`
            : "Répartir une partie des circuits (en priorité chauffage et chauffe-eau) sur un autre différentiel.";
        })(),
        deviceIds: [rcd.id],
      });
    }
  }

  // Continuité de service : lumières et prises réparties sur au moins 2 différentiels.
  const protectedGroup = (group: "eclairage" | "prises") => {
    const members = described.filter((d) => USAGES[d.circuit!.usage].group === group);
    const rcdIds = new Set(members.map((d) => protection.get(d.id)?.id).filter(Boolean));
    return { members, rcdIds };
  };
  for (const group of ["eclairage", "prises"] as const) {
    const { members, rcdIds } = protectedGroup(group);
    if (members.length >= 2 && rcdIds.size < 2) {
      add({
        ruleId: `repartition-${group}`,
        severity: "nonconforme",
        title: `Tous les circuits ${group === "eclairage" ? "d'éclairage" : "de prises"} sous le même différentiel`,
        detail: "Un seul défaut plongerait tout le logement dans le noir ou sans prises.",
        norm: "Les circuits d'éclairage et de prises de courant sont répartis sous au moins 2 interrupteurs différentiels pour assurer la continuité de fonctionnement.",
        normRef: "NF C 15-100-10 · protection des personnes",
        fix: `Déplacer au moins un circuit ${group === "eclairage" ? "d'éclairage" : "de prises"} sous un autre différentiel.`,
        deviceIds: members.map((d) => d.id),
      });
    }
  }

  const heavyByRcd = rcds30.map((r) => ({
    rcd: r,
    heavy: (groups.get(r.id) ?? []).filter((d) => d.circuit && USAGES[d.circuit.usage].heavy).length,
  }));
  if (heavyByRcd.length >= 2) {
    const max = Math.max(...heavyByRcd.map((h) => h.heavy));
    const min = Math.min(...heavyByRcd.map((h) => h.heavy));
    if (max >= 3 && min === 0) {
      const worst = heavyByRcd.find((h) => h.heavy === max)!;
      add({
        ruleId: "equilibrage",
        severity: "conseil",
        title: "Circuits à forte consommation mal répartis",
        detail: `${max} circuits gourmands sous « ${deviceTitle(worst.rcd)} » alors qu'un autre différentiel n'en a aucun.`,
        norm: "Il est recommandé de répartir les circuits à forte consommation sur des différentiels différents.",
        normRef: "NF C 15-100-10 · répartition des circuits",
        fix: "Déplacer un ou deux circuits lourds (four, chauffe-eau, radiateurs…) vers le différentiel le moins chargé.",
        deviceIds: [worst.rcd.id],
      });
    }
  }

  // ---------- Nombre et nature des circuits ----------
  const countUsage = (pred: (d: Device) => boolean) => described.filter(pred).length;
  const lighting = countUsage((d) => d.circuit!.usage === "eclairage");
  if (circuits.length > 0 && lighting < (house.mainRooms <= 1 ? 1 : 2)) {
    add({
      ruleId: "eclairage-min",
      severity: "nonconforme",
      title: `${lighting} circuit${lighting > 1 ? "s" : ""} d'éclairage`,
      detail: "Le logement doit avoir au moins 2 circuits d'éclairage.",
      norm: USAGES.eclairage.normText,
      normRef: USAGES.eclairage.normRef,
      fix: "Séparer l'éclairage en au moins 2 circuits (par exemple jour / nuit), idéalement sous 2 différentiels.",
      deviceIds: [],
    });
  }

  const specialized = countUsage((d) => !!USAGES[d.circuit!.usage].specialized);
  if (circuits.length > 0 && specialized < 3) {
    add({
      ruleId: "specialises-min",
      severity: "nonconforme",
      title: `${specialized} circuit${specialized > 1 ? "s" : ""} spécialisé${specialized > 1 ? "s" : ""} 20 A`,
      detail: "Moins de 3 circuits spécialisés (lave-linge, lave-vaisselle, sèche-linge, four, chauffe-eau, congélateur…).",
      norm: "Au moins 3 circuits spécialisés 20 A en 2,5 mm² par logement, un appareil par circuit.",
      normRef: "NF C 15-100-10 · circuits spécialisés",
      fix: "Créer des circuits dédiés pour le lave-linge, le lave-vaisselle et le four (ou sèche-linge / congélateur).",
      deviceIds: [],
    });
  }

  if (circuits.length > 0 && !described.some((d) => d.circuit!.usage === "plaque")) {
    add({
      ruleId: "cuisson",
      severity: "avertissement",
      title: "Pas de circuit cuisson 32 A",
      detail: "Aucun circuit plaque de cuisson / cuisinière n'est déclaré.",
      norm: USAGES.plaque.normText + " Ce circuit est prévu dans tout logement neuf ou entièrement rénové.",
      normRef: USAGES.plaque.normRef,
      fix: "Prévoir un disjoncteur 32 A en 6 mm² sous le différentiel de type A, avec une sortie de câble dans la cuisine.",
      deviceIds: [],
    });
  }

  if (house.hasKitchenOver4m2 && circuits.length > 0 && !described.some((d) => d.circuit!.usage === "prises_cuisine")) {
    add({
      ruleId: "prises-cuisine",
      severity: "nonconforme",
      title: "Pas de circuit dédié aux prises de la cuisine",
      detail: "La cuisine de plus de 4 m² n'a pas son circuit de prises dédié.",
      norm: USAGES.prises_cuisine.normText,
      normRef: USAGES.prises_cuisine.normRef,
      fix: "Créer un circuit 20 A en 2,5 mm² de 6 prises maximum pour le plan de travail.",
      deviceIds: [],
    });
  }

  if (house.electricHeating && !described.some((d) => d.circuit!.usage === "chauffage" || d.circuit!.usage === "pac_clim")) {
    add({
      ruleId: "chauffage-absent",
      severity: "avertissement",
      title: "Chauffage électrique déclaré mais aucun circuit chauffage",
      detail: "La maison est déclarée chauffée à l'électricité.",
      norm: USAGES.chauffage.normText,
      normRef: USAGES.chauffage.normRef,
      fix: "Déclarer les circuits de radiateurs (puissance totale par circuit).",
      deviceIds: [],
    });
  }

  const waterHeater = described.find((d) => d.circuit!.usage === "chauffe_eau");
  if (waterHeater && house.offPeak && !devices.some((d) => d.kind === "contactor")) {
    add({
      ruleId: "contacteur-hc",
      severity: "conseil",
      title: "Chauffe-eau sans contacteur heures creuses",
      detail: "L'abonnement heures creuses est déclaré mais aucun contacteur ne pilote le chauffe-eau.",
      norm: USAGES.chauffe_eau.normText,
      normRef: USAGES.chauffe_eau.normRef,
      fix: "Ajouter un contacteur jour/nuit 20 A à côté du disjoncteur du chauffe-eau, piloté par le compteur.",
      deviceIds: [waterHeater.id],
    });
  }

  for (const d of described.filter((x) => x.circuit!.usage === "volets" && x.circuit!.points >= 4)) {
    if (described.filter((x) => x.circuit!.usage === "volets").length === 1) {
      add({
        ruleId: "volets-2-circuits",
        severity: "conseil",
        title: "Tous les volets roulants sur un seul circuit",
        detail: `${d.circuit!.points} moteurs sur le même disjoncteur : un défaut bloque tous les volets.`,
        norm: USAGES.volets.normText,
        normRef: USAGES.volets.normRef,
        fix: "Répartir les moteurs sur 2 circuits.",
        deviceIds: [d.id],
      });
    }
  }

  // ---------- Coffret ----------
  const capacity = panelCapacity(panel);
  const overflowRows = panel.rows
    .map((row, i) => ({ i, used: rowModules(row) }))
    .filter((r) => r.used > panel.enclosure.modulesPerRow);
  if (overflowRows.length || panel.rows.length > panel.enclosure.rows) {
    add({
      ruleId: "coffret-plein",
      severity: "nonconforme",
      title: "Le coffret est trop petit",
      detail: overflowRows.length
        ? `Rangée${overflowRows.length > 1 ? "s" : ""} ${overflowRows.map((r) => r.i + 1).join(", ")} : plus de ${panel.enclosure.modulesPerRow} modules.`
        : `${panel.rows.length} rangées utilisées pour un coffret de ${panel.enclosure.rows}.`,
      norm: "Les appareils doivent tenir physiquement sur les rails du coffret.",
      normRef: "NF C 15-100-10 · tableau de répartition",
      fix: "Choisir un coffret plus grand (rangée supplémentaire ou 18 modules) ou redistribuer les appareils.",
      deviceIds: [],
    });
  }
  const free = freeModules(panel);
  if (capacity > 0 && free / capacity < RESERVE_RATIO) {
    const needed = Math.ceil((usedModulesOf(panel) / (1 - RESERVE_RATIO)));
    add({
      ruleId: "reserve",
      severity: "nonconforme",
      title: `Réserve de ${Math.max(0, Math.round((free / capacity) * 100))} % seulement`,
      detail: `${Math.max(free, 0)} module${free > 1 ? "s" : ""} libre${free > 1 ? "s" : ""} sur ${capacity}.`,
      norm: "Logement individuel : le tableau garde au moins 20 % d'emplacements disponibles, de préférence en bout de rangées.",
      normRef: "NF C 15-100-10 · réserve au tableau",
      fix: `Prévoir un coffret d'au moins ${needed} modules au total (par exemple ${Math.ceil(needed / 13)} rangées de 13 ou ${Math.ceil(needed / 18)} rangées de 18).`,
      deviceIds: [],
    });
  }

  const spd = surgeProtection(house);
  const hasSpd = devices.some((d) => d.kind === "spd");
  if (!hasSpd && spd !== "facultatif") {
    add({
      ruleId: "parafoudre",
      severity: spd === "obligatoire" ? "nonconforme" : "conseil",
      title: spd === "obligatoire" ? "Parafoudre obligatoire absent" : "Parafoudre recommandé",
      detail:
        spd === "obligatoire"
          ? "Votre situation (paratonnerre, ou zone AQ2 avec alimentation aérienne ou équipement de sécurité des personnes) impose un parafoudre."
          : "Zone orageuse ou équipements sensibles déclarés.",
      norm: "Parafoudre au tableau obligatoire : bâtiment équipé d'un paratonnerre ou à moins de 50 m d'un bâtiment qui en a un ; en zone AQ2 (Nk > 25) si l'alimentation est aérienne ou si le logement comporte des équipements pour la sécurité des personnes. Recommandé dans les autres cas selon l'analyse de risque. Si un parafoudre équipe le tableau, le réseau de communication cuivre en reçoit aussi un.",
      normRef: "NF C 15-100-1 / 10 · protection contre la foudre",
      fix: "Installer un parafoudre type 2 phase + neutre (avec sa protection de déconnexion) en tête du tableau, relié à la barrette de terre par le chemin le plus court.",
      deviceIds: [],
    });
  }

  if (panel.controlHeightM !== undefined && (panel.controlHeightM < CONTROL_HEIGHT_MIN || panel.controlHeightM > CONTROL_HEIGHT_MAX)) {
    add({
      ruleId: "hauteur",
      severity: "nonconforme",
      title: `Manettes à ${panel.controlHeightM.toFixed(2)} m du sol`,
      detail: "La hauteur des organes de manœuvre est hors plage.",
      norm: "Les manettes des disjoncteurs du tableau sont situées entre 0,90 m et 1,80 m du sol fini (0,50 m minimum pour un coffret avec porte).",
      normRef: "NF C 15-100-10 · gaine technique logement",
      fix: "Déplacer le coffret dans la GTL pour ramener les manettes entre 0,90 m et 1,80 m.",
      deviceIds: [],
    });
  }

  // ---------- Maison ----------
  if (house.earthOhms === undefined) {
    add({
      ruleId: "terre-inconnue",
      severity: "avertissement",
      title: "Résistance de la prise de terre inconnue",
      detail: "Aucune mesure de terre n'est renseignée.",
      norm: "Toutes les masses et prises sont reliées à la terre. Avec un disjoncteur de branchement 500 mA, la résistance de terre ne doit pas dépasser 100 Ω (moins de 50 Ω est une bonne valeur).",
      normRef: "NF C 15-100-1 · mise à la terre",
      fix: "Faire mesurer la terre (telluromètre ou contrôleur de boucle) et renseigner la valeur dans « Ma maison ».",
      deviceIds: [],
    });
  } else if (house.earthOhms > MAX_EARTH_OHMS) {
    add({
      ruleId: "terre",
      severity: "danger",
      title: `Prise de terre de ${house.earthOhms} Ω`,
      detail: "La résistance de terre est trop élevée pour le disjoncteur de branchement.",
      norm: "Avec un disjoncteur de branchement 500 mA, la résistance de terre ne doit pas dépasser 100 Ω.",
      normRef: "NF C 15-100-1 · mise à la terre",
      fix: "Améliorer la prise de terre (piquet supplémentaire, boucle en fond de fouille, câble cuivre nu 25 mm²) puis mesurer à nouveau.",
      deviceIds: [],
    });
  } else if (house.earthOhms > GOOD_EARTH_OHMS) {
    add({
      ruleId: "terre-moyenne",
      severity: "conseil",
      title: `Prise de terre de ${house.earthOhms} Ω`,
      detail: "Valeur acceptable mais perfectible.",
      norm: "Moins de 50 Ω est une bonne valeur de terre.",
      normRef: "NF C 15-100-1 · mise à la terre",
      fix: "Surveiller la valeur (elle varie avec l'humidité du sol) ; un piquet supplémentaire peut l'améliorer.",
      deviceIds: [],
    });
  }

  if (isNew) {
    const brands = new Set(devices.map((d) => d.brand).filter((b) => b && b !== "Générique"));
    if (brands.size > 1 || (brands.size === 1 && !brands.has(panel.enclosure.brand) && panel.enclosure.brand !== "Générique")) {
      add({
        ruleId: "marques",
        severity: "conseil",
        title: "Plusieurs marques dans le même tableau",
        detail: `Marques présentes : ${[...brands, panel.enclosure.brand].filter((v, i, a) => a.indexOf(v) === i).join(", ")}.`,
        norm: "Rien n'interdit le mélange, mais les peignes d'alimentation et les obturateurs sont propres à chaque gamme.",
        normRef: "Bonne pratique",
        fix: "Vérifier la compatibilité des peignes, ou harmoniser la marque des appareils.",
        deviceIds: [],
      });
    }
  }

  return findings.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

function usedModulesOf(panel: Panel): number {
  return panelCapacity(panel) - freeModules(panel);
}

export interface Verdict {
  status: "conforme" | "a-corriger" | "dangereux";
  counts: Record<Severity, number>;
}

export function verdict(findings: Finding[]): Verdict {
  const counts: Record<Severity, number> = { danger: 0, nonconforme: 0, avertissement: 0, conseil: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return {
    status: counts.danger ? "dangereux" : counts.nonconforme ? "a-corriger" : "conforme",
    counts,
  };
}

export function findingsForDevice(findings: Finding[], id: string): Finding[] {
  return findings.filter((f) => f.deviceIds.includes(id));
}

export function worstSeverity(findings: Finding[]): Severity | undefined {
  return SEVERITY_ORDER.find((s) => findings.some((f) => f.severity === s));
}

export interface RcdLoadReport {
  circuits: number;
  rawSum: number;
  load: number;
  rating?: number;
  agcp: number;
  status: "amont" | "aval" | "insuffisant";
}

/** Détail du dimensionnement d'un interrupteur différentiel (règles de l'amont et de l'aval). */
export function rcdLoadReport(panel: Panel, rcd: Device, house: House): RcdLoadReport {
  const list = circuitsByRcd(panel).get(rcd.id) ?? [];
  const load = rcdLoad(list);
  const rating = rcd.rating;
  const status = rating && rating >= house.agcpRating ? "amont" : rating && load <= rating ? "aval" : "insuffisant";
  return {
    circuits: list.length,
    rawSum: list.reduce((s, d) => s + (d.rating ?? 0), 0),
    load,
    rating,
    agcp: house.agcpRating,
    status,
  };
}

/** Plus petit calibre d'interrupteur différentiel conforme (règle de l'amont ou de l'aval). */
export function suitableRcdRating(load: number, agcpRating: number): number | undefined {
  return [25, 40, 63].find((r) => r >= agcpRating || r >= load);
}

export interface RowSummaryLine {
  label: string;
  rating: number;
  count: number;
  rawSum: number;
  load: number;
}

export interface RowSummary {
  row: number;
  circuits: number;
  rawSum: number;
  load: number;
  lines: RowSummaryLine[];
  rcds: { device: Device; report: RcdLoadReport }[];
}

/** Totaux d'une rangée, détaillés par type de circuit et calibre, pour aider à répartir. */
export function rowSummaries(panel: Panel, house: House): RowSummary[] {
  return panel.rows.map((row, r) => {
    const circuits = row.filter(isCircuitDevice);
    const lines = new Map<string, RowSummaryLine>();
    for (const d of circuits) {
      const rating = d.rating ?? 0;
      const label = d.circuit ? USAGES[d.circuit.usage].label : "Non décrit";
      const key = `${label}|${rating}`;
      const line = lines.get(key) ?? { label, rating, count: 0, rawSum: 0, load: 0 };
      line.count += 1;
      line.rawSum += rating;
      line.load += rcdLoad([d]);
      lines.set(key, line);
    }
    const sorted = [...lines.values()].sort((a, b) => b.rawSum - a.rawSum || a.label.localeCompare(b.label, "fr"));
    return {
      row: r,
      circuits: circuits.length,
      rawSum: sorted.reduce((s, l) => s + l.rawSum, 0),
      load: sorted.reduce((s, l) => s + l.load, 0),
      lines: sorted,
      rcds: row.filter((d) => d.kind === "rcd").map((d) => ({ device: d, report: rcdLoadReport(panel, d, house) })),
    };
  });
}
