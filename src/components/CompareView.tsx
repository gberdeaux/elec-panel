import { useMemo, useState } from "react";
import { analyzePanel } from "../domain/analysis";
import { bomTotals, computeBom } from "../domain/bom";
import { freeModules, isCircuitDevice, panelCapacity } from "../domain/panel";
import type { Panel } from "../domain/types";
import { type View, useStore } from "../store/store";
import { IconArrowRight, IconCheck, IconPanel, IconWand } from "./icons";
import { PanelVisual } from "./PanelVisual";
import { Badge, ScoreRing, complianceScore, euro } from "./ui";

function stats(panel: Panel, house: ReturnType<typeof useStore.getState>["project"]["house"]) {
  const findings = analyzePanel(panel, house);
  const devices = panel.rows.flat();
  const cap = panelCapacity(panel);
  return {
    findings,
    score: complianceScore(findings),
    danger: findings.filter((f) => f.severity === "danger").length,
    nc: findings.filter((f) => f.severity === "nonconforme").length,
    rcds: devices.filter((d) => d.kind === "rcd").length,
    circuits: devices.filter(isCircuitDevice).length,
    reserve: cap ? Math.round((freeModules(panel) / cap) * 100) : 0,
    size: `${panel.enclosure.rows} × ${panel.enclosure.modulesPerRow}`,
  };
}

export function CompareView({ onNavigate }: { onNavigate: (v: View) => void }) {
  const project = useStore((s) => s.project);
  const openPanel = useStore((s) => s.openPanel);
  const existing = project.panels.filter((p) => p.role === "existing");
  const news = project.panels.filter((p) => p.role === "new");
  const [beforeId, setBeforeId] = useState(project.sourcePanelId ?? existing[0]?.id);
  const [afterId, setAfterId] = useState(project.targetPanelId ?? news[0]?.id);
  const before = project.panels.find((p) => p.id === beforeId) ?? existing[0];
  const after = project.panels.find((p) => p.id === afterId) ?? news[0];

  const b = useMemo(() => (before ? stats(before, project.house) : undefined), [before, project.house]);
  const a = useMemo(() => (after ? stats(after, project.house) : undefined), [after, project.house]);
  const bom = useMemo(() => (after ? bomTotals(computeBom(project, after, before)) : undefined), [project, after, before]);

  if (!before || !after || !a || !b) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>Avant / après</h1>
            <p className="sub">Comparez votre tableau actuel et le nouveau tableau conforme.</p>
          </div>
        </div>
        <div className="card empty">
          <span className="empty-icon">
            <IconWand />
          </span>
          <h3>Il faut un tableau existant et un nouveau tableau</h3>
          <p>Décrivez votre tableau actuel puis générez le tableau conforme.</p>
          {existing[0] && (
            <button type="button" className="btn btn-primary" onClick={() => openPanel(existing[0].id)}>
              Ouvrir le tableau existant
            </button>
          )}
        </div>
      </div>
    );
  }

  const rows: { label: string; from: string | number; to: string | number; better?: boolean }[] = [
    { label: "Score de conformité", from: `${b.score}/100`, to: `${a.score}/100`, better: a.score >= b.score },
    { label: "Dangers", from: b.danger, to: a.danger, better: a.danger <= b.danger },
    { label: "Non-conformités", from: b.nc, to: a.nc, better: a.nc <= b.nc },
    { label: "Interrupteurs différentiels 30 mA", from: b.rcds, to: a.rcds },
    { label: "Départs (circuits)", from: b.circuits, to: a.circuits },
    { label: "Coffret", from: b.size, to: a.size },
    { label: "Réserve disponible", from: `${b.reserve} %`, to: `${a.reserve} %`, better: a.reserve >= 20 },
  ];

  const column = (panel: Panel, s: typeof a, role: "before" | "after", pick: (id: string) => void, options: Panel[]) => (
    <section className="card" style={{ overflow: "hidden" }}>
      <div className="card-head" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 12, flexWrap: "nowrap", minWidth: 0 }}>
          <ScoreRing value={s.score} size={52} label="" />
          <div style={{ minWidth: 0 }}>
            <div className="overline">{role === "before" ? "Avant" : "Après"}</div>
            {options.length > 1 ? (
              <select className="input input-sm" value={panel.id} onChange={(e) => pick(e.target.value)} aria-label="Tableau">
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <h2>{panel.name}</h2>
            )}
          </div>
        </div>
        <Badge tone={s.danger ? "danger" : s.nc ? "nonconforme" : "ok"}>{s.danger ? "Dangereux" : s.nc ? "Non conforme" : "Conforme"}</Badge>
      </div>
      <PanelVisual panel={panel} findings={s.findings} mode="front" readOnly maxScale={1.9} />
      <div className="stats-bar">
        <button type="button" className="btn btn-sm" onClick={() => openPanel(panel.id)}>
          <IconPanel size={15} /> Ouvrir
        </button>
      </div>
    </section>
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Avant / après</h1>
          <p className="sub">Votre tableau actuel face au nouveau tableau conforme.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => onNavigate("materials")}>
          Liste d'achat <IconArrowRight size={15} />
        </button>
      </div>
      <div className="stack-lg">
        <div className="compare-grid">
          {column(before, b, "before", setBeforeId, existing)}
          <div className="compare-arrow" aria-hidden="true">
            <IconArrowRight size={26} />
          </div>
          {column(after, a, "after", setAfterId, news)}
        </div>

        <div className="grid-2" style={{ alignItems: "start" }}>
          <section className="card">
            <div className="card-head">
              <h2>Ce qui change</h2>
            </div>
            <div className="card-body delta">
              {rows.map((r) => (
                <div key={r.label} style={{ display: "contents" }}>
                  <span>{r.label}</span>
                  <span className="from">{r.from}</span>
                  <span className="arrow">→</span>
                  <span className="to" style={{ color: r.better === undefined ? undefined : r.better ? "var(--ok)" : "var(--danger)" }}>
                    {r.to}
                  </span>
                </div>
              ))}
              {bom && (
                <div style={{ display: "contents" }}>
                  <span>Budget matériel</span>
                  <span className="from">{bom.reused} réemployés</span>
                  <span className="arrow">→</span>
                  <span className="to">{euro(bom.cost)}</span>
                </div>
              )}
            </div>
          </section>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Travaux à prévoir</h2>
                <p className="sub">Hors tension, disjoncteur de branchement coupé.</p>
              </div>
            </div>
            {after.notes?.length ? (
              <ul className="list-notes" style={{ padding: "4px 20px 12px" }}>
                {after.notes.map((n, i) => (
                  <li key={i}>
                    <IconCheck size={15} />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty">
                <p>Aucun travail particulier relevé.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
