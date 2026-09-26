import { useMemo } from "react";
import { analyzePanel, verdict } from "../domain/analysis";
import { bomTotals, computeBom } from "../domain/bom";
import { freeModules, panelCapacity } from "../domain/panel";
import type { Panel } from "../domain/types";
import { type View, useStore } from "../store/store";
import { useUi } from "../store/ui";
import { DeviceArt } from "./DeviceArt";
import { IconArrowRight, IconCamera, IconPanel, IconPlus, IconWand } from "./icons";
import { Badge, ScoreRing, complianceScore, euro } from "./ui";

export function OverviewView({ onNavigate }: { onNavigate: (v: View) => void }) {
  const project = useStore((s) => s.project);
  const openPanel = useStore((s) => s.openPanel);
  const selectDevice = useStore((s) => s.selectDevice);
  const addPanel = useStore((s) => s.addPanel);

  const results = useMemo(
    () => project.panels.map((panel) => ({ panel, findings: analyzePanel(panel, project.house) })),
    [project.panels, project.house],
  );
  const existing = results.find((r) => r.panel.id === project.sourcePanelId && r.panel.role === "existing") ?? results.find((r) => r.panel.role === "existing");
  const target = results.find((r) => r.panel.id === project.targetPanelId && r.panel.role === "new") ?? results.find((r) => r.panel.role === "new");
  const bom = useMemo(() => (target ? computeBom(project, target.panel, existing?.panel) : []), [project, target, existing]);
  const totals = bomTotals(bom);

  const existingIssues = existing ? existing.findings.filter((f) => f.severity === "danger" || f.severity === "nonconforme") : [];
  const targetIssues = target ? target.findings.filter((f) => f.severity === "danger" || f.severity === "nonconforme") : [];
  const described = existing ? existing.panel.rows.flat().length > 0 && !existing.findings.some((f) => f.ruleId === "circuit-non-decrit") : false;

  const steps: { title: string; text: string; done: boolean; action: string; run: () => void; alt?: { label: string; run: () => void } }[] = [
    {
      title: "Renseigner la maison",
      text: project.house.validatedAt
        ? `Enregistré${project.house.earthOhms === undefined ? " · pensez à faire mesurer la terre" : ""}.`
        : "Surface, abonnement, mesure de terre et exposition à la foudre, puis « Valider ».",
      done: !!project.house.validatedAt,
      action: project.house.validatedAt ? "Modifier" : "Compléter",
      run: () => onNavigate("house"),
    },
    {
      title: "Décrire le tableau existant",
      text: "Chaque disjoncteur avec ce qui y est branché, la section des fils et son état.",
      done: described,
      action: existing ? "Ouvrir" : "Créer",
      run: () => (existing ? openPanel(existing.panel.id) : addPanel("existing")),
      alt: { label: "Depuis une photo", run: () => useUi.getState().openPhoto() },
    },
    {
      title: "Générer le tableau conforme",
      text: "Un nouveau tableau aux normes, à ajuster ensuite à la main.",
      done: !!target && target.panel.rows.flat().length > 0 && targetIssues.length === 0,
      action: target ? "Ouvrir" : "Générer",
      run: () => (target ? openPanel(target.panel.id) : existing ? openPanel(existing.panel.id) : addPanel("new")),
    },
    {
      title: "Préparer les achats",
      text: target ? `${bom.filter((l) => l.toBuy > 0 && project.inventory[l.key]?.bought).length} article(s) acheté(s) sur ${bom.filter((l) => l.toBuy > 0).length} à acheter.` : "Réemploi de l'existant, quantités possédées et liste d'achat chiffrée.",
      done: !!target && bom.filter((l) => l.toBuy > 0).every((l) => project.inventory[l.key]?.bought),
      action: "Voir le matériel",
      run: () => onNavigate("materials"),
    },
  ];
  const current = steps.findIndex((s) => !s.done);

  const locate = (panel: Panel, id?: string) => {
    openPanel(panel.id);
    if (id) selectDevice(id);
  };

  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Vue d'ensemble</h1>
          <p className="sub">Où en est la mise en conformité de « {project.house.name || "mon projet"} » avec la NF C 15-100.</p>
        </div>
        {existing && !target && (
          <button type="button" className="btn btn-primary" onClick={() => openPanel(existing.panel.id)}>
            <IconWand size={16} /> Générer le tableau conforme
          </button>
        )}
      </div>

      <div className="grid-4">
        <div className="card kpi">
          <span className="kpi-label">Tableau existant</span>
          <div className="row" style={{ flexWrap: "nowrap", gap: 14 }}>
            <ScoreRing value={existing ? complianceScore(existing.findings) : 0} size={64} label="" />
            <div>
              <div className="kpi-value">{existingIssues.length}</div>
              <div className="kpi-foot">point{existingIssues.length > 1 ? "s" : ""} à corriger</div>
            </div>
          </div>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Nouveau tableau</span>
          <div className="row" style={{ flexWrap: "nowrap", gap: 14 }}>
            <ScoreRing value={target ? complianceScore(target.findings) : 0} size={64} label="" />
            <div>
              <div className="kpi-value">{target ? targetIssues.length : "—"}</div>
              <div className="kpi-foot">{target ? "non-conformité restante" : "pas encore généré"}</div>
            </div>
          </div>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Articles à acheter</span>
          <div className="kpi-value">{target ? totals.toBuy : "—"}</div>
          <div className="kpi-foot">{target ? `${totals.reused} réemployés sur ${totals.items}` : "après génération"}</div>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Budget indicatif</span>
          <div className="kpi-value">{target ? euro(totals.cost) : "—"}</div>
          <div className="kpi-foot">prix grande surface, à vérifier</div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Étapes du projet</h2>
              <p className="sub">
                {steps.filter((s) => s.done).length} sur {steps.length} terminées
              </p>
            </div>
          </div>
          <div className="steps">
            {steps.map((s, i) => (
              <div key={s.title} className="step" data-state={s.done ? "done" : i === current ? "current" : "todo"}>
                <span className="step-num">{s.done ? "✓" : i + 1}</span>
                <div>
                  <b>{s.title}</b>
                  <p>{s.text}</p>
                </div>
                <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                  {s.alt && !s.done && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={s.alt.run}>
                      <IconCamera size={14} /> {s.alt.label}
                    </button>
                  )}
                  <button type="button" className={`btn btn-sm${i === current ? " btn-primary" : ""}`} onClick={s.run}>
                    {s.action}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h2>Points prioritaires</h2>
              <p className="sub">Sur le tableau existant, du plus grave au moins grave.</p>
            </div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onNavigate("analysis")}>
              Tout voir <IconArrowRight size={15} />
            </button>
          </div>
          {existing && existingIssues.length > 0 ? (
            <ul className="list-notes" style={{ padding: "4px 20px 8px" }}>
              {existingIssues.slice(0, 6).map((f) => (
                <li key={f.id} style={{ alignItems: "center" }}>
                  <span className="status-dot" data-tone={f.severity} />
                  <span style={{ flex: 1, minWidth: 0 }}>{f.title}</span>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => locate(existing.panel, f.deviceIds[0])}>
                    Voir
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">
              <p>{existing ? "Aucune non-conformité détectée." : "Aucun tableau existant décrit."}</p>
            </div>
          )}
        </section>
      </div>

      <section className="stack">
        <div className="row">
          <h2 style={{ flex: 1 }}>Tableaux</h2>
          <button type="button" className="btn btn-sm" onClick={() => addPanel("new")}>
            <IconPlus size={15} /> Nouveau tableau
          </button>
        </div>
        <div className="grid-3">
          {results.map(({ panel, findings }) => {
            const v = verdict(findings);
            const cap = panelCapacity(panel);
            const devices = panel.rows.flat();
            return (
              <button key={panel.id} type="button" className="card" style={{ textAlign: "left", cursor: "pointer", padding: 0, overflow: "hidden" }} onClick={() => locate(panel)}>
                <div style={{ background: "var(--surface-3)", padding: "18px 16px", display: "flex", gap: 2, overflow: "hidden", minHeight: 108, alignItems: "center" }}>
                  {devices.length ? (
                    devices.slice(0, 12).map((d) => <DeviceArt key={d.id} device={d} view="front" scale={1.55} />)
                  ) : (
                    <span className="muted row">
                      <IconPanel /> Tableau vide
                    </span>
                  )}
                </div>
                <div style={{ padding: "14px 16px" }} className="stack">
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <b style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{panel.name}</b>
                    <Badge tone={panel.role === "new" ? "brand" : "neutral"} plain>
                      {panel.role === "new" ? "Nouveau" : "Existant"}
                    </Badge>
                  </div>
                  <div className="row small muted" style={{ justifyContent: "space-between" }}>
                    <span>
                      {panel.enclosure.brand} · {panel.enclosure.rows} × {panel.enclosure.modulesPerRow} modules · {cap - freeModules(panel)}/{cap} utilisés
                    </span>
                    <Badge tone={devices.length === 0 ? "neutral" : v.status === "conforme" ? "ok" : v.status === "dangereux" ? "danger" : "nonconforme"}>
                      {devices.length === 0 ? "Vide" : v.status === "conforme" ? "Conforme" : v.status === "dangereux" ? "Dangereux" : "À corriger"}
                    </Badge>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
