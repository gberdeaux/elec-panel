import { useMemo, useRef, useState } from "react";
import { IS_ARTIFACT } from "../ai/assistant";
import { USAGES } from "../domain/norm";
import { deviceTitle, findDevice, repereMap } from "../domain/panel";
import { DEFAULT_LABEL_SETTINGS } from "../domain/types";
import { exportFile } from "../store/persistence";
import { useStore } from "../store/store";
import { IconDownload, IconInfo, Picto, PICTO_CHOICES } from "./icons";
import { LabelSheet, LabelStrip, labelIconFor, labelTextFor } from "./Labels";
import { Chips, Field, Switch, toast } from "./ui";

export function LabelsView() {
  const project = useStore((s) => s.project);
  const setLabelSettings = useStore((s) => s.setLabelSettings);
  const updateDevice = useStore((s) => s.updateDevice);
  const settings = { ...DEFAULT_LABEL_SETTINGS, ...project.labelSettings };
  const [panelId, setPanelId] = useState(project.targetPanelId ?? project.activePanelId);
  const panel = project.panels.find((p) => p.id === panelId) ?? project.panels[0];
  const [selectedId, setSelectedId] = useState<string>();
  const reperes = useMemo(() => repereMap(panel), [panel]);
  const selected = selectedId ? findDevice(panel, selectedId)?.device : undefined;

  const sheetRef = useRef<HTMLDivElement>(null);
  const download = async () => {
    const svg = sheetRef.current?.querySelector("svg")?.outerHTML;
    if (!svg) return;
    const markup = `<?xml version="1.0" encoding="UTF-8"?>
${svg}`;
    const ok = await exportFile(`etiquettes-${panel.name.replace(/\W+/g, "-").toLowerCase()}.svg`, markup, "image/svg+xml");
    if (ok) toast("Planche d'étiquettes téléchargée");
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Étiquettes</h1>
          <p className="sub">Les étiquettes du porte-étiquette de votre coffret, à la taille réelle. Cliquez une étiquette pour la modifier, puis imprimez-la.</p>
        </div>
        <div className="row">
          <select className="input" style={{ width: "auto" }} value={panel.id} onChange={(e) => setPanelId(e.target.value)} aria-label="Tableau">
            {project.panels.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={download}>
            <IconDownload size={16} /> Télécharger (SVG 1:1)
          </button>
          {!IS_ARTIFACT && (
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              Imprimer
            </button>
          )}
        </div>
      </div>

      <div className="labels-layout">
        <section className="card">
          <div className="board-bar" style={{ gap: 14 }}>
            <Field label="Largeur d'un module">
              <Chips label="Largeur d'un module" value={settings.moduleMm} options={[{ value: 17.5, label: "17,5 mm" }, { value: 18, label: "18 mm" }]} onChange={(v) => setLabelSettings({ moduleMm: v })} />
            </Field>
            <Field label="Hauteur">
              <Chips label="Hauteur" value={settings.heightMm} options={[20, 25, 30].map((h) => ({ value: h, label: `${h} mm` }))} onChange={(v) => setLabelSettings({ heightMm: v })} />
            </Field>
            <Field label="Filet">
              <Chips
                label="Couleur du filet"
                text
                value={settings.lineColor}
                options={[
                  { value: "#d0102b", label: "Rouge" },
                  { value: "#1f56d6", label: "Bleu" },
                  { value: "#1b1d21", label: "Noir" },
                  { value: "none", label: "Aucun" },
                ]}
                onChange={(v) => setLabelSettings({ lineColor: v })}
              />
            </Field>
            <div className="stack" style={{ gap: 6 }}>
              <Switch id="labels-icons" checked={settings.showIcons} onChange={(v) => setLabelSettings({ showIcons: v })} label="Pictogrammes" />
              <Switch id="labels-refs" checked={settings.showRefs} onChange={(v) => setLabelSettings({ showRefs: v })} label="Repères Q1, ID1…" />
            </div>
          </div>
          <div className="label-rows">
            {panel.rows.map((row, r) => (
              <div key={r}>
                <div className="label-row-title">Rangée {r + 1}</div>
                <div className="label-row-svg">
                  <LabelStrip
                    row={row}
                    modules={panel.enclosure.modulesPerRow}
                    settings={settings}
                    moduleMm={settings.moduleMm}
                    reperes={reperes}
                    pxWidth={1000}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="card side-panel">
          {selected ? (
            <div>
              <div className="inspector-head">
                <div style={{ flex: 1 }}>
                  <div className="overline">{reperes.get(selected.id) ?? "—"}</div>
                  <h2 style={{ marginTop: 4 }}>{deviceTitle(selected)}</h2>
                  {selected.circuit && <p className="muted small">{USAGES[selected.circuit.usage].label}</p>}
                </div>
              </div>
              <div className="inspector-section">
                <Field label="Texte de l'étiquette" hint="Retour à la ligne automatique ; la taille s'adapte à la place disponible.">
                  <textarea
                    id="label-text"
                    className="input"
                    value={selected.label ?? ""}
                    placeholder={labelTextFor({ ...selected, label: undefined })}
                    onChange={(e) => updateDevice(panel.id, selected.id, { label: e.target.value || undefined })}
                  />
                </Field>
                {selected.label && (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => updateDevice(panel.id, selected.id, { label: undefined })}>
                    Revenir au texte automatique
                  </button>
                )}
              </div>
              <div className="inspector-section">
                <h3>Pictogramme</h3>
                <div className="icon-grid">
                  {PICTO_CHOICES.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={labelIconFor(selected) === p.key}
                      onClick={() => updateDevice(panel.id, selected.id, { labelIcon: p.key })}
                      title={p.label}
                    >
                      <Picto kind={p.key} size={22} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty">
              <span className="empty-icon">
                <IconInfo />
              </span>
              <h3>Sélectionnez une étiquette</h3>
              <p>Cliquez une case pour changer son texte ou son pictogramme.</p>
            </div>
          )}
          <div className="inspector-section">
            <p className="helpbox">
              Imprimez à <b>100 %</b> (sans « ajuster à la page »), en A4 paysage, sur papier ou sur étiquette adhésive, puis découpez le long du cadre. Les rangées plus larges
              qu'une feuille sont coupées en deux bandes. {IS_ARTIFACT && "Ouvrez le fichier SVG téléchargé dans votre navigateur pour l'imprimer."}
            </p>
          </div>
        </aside>
      </div>

      <div className="print-sheet" aria-hidden="true" ref={sheetRef}>
        <LabelSheet panel={panel} settings={settings} />
      </div>
    </div>
  );
}
