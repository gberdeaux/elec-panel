import { SEVERITY_LABEL, analyzePanel, surgeProtection } from "../domain/analysis";
import { bomTotals, computeBom } from "../domain/bom";
import { USAGES, mm2 } from "../domain/norm";
import { deviceTitle, protectionMap } from "../domain/panel";
import type { Device, Panel, Project } from "../domain/types";

export const SYSTEM_PROMPT = `Tu es un électricien expérimenté et pédagogue, spécialiste de la norme française NF C 15-100 (révision du 23 août 2024, applicable depuis le 23 août 2025) pour les logements monophasés.
Tu aides un particulier à comprendre son tableau électrique existant, à savoir ce qui est conforme ou non, et à concevoir un nouveau tableau conforme.

Règles de réponse :
- Réponds en français, de façon claire et concrète, sans jargon inutile. Utilise des listes courtes et du gras pour les points clés.
- Appuie-toi sur les données du projet fournies ci-dessous (tableaux, circuits, constats du moteur de règles). Cite l'appareil ou le circuit concerné par son nom.
- Quand tu cites la norme, indique la règle chiffrée (calibre, section, nombre de points…) et la partie concernée (ex. NF C 15-100-10).
- Si une information manque (section des fils, puissance, état), dis-le et explique comment la relever.
- Distingue ce qui est dangereux, ce qui est non conforme et ce qui relève du conseil.
- Rappelle quand c'est utile que toute intervention au tableau se fait hors tension (disjoncteur de branchement coupé, absence de tension vérifiée) et qu'une rénovation complète se termine par une attestation de conformité Consuel. Recommande un électricien qualifié pour les points dangereux ou si l'utilisateur n'est pas sûr de lui.
- N'invente pas de références commerciales : si tu en proposes, précise qu'elles sont à vérifier.`;

function circuitLine(d: Device, guard: Device | null | undefined): string {
  const parts = [`${deviceTitle(d)}${d.curve ? ` courbe ${d.curve}` : ""}${d.poles ? ` ${d.poles}` : ""}`];
  if (d.label) parts.push(`« ${d.label} »`);
  if (d.brand) parts.push(d.brand);
  if (d.condition && d.condition !== "bon") parts.push(`état : ${d.condition}`);
  if (d.circuit) {
    const c = d.circuit;
    const spec = USAGES[c.usage];
    parts.push(
      `usage ${spec.label}`,
      c.rooms ? `pièces : ${c.rooms}` : "",
      `${c.points} ${spec.pointsLabel}`,
      c.powerW ? `${c.powerW} W` : "",
      c.sectionMm2 ? `${mm2(c.sectionMm2)} mm²` : "section inconnue",
      c.description ?? "",
    );
  } else if (d.kind === "mcb" || d.kind === "fuse" || d.kind === "rcbo") {
    parts.push("circuit non décrit");
  }
  if (guard !== undefined && d.kind !== "rcd") {
    parts.push(guard ? `protégé par ${deviceTitle(guard)}` : "sans différentiel 30 mA en amont");
  }
  return parts.filter(Boolean).join(", ");
}

export function describePanel(panel: Panel, project: Project): string {
  const guards = protectionMap(panel);
  const lines = [
    `## ${panel.name} (${panel.role === "existing" ? "tableau existant" : "nouveau tableau"})`,
    `Coffret ${panel.enclosure.brand} ${panel.enclosure.rows} rangée(s) de ${panel.enclosure.modulesPerRow} modules${panel.controlHeightM ? `, manettes à ${panel.controlHeightM} m du sol` : ""}.`,
  ];
  panel.rows.forEach((row, i) => {
    lines.push(`Rangée ${i + 1} :${row.length ? "" : " vide"}`);
    for (const d of row) lines.push(`- ${circuitLine(d, guards.get(d.id))}`);
  });
  const findings = analyzePanel(panel, project.house);
  lines.push(`Constats du moteur de règles (${findings.length}) :`);
  for (const f of findings) lines.push(`- [${SEVERITY_LABEL[f.severity]}] ${f.title} — ${f.detail}`);
  if (panel.notes?.length) {
    lines.push("Travaux prévus par la génération automatique :");
    for (const n of panel.notes) lines.push(`- ${n}`);
  }
  return lines.join("\n");
}

export function projectContext(project: Project): string {
  const h = project.house;
  const lines = [
    "# Données du projet",
    `Logement : ${h.name}, ${h.surfaceM2} m², ${h.mainRooms} pièces principales, installation monophasée, abonnement ${h.subscriptionKva} kVA, disjoncteur de branchement ${h.agcpRating} A ${h.agcpSensitivity} mA.`,
    `Terre : ${h.earthOhms !== undefined ? `${h.earthOhms} Ω` : "non mesurée"}. Heures creuses : ${h.offPeak ? "oui" : "non"}. Chauffage électrique : ${h.electricHeating ? "oui" : "non"}. Cuisine > 4 m² : ${h.hasKitchenOver4m2 ? "oui" : "non"}.`,
    `Foudre : zone AQ2 ${h.aq2Zone ? "oui" : "non"}, alimentation aérienne ${h.overheadSupply ? "oui" : "non"}, paratonnerre ${h.lightningRod ? "oui" : "non"}, équipement de sécurité des personnes ${h.safetyEquipment ? "oui" : "non"} → parafoudre ${surgeProtection(h)}.`,
    "",
  ];
  for (const panel of project.panels) lines.push(describePanel(panel, project), "");
  const target = project.panels.find((p) => p.id === project.targetPanelId);
  const source = project.panels.find((p) => p.id === project.sourcePanelId);
  if (target) {
    const bom = computeBom(project, target, source);
    const t = bomTotals(bom);
    lines.push(
      `## Matériel pour « ${target.name} »`,
      `${t.items} articles nécessaires, ${t.reused} réemployés, ${t.toBuy} à acheter, budget indicatif ${t.cost.toFixed(0)} €.`,
      ...bom.map((l) => `- ${l.label}${l.brand ? ` (${l.brand})` : ""} : besoin ${l.needed}, possédé ${l.owned}, à acheter ${l.toBuy}`),
    );
  }
  return lines.join("\n").slice(0, 45000);
}

export const QUICK_PROMPTS: { label: string; prompt: string }[] = [
  {
    label: "Diagnostic de l'existant",
    prompt:
      "Fais le diagnostic de mon tableau existant : classe les problèmes par gravité, explique simplement pourquoi chacun pose problème et ce que dit la norme, puis dis-moi par quoi commencer.",
  },
  {
    label: "Vérifier le nouveau tableau",
    prompt:
      "Vérifie mon nouveau tableau : est-il conforme ? Y a-t-il des améliorations à faire (répartition des circuits, équilibrage, réserve, parafoudre) ?",
  },
  {
    label: "Plan de travaux",
    prompt:
      "Donne-moi un plan de travaux étape par étape pour passer de mon tableau existant au nouveau tableau, en commençant par la sécurité, avec les points où je devrais faire appel à un électricien.",
  },
  {
    label: "Liste d'achat",
    prompt:
      "À partir de la liste de matériel, vérifie qu'il ne manque rien pour poser le nouveau tableau (câbles, peignes, bornes, étiquettes, fils de liaison) et donne-moi une liste d'achat complète.",
  },
];
