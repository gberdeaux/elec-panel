import { useMemo, useState } from "react";
import { SEVERITY_LABEL, SEVERITY_ORDER, analyzePanel, verdict } from "../domain/analysis";
import type { Panel, Severity } from "../domain/types";
import { autoFix, quickFixFor } from "../domain/fixes";
import { repereMap } from "../domain/panel";
import { useStore } from "../store/store";
import { IconCheck, IconPanel, IconSparkles, IconWand } from "./icons";
import { Badge, FindingCard, ScoreRing, complianceScore, toast } from "./ui";

const STATUS = {
  conforme: { tone: "ok", label: "Conforme", text: "Aucune non-conformité détectée d'après les informations saisies." },
  "a-corriger": { tone: "nonconforme", label: "À mettre en conformité", text: "Le tableau n'est pas conforme à la norme actuelle, sans danger immédiat identifié." },
  dangereux: { tone: "danger", label: "Dangereux", text: "Des points présentent un risque pour les personnes ou les biens : commencez par ceux marqués « Danger »." },
} as const;

export function AnalysisView({ onAsk }: { onAsk: (q: string) => void }) {
  const project = useStore((s) => s.project);
  const openPanel = useStore((s) => s.openPanel);
  const selectDevice = useStore((s) => s.selectDevice);
  const replacePanel = useStore((s) => s.replacePanel);
  const [panelId, setPanelId] = useState(project.activePanelId);
  const [filter, setFilter] = useState<Severity | "all">("all");
  const panel = project.panels.find((p) => p.id === panelId) ?? project.panels[0];

  const results = useMemo(
    () => project.panels.map((p) => ({ panel: p, findings: analyzePanel(p, project.house) })),
    [project.panels, project.house],
  );
  const current = results.find((r) => r.panel.id === panel.id)!;
  const v = verdict(current.findings);
  const status = STATUS[v.status];
  const shown = current.findings.filter((f) => filter === "all" || f.severity === filter);
  const reperes = useMemo(() => repereMap(panel), [panel]);
  const seriousCount = v.counts.danger + v.counts.nonconforme;

  const locate = (p: Panel, deviceId: string) => {
    openPanel(p.id);
    selectDevice(deviceId);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Conformité</h1>
          <p className="sub">Analyse selon la NF C 15-100 (révision 2024). Chaque constat indique la règle et la façon de corriger.</p>
        </div>
        <button type="button" className="btn" onClick={() => onAsk(`Fais le point sur la conformité de « ${panel.name} » et dis-moi par quoi commencer.`)}>
          <IconSparkles size={16} /> Demander un avis
        </button>
      </div>

      <div className="stack-lg">
        {results.length > 1 && (
          <div className="grid-3">
            {results.map(({ panel: p, findings }) => {
              const pv = verdict(findings);
              const active = p.id === panel.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="card"
                  onClick={() => setPanelId(p.id)}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    padding: 16,
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    borderColor: active ? "var(--brand)" : undefined,
                    boxShadow: active ? "var(--ring)" : undefined,
                  }}
                >
                  <ScoreRing value={complianceScore(findings)} size={58} label="" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row" style={{ flexWrap: "nowrap" }}>
                      <b style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</b>
                      <Badge tone={p.role === "new" ? "brand" : "neutral"} plain>
                        {p.role === "new" ? "Nouveau" : "Existant"}
                      </Badge>
                    </div>
                    <p className="muted small" style={{ marginTop: 4 }}>
                      {pv.counts.danger} danger · {pv.counts.nonconforme} non conforme · {pv.counts.avertissement} à vérifier
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <section className="card" style={{ padding: 24, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <ScoreRing value={complianceScore(current.findings)} />
          <div className="stack" style={{ flex: 1, minWidth: 240, gap: 8 }}>
            <div className="row">
              <h2 style={{ fontSize: "1.3rem" }}>{panel.name}</h2>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <p className="muted">{status.text}</p>
            <div className="row" style={{ marginTop: 4 }}>
              {SEVERITY_ORDER.map((s) => (
                <Badge key={s} tone={v.counts[s] ? s : "neutral"}>
                  {v.counts[s]} {SEVERITY_LABEL[s].toLowerCase()}
                </Badge>
              ))}
            </div>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {panel.role === "new" && seriousCount > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  replacePanel(autoFix(panel, project.house, project.customCatalog));
                  toast("Corrections appliquées");
                }}
              >
                <IconWand size={16} /> Tout corriger
              </button>
            )}
            <button type="button" className="btn" onClick={() => openPanel(panel.id)}>
              <IconPanel size={16} /> Ouvrir le tableau
            </button>
          </div>
        </section>

        <div className="row">
          <div className="segmented" role="group" aria-label="Filtrer par gravité">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
              Tous <span className="count">{current.findings.length}</span>
            </button>
            {SEVERITY_ORDER.map((s) => (
              <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)}>
                {SEVERITY_LABEL[s]} <span className="count">{v.counts[s]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="findings">
          {shown.map((f) => {
            const fix = panel.role === "new" ? quickFixFor(f, panel, project.house, project.customCatalog) : undefined;
            return (
            <FindingCard
              key={f.id}
              finding={f}
              reference={f.deviceIds[0] ? reperes.get(f.deviceIds[0]) : undefined}
              fixLabel={fix?.label}
              onFix={
                fix
                  ? () => {
                      replacePanel(fix.apply(panel));
                      toast(fix.label);
                    }
                  : undefined
              }
              onLocate={f.deviceIds.length ? () => locate(panel, f.deviceIds[0]) : undefined}
              onAsk={() => onAsk(`Explique-moi ce problème sur « ${panel.name} » et comment le corriger concrètement : « ${f.title} ».`)}
            />
            );
          })}
          {shown.length === 0 && (
            <div className="card empty">
              <span className="empty-icon">
                <IconCheck />
              </span>
              <h3>Rien à signaler</h3>
              <p>Aucun constat dans cette catégorie.</p>
            </div>
          )}
        </div>

        <p className="muted xsmall">
          L'analyse porte sur ce que vous avez décrit. Elle ne remplace ni un diagnostic électrique ni l'attestation de conformité Consuel.
        </p>
      </div>
    </div>
  );
}
