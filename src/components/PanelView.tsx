import { useState } from "react";
import { verdict, worstSeverity } from "../domain/analysis";
import { type CatalogItem, DEVICE_BRANDS, deviceFromCatalog, findCatalogItem } from "../domain/catalog";
import { freeModules, panelCapacity } from "../domain/panel";
import { BRANDS, type Brand, type Panel } from "../domain/types";
import { useActivePanel, useStore } from "../store/store";
import { CatalogPicker } from "./CatalogPicker";
import { Inspector } from "./Inspector";
import { GROUP_COLORS, PanelVisual } from "./PanelVisual";
import { FindingCard, Modal, NumberInput, SeverityChip, useFindings } from "./ui";

export function PanelView({ onAsk }: { onAsk: (q: string) => void }) {
  const panel = useActivePanel();
  const house = useStore((s) => s.project.house);
  const panels = useStore((s) => s.project.panels);
  const selectedId = useStore((s) => s.selectedDeviceId);
  const select = useStore((s) => s.selectDevice);
  const addDevice = useStore((s) => s.addDevice);
  const moveDevice = useStore((s) => s.moveDevice);
  const updatePanel = useStore((s) => s.updatePanel);
  const updateEnclosure = useStore((s) => s.updateEnclosure);
  const rebrand = useStore((s) => s.rebrand);
  const removePanel = useStore((s) => s.removePanel);
  const duplicatePanel = useStore((s) => s.duplicatePanel);
  const findings = useFindings(panel, house);
  const [addingRow, setAddingRow] = useState<number>();
  const [generating, setGenerating] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const selected = panel.rows.flat().find((d) => d.id === selectedId);
  const v = verdict(findings);
  const capacity = panelCapacity(panel);
  const free = freeModules(panel);
  const rcdCount = panel.rows.flat().filter((d) => d.kind === "rcd").length;
  const sources = panels.filter((p) => p.role === "existing");
  const notes = panel.notes?.length ? panel.notes : [];

  const setEnclosureSize = (rows: number, modulesPerRow: number) => {
    const item = findCatalogItem(panel.enclosure.brand, { kind: "enclosure", rows, modulesPerRow });
    updateEnclosure(panel.id, { rows, modulesPerRow, catalogId: item?.id, ref: item?.ref, label: item?.label ?? `Coffret ${rows} rangées ${modulesPerRow} modules` });
  };

  return (
    <div>
      <div className="panel-head">
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="eyebrow">{panel.role === "existing" ? "Tableau existant" : "Nouveau tableau"}</div>
          <input
            id="panel-name"
            className="panel-title-input"
            value={panel.name}
            aria-label="Nom du tableau"
            onChange={(e) => updatePanel(panel.id, { name: e.target.value })}
          />
        </div>
        <div className="row">
          {panel.role === "existing" ? (
            <button type="button" className="btn primary" onClick={() => setGenerating(true)}>
              Générer le tableau conforme
            </button>
          ) : (
            sources.length > 0 && (
              <button type="button" className="btn" onClick={() => setGenerating(true)}>
                Régénérer depuis l'existant
              </button>
            )
          )}
          <button type="button" className="btn" onClick={() => duplicatePanel(panel.id)}>
            Copier en nouveau tableau
          </button>
          {panels.length > 1 &&
            (confirmRemove ? (
              <>
                <button type="button" className="btn danger" onClick={() => removePanel(panel.id)}>
                  Supprimer définitivement
                </button>
                <button type="button" className="btn ghost" onClick={() => setConfirmRemove(false)}>
                  Annuler
                </button>
              </>
            ) : (
              <button type="button" className="btn ghost danger" onClick={() => setConfirmRemove(true)}>
                Supprimer ce tableau
              </button>
            ))}
        </div>
      </div>

      <div className="toolbar">
        <label className="field">
          <span>Rôle</span>
          <select id="panel-role" className="input" value={panel.role} onChange={(e) => updatePanel(panel.id, { role: e.target.value as Panel["role"] })}>
            <option value="existing">Existant</option>
            <option value="new">Nouveau</option>
          </select>
        </label>
        <label className="field">
          <span>Marque du coffret</span>
          <select
            id="panel-brand"
            className="input"
            value={panel.enclosure.brand}
            onChange={(e) => {
              const brand = e.target.value as Brand;
              if (panel.role === "new" && DEVICE_BRANDS.includes(brand)) rebrand(panel.id, brand);
              else {
                const item = findCatalogItem(brand, { kind: "enclosure", rows: panel.enclosure.rows, modulesPerRow: panel.enclosure.modulesPerRow });
                updateEnclosure(panel.id, { brand, catalogId: item?.id, ref: item?.ref, label: item?.label });
              }
            }}
          >
            {BRANDS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Modules par rangée</span>
          <select
            id="panel-modules"
            className="input"
            value={panel.enclosure.modulesPerRow}
            onChange={(e) => setEnclosureSize(panel.enclosure.rows, Number(e.target.value))}
          >
            {[13, 18].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Rangées</span>
          <select id="panel-rows" className="input" value={panel.enclosure.rows} onChange={(e) => setEnclosureSize(Number(e.target.value), panel.enclosure.modulesPerRow)}>
            {[1, 2, 3, 4, 5, 6].map((r) => (
              <option key={r} value={r} disabled={r < panel.rows.filter((row) => row.length).length}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Manettes / sol (m)</span>
          <NumberInput id="panel-height" value={panel.controlHeightM} min={0} max={3} step={0.05} onChange={(v) => updatePanel(panel.id, { controlHeightM: v })} />
        </label>
        {panel.role === "new" && (
          <p className="muted" style={{ fontSize: "0.8rem", maxWidth: 260 }}>
            Changer la marque d'un nouveau tableau remplace tous ses appareils par leurs équivalents du catalogue.
          </p>
        )}
      </div>

      <div className="stats">
        <SeverityChip severity={v.status === "conforme" ? "ok" : v.status === "dangereux" ? "danger" : "nonconforme"}>
          {v.status === "conforme" ? "Conforme" : v.status === "dangereux" ? "Dangereux" : "À mettre en conformité"}
        </SeverityChip>
        <span className="stat">
          <b>{v.counts.danger + v.counts.nonconforme}</b> non-conformités
        </span>
        <span className="stat">
          <b>{capacity - free}</b>/{capacity} modules · réserve <b>{capacity ? Math.round((free / capacity) * 100) : 0} %</b>
        </span>
        <span className="stat">
          <b>{rcdCount}</b> différentiel{rcdCount > 1 ? "s" : ""}
        </span>
      </div>

      <div className="panel-layout">
        <div>
          <PanelVisual
            panel={panel}
            findings={findings}
            selectedId={selectedId}
            onSelect={select}
            onAdd={(row) => setAddingRow(row)}
            onMove={(id, row, index) => moveDevice(panel.id, id, row, index)}
          />
          <div className="legend" aria-label="Légende">
            <span>
              <span className="swatch" style={{ background: GROUP_COLORS[0] }} />
              Bande de couleur : différentiel qui protège le départ
            </span>
            <span>
              <span className="swatch" style={{ background: "repeating-linear-gradient(45deg, var(--danger) 0 4px, #fff 4px 7px)" }} />
              Départ sans protection 30 mA
            </span>
            <span>
              <span className="dot" data-sev="nonconforme" /> Constat sur l'appareil
            </span>
            <span className="muted">Glisser-déposer pour réorganiser.</span>
          </div>
          {notes.length > 0 && (
            <div className="card stack" style={{ marginTop: 16 }}>
              <h3>Travaux à prévoir</h3>
              <ul className="notes-list">
                {notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="card side" aria-label="Détails">
          {selected ? (
            <Inspector panel={panel} device={selected} findings={findings} onAsk={onAsk} />
          ) : (
            <PanelSummary panel={panel} onSelect={select} onAsk={onAsk} />
          )}
        </aside>
      </div>

      {addingRow !== undefined && (
        <CatalogPicker
          brand={panel.enclosure.brand}
          onClose={() => setAddingRow(undefined)}
          onPick={(item: CatalogItem) => {
            addDevice(panel.id, addingRow, deviceFromCatalog(item));
            setAddingRow(undefined);
          }}
        />
      )}
      {generating && <GenerateDialog panel={panel} onClose={() => setGenerating(false)} />}
    </div>
  );
}

function PanelSummary({ panel, onSelect, onAsk }: { panel: Panel; onSelect: (id?: string) => void; onAsk: (q: string) => void }) {
  const house = useStore((s) => s.project.house);
  const findings = useFindings(panel, house);
  const worst = worstSeverity(findings);
  const important = findings.filter((f) => f.severity === "danger" || f.severity === "nonconforme");
  const others = findings.filter((f) => f.severity !== "danger" && f.severity !== "nonconforme");
  const [showAll, setShowAll] = useState(false);
  return (
    <div className="stack">
      <div>
        <div className="eyebrow">Conformité NF C 15-100</div>
        <h3>{!worst ? "Aucun constat" : important.length ? `${important.length} point${important.length > 1 ? "s" : ""} à corriger` : "Conforme, avec remarques"}</h3>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Cliquez sur un appareil pour décrire ce qui y est branché et voir les règles qui s'y appliquent.
        </p>
      </div>
      <div className="findings-list">
        {(showAll ? [...important, ...others] : important.slice(0, 6)).map((f) => (
          <FindingCard
            key={f.id}
            finding={f}
            onLocate={f.deviceIds.length ? () => onSelect(f.deviceIds[0]) : undefined}
            onAsk={() => onAsk(`Explique-moi ce problème et comment le corriger concrètement : « ${f.title} ».`)}
          />
        ))}
      </div>
      {(important.length > 6 || others.length > 0) && (
        <button type="button" className="btn small" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Afficher moins" : `Voir tout (${findings.length})`}
        </button>
      )}
    </div>
  );
}

function GenerateDialog({ panel, onClose }: { panel: Panel; onClose: () => void }) {
  const panels = useStore((s) => s.project.panels);
  const generate = useStore((s) => s.generate);
  const sources = panels.filter((p) => p.role === "existing");
  const [sourceId, setSourceId] = useState(panel.role === "existing" ? panel.id : sources[0]?.id);
  const [brand, setBrand] = useState<Brand>(DEVICE_BRANDS.includes(panel.enclosure.brand) ? panel.enclosure.brand : "Schneider");
  const [modulesPerRow, setModulesPerRow] = useState<13 | 18>(13);
  const replace = panel.role === "new" ? panel.id : undefined;

  return (
    <Modal
      title={replace ? "Régénérer ce tableau" : "Générer un tableau conforme"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!sourceId}
            onClick={() => {
              generate(sourceId!, { brand, modulesPerRow }, replace);
              onClose();
            }}
          >
            {replace ? "Remplacer le tableau" : "Créer le nouveau tableau"}
          </button>
        </>
      }
    >
      <p>
        Le simulateur reprend chaque circuit décrit dans le tableau existant, corrige les calibres, scinde les circuits trop chargés, ajoute les
        circuits exigés, puis répartit le tout sous des interrupteurs différentiels 30 mA (un par rangée, dont un de type A) avec 20 % de réserve.
      </p>
      <div className="grid-fields">
        <label className="field">
          <span>À partir de</span>
          <select id="gen-source" className="input" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            {sources.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Marque</span>
          <select id="gen-brand" className="input" value={brand} onChange={(e) => setBrand(e.target.value as Brand)}>
            {DEVICE_BRANDS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Modules par rangée</span>
          <select id="gen-modules" className="input" value={modulesPerRow} onChange={(e) => setModulesPerRow(Number(e.target.value) as 13 | 18)}>
            <option value={13}>13</option>
            <option value={18}>18</option>
          </select>
        </label>
      </div>
      {replace && <p className="muted">Les modifications faites à la main sur ce tableau seront remplacées (annulable avec Ctrl+Z).</p>}
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Les éléments conformes de l'existant de même marque sont automatiquement comptés dans votre stock sur la page Matériel.
      </p>
    </Modal>
  );
}
