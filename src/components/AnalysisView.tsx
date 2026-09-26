import { useMemo, useState } from "react";
import { SEVERITY_LABEL, SEVERITY_ORDER, analyzePanel, verdict } from "../domain/analysis";
import type { Panel, Severity } from "../domain/types";
import { useStore } from "../store/store";
import { FindingCard } from "./ui";

const STATUS_TEXT = {
  conforme: "Conforme",
  "a-corriger": "À corriger",
  dangereux: "Dangereux",
};

export function AnalysisView({ onAsk }: { onAsk: (q: string) => void }) {
  const project = useStore((s) => s.project);
  const openPanel = useStore((s) => s.openPanel);
  const selectDevice = useStore((s) => s.selectDevice);
  const [panelId, setPanelId] = useState(project.activePanelId);
  const [filter, setFilter] = useState<Severity | "all">("all");
  const panel = project.panels.find((p) => p.id === panelId) ?? project.panels[0];

  const results = useMemo(
    () => project.panels.map((p) => ({ panel: p, findings: analyzePanel(p, project.house) })),
    [project.panels, project.house],
  );
  const current = results.find((r) => r.panel.id === panel.id)!;
  const v = verdict(current.findings);
  const shown = current.findings.filter((f) => filter === "all" || f.severity === filter);

  const locate = (p: Panel, deviceId: string) => {
    openPanel(p.id);
    selectDevice(deviceId);
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div>
        <div className="eyebrow">NF C 15-100 · révision 2024</div>
        <h2>Conformité</h2>
      </div>

      {results.length > 1 && (
        <div className="compare">
          {results.map(({ panel: p, findings }) => {
            const pv = verdict(findings);
            return (
              <button
                key={p.id}
                type="button"
                className="card"
                style={{ textAlign: "left", cursor: "pointer", borderColor: p.id === panel.id ? "var(--accent)" : undefined, borderWidth: p.id === panel.id ? 2 : 1 }}
                onClick={() => setPanelId(p.id)}
              >
                <div className="eyebrow">{p.role === "existing" ? "Existant" : "Nouveau"}</div>
                <h3>{p.name}</h3>
                <div className="counts" style={{ marginTop: 8 }}>
                  {SEVERITY_ORDER.map((s) => (
                    <span key={s} className="chip" data-sev={pv.counts[s] ? s : undefined}>
                      {pv.counts[s]} {SEVERITY_LABEL[s].toLowerCase()}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <section className="card verdict">
        <div className="verdict-seal" data-status={v.status}>
          {STATUS_TEXT[v.status]}
          <small>NF C 15-100</small>
        </div>
        <div className="stack">
          <h3>{panel.name}</h3>
          <p>
            {v.status === "dangereux" &&
              "Ce tableau présente des risques pour la sécurité des personnes ou des biens. Commencez par les points marqués « Danger »."}
            {v.status === "a-corriger" && "Ce tableau n'est pas conforme à la norme actuelle, sans danger immédiat identifié."}
            {v.status === "conforme" && "Aucune non-conformité détectée d'après les informations saisies."}
          </p>
          <div className="row">
            <button type="button" className="btn small" onClick={() => onAsk(`Fais le point sur la conformité de « ${panel.name} » et dis-moi par quoi commencer.`)}>
              Demander un avis à l'assistant
            </button>
            <button type="button" className="btn small ghost" onClick={() => openPanel(panel.id)}>
              Ouvrir le tableau
            </button>
          </div>
          <p className="muted" style={{ fontSize: "0.8rem" }}>
            L'analyse porte sur ce que vous avez décrit. Elle ne remplace ni un diagnostic électrique ni l'attestation Consuel.
          </p>
        </div>
      </section>

      <div className="segmented" role="group" aria-label="Filtrer par gravité">
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          Tout ({current.findings.length})
        </button>
        {SEVERITY_ORDER.map((s) => (
          <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)}>
            {SEVERITY_LABEL[s]} ({v.counts[s]})
          </button>
        ))}
      </div>

      <div className="findings-list">
        {shown.map((f) => (
          <FindingCard
            key={f.id}
            finding={f}
            onLocate={f.deviceIds.length ? () => locate(panel, f.deviceIds[0]) : undefined}
            onAsk={() => onAsk(`Explique-moi ce problème sur « ${panel.name} » et comment le corriger concrètement : « ${f.title} ».`)}
          />
        ))}
        {shown.length === 0 && <p className="muted">Rien à signaler dans cette catégorie.</p>}
      </div>

      {panel.notes && panel.notes.length > 0 && (
        <section className="card stack">
          <h3>Travaux prévus par la génération</h3>
          <ul className="notes-list">
            {panel.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
