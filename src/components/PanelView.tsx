import { useState } from "react";
import { verdict } from "../domain/analysis";
import { type CatalogItem, DEVICE_BRANDS, deviceFromCatalog, findCatalogItem } from "../domain/catalog";
import { freeModules, panelCapacity } from "../domain/panel";
import { BRANDS, type Brand, type Panel } from "../domain/types";
import { useActivePanel, useStore } from "../store/store";
import { CatalogPicker } from "./CatalogPicker";
import { IconCheck, IconDuplicate, IconEye, IconTrash, IconWand } from "./icons";
import { Inspector } from "./Inspector";
import { GROUP_COLORS, PanelVisual, type PanelViewMode } from "./PanelVisual";
import { Badge, Field, FindingCard, Modal, NumberInput, complianceScore, toast, useFindings } from "./ui";

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
  const [mode, setMode] = useState<PanelViewMode>("front");

  const selected = panel.rows.flat().find((d) => d.id === selectedId);
  const v = verdict(findings);
  const capacity = panelCapacity(panel);
  const free = freeModules(panel);
  const used = capacity - free;
  const rcdCount = panel.rows.flat().filter((d) => d.kind === "rcd").length;
  const circuitCount = panel.rows.flat().filter((d) => d.kind === "mcb" || d.kind === "rcbo" || d.kind === "fuse").length;
  const sources = panels.filter((p) => p.role === "existing");
  const empty = panel.rows.flat().length === 0;

  const setEnclosureSize = (rows: number, modulesPerRow: number) => {
    const item = findCatalogItem(panel.enclosure.brand, { kind: "enclosure", rows, modulesPerRow });
    updateEnclosure(panel.id, { rows, modulesPerRow, catalogId: item?.id, ref: item?.ref, label: item?.label ?? `Coffret ${rows} rangées ${modulesPerRow} modules` });
  };

  return (
    <div>
      <div className="page-head">
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <Badge tone={panel.role === "new" ? "brand" : "neutral"} plain>
              {panel.role === "new" ? "Nouveau tableau" : "Tableau existant"}
            </Badge>
            {!empty && (
              <Badge tone={v.status === "conforme" ? "ok" : v.status === "dangereux" ? "danger" : "nonconforme"}>
                {v.status === "conforme" ? "Conforme" : v.status === "dangereux" ? "Dangereux" : "À mettre en conformité"}
              </Badge>
            )}
          </div>
          <input
            id="panel-name"
            className="input"
            value={panel.name}
            aria-label="Nom du tableau"
            onChange={(e) => updatePanel(panel.id, { name: e.target.value })}
            style={{ fontSize: "1.6rem", fontWeight: 650, letterSpacing: "-0.025em", border: "1px solid transparent", boxShadow: "none", background: "transparent", padding: "2px 6px", marginLeft: -7, maxWidth: 520 }}
          />
        </div>
        <div className="row">
          <button type="button" className="btn btn-sm" onClick={() => duplicatePanel(panel.id)}>
            <IconDuplicate size={15} /> Dupliquer
          </button>
          {panels.length > 1 &&
            (confirmRemove ? (
              <>
                <button type="button" className="btn btn-sm btn-danger-solid" onClick={() => removePanel(panel.id)}>
                  Supprimer définitivement
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmRemove(false)}>
                  Annuler
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirmRemove(true)}>
                <IconTrash size={15} /> Supprimer
              </button>
            ))}
          {(panel.role === "existing" || sources.length > 0) && (
            <button type="button" className="btn btn-primary" onClick={() => setGenerating(true)}>
              <IconWand size={16} /> {panel.role === "existing" ? "Générer le tableau conforme" : "Régénérer depuis l'existant"}
            </button>
          )}
        </div>
      </div>

      <div className="workspace">
        <div className="stack-lg">
          <section className="card" style={{ overflow: "hidden" }}>
            <div className="toolbar">
              <div className="segmented" role="group" aria-label="Vue du tableau">
                <button type="button" aria-pressed={mode === "front"} onClick={() => setMode("front")}>
                  Capot fermé
                </button>
                <button type="button" aria-pressed={mode === "open"} onClick={() => setMode("open")}>
                  <IconEye size={15} /> Capot ouvert
                </button>
              </div>
              <span className="spacer" />
              <label className="field">
                <span className="label">Rôle</span>
                <select id="panel-role" className="input" value={panel.role} onChange={(e) => updatePanel(panel.id, { role: e.target.value as Panel["role"] })}>
                  <option value="existing">Existant</option>
                  <option value="new">Nouveau</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Marque</span>
                <select
                  id="panel-brand"
                  className="input"
                  value={panel.enclosure.brand}
                  onChange={(e) => {
                    const brand = e.target.value as Brand;
                    if (panel.role === "new" && DEVICE_BRANDS.includes(brand)) {
                      rebrand(panel.id, brand);
                      toast(`Appareils convertis en ${brand}`);
                    } else {
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
                <span className="label">Coffret</span>
                <select id="panel-rows" className="input" value={panel.enclosure.rows} onChange={(e) => setEnclosureSize(Number(e.target.value), panel.enclosure.modulesPerRow)}>
                  {[1, 2, 3, 4, 5, 6].map((r) => (
                    <option key={r} value={r} disabled={r < panel.rows.filter((row) => row.length).length}>
                      {r} rangée{r > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
                <select id="panel-modules" className="input" value={panel.enclosure.modulesPerRow} onChange={(e) => setEnclosureSize(panel.enclosure.rows, Number(e.target.value))} aria-label="Modules par rangée">
                  <option value={13}>13 modules</option>
                  <option value={18}>18 modules</option>
                </select>
              </label>
            </div>

            <PanelVisual
              panel={panel}
              findings={findings}
              selectedId={selectedId}
              mode={mode}
              onSelect={select}
              onAdd={(row) => setAddingRow(row)}
              onMove={(id, row, index) => moveDevice(panel.id, id, row, index)}
            />

            <div className="stats-bar">
              <span>
                Occupation <b>{used}</b>/{capacity} modules{" "}
                <span className="meter" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (used / Math.max(capacity, 1)) * 100)}%`, background: free / Math.max(capacity, 1) < 0.2 ? "var(--nc)" : undefined }} />
                </span>
              </span>
              <span>
                Réserve <b>{capacity ? Math.round((free / capacity) * 100) : 0} %</b>
              </span>
              <span>
                <b>{circuitCount}</b> départs · <b>{rcdCount}</b> différentiel{rcdCount > 1 ? "s" : ""}
              </span>
              <span>
                Score <b>{complianceScore(findings)}</b>/100
              </span>
              <span className="spacer" />
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <span className="label" style={{ fontWeight: 500, color: "var(--muted)", fontSize: "0.82rem" }}>
                  Manettes à
                </span>
                <NumberInput id="panel-height" className="input input-sm" value={panel.controlHeightM} min={0} max={3} step={0.05} onChange={(val) => updatePanel(panel.id, { controlHeightM: val })} />
                <span className="muted">m du sol</span>
              </label>
            </div>
            <div className="legend">
              <span>
                <i style={{ width: 16, height: 3, borderRadius: 2, background: GROUP_COLORS[0] }} />
                Repère sous l'étiquette : différentiel qui protège le départ
              </span>
              <span>
                <i style={{ width: 16, height: 3, borderRadius: 2, background: "#d33a2f" }} />
                Départ sans protection 30 mA
              </span>
              <span>Glissez-déposez les appareils pour les réorganiser, cliquez un emplacement libre pour ajouter.</span>
            </div>
          </section>

          {panel.notes && panel.notes.length > 0 && (
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Travaux à prévoir</h2>
                  <p className="sub">Relevés lors de la génération du tableau.</p>
                </div>
              </div>
              <ul className="list-notes" style={{ padding: "4px 20px 10px" }}>
                {panel.notes.map((n, i) => (
                  <li key={i}>
                    <IconCheck size={15} />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="card inspector" aria-label="Détails">
          {selected ? <Inspector panel={panel} device={selected} findings={findings} onAsk={onAsk} /> : <PanelSummary panel={panel} onAsk={onAsk} />}
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

function PanelSummary({ panel, onAsk }: { panel: Panel; onAsk: (q: string) => void }) {
  const house = useStore((s) => s.project.house);
  const select = useStore((s) => s.selectDevice);
  const findings = useFindings(panel, house);
  const [showAll, setShowAll] = useState(false);
  const important = findings.filter((f) => f.severity === "danger" || f.severity === "nonconforme");
  const list = showAll ? findings : important.slice(0, 5);
  return (
    <div>
      <div className="inspector-head">
        <div style={{ flex: 1 }}>
          <div className="overline">Conformité NF C 15-100</div>
          <h2 style={{ marginTop: 4 }}>{important.length ? `${important.length} point${important.length > 1 ? "s" : ""} à corriger` : "Aucune non-conformité"}</h2>
          <p className="muted small" style={{ marginTop: 4 }}>
            Sélectionnez un appareil pour décrire ce qui y est branché et voir les règles qui s'y appliquent.
          </p>
        </div>
      </div>
      <div className="inspector-section">
        {list.length === 0 && <p className="muted small">Rien à signaler d'après les informations saisies.</p>}
        <div className="findings">
          {list.map((f) => (
            <FindingCard
              key={f.id}
              finding={f}
              onLocate={f.deviceIds.length ? () => select(f.deviceIds[0]) : undefined}
              onAsk={() => onAsk(`Explique-moi ce problème et comment le corriger concrètement : « ${f.title} ».`)}
            />
          ))}
        </div>
        {findings.length > list.length || showAll ? (
          <button type="button" className="btn btn-sm btn-block" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Afficher les points prioritaires" : `Voir les ${findings.length} constats`}
          </button>
        ) : null}
      </div>
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
      subtitle="Chaque circuit décrit est repris, corrigé et réparti sous des différentiels 30 mA, avec 20 % de réserve."
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!sourceId}
            onClick={() => {
              generate(sourceId!, { brand, modulesPerRow }, replace);
              toast(replace ? "Tableau régénéré" : "Nouveau tableau conforme créé");
              onClose();
            }}
          >
            <IconWand size={16} /> {replace ? "Remplacer le tableau" : "Générer"}
          </button>
        </>
      }
    >
      <ul className="list-notes">
        {[
          "Calibres corrigés selon l'usage et la section des fils",
          "Circuits trop chargés scindés, circuits obligatoires ajoutés",
          "Un différentiel par rangée, dont un de type A (plaque, lave-linge)",
          "Parafoudre et disjoncteur différentiel VE si nécessaire",
        ].map((t) => (
          <li key={t}>
            <IconCheck size={15} />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <div className="form-grid">
        <Field label="À partir de" full>
          <select id="gen-source" className="input" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            {sources.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Marque">
          <select id="gen-brand" className="input" value={brand} onChange={(e) => setBrand(e.target.value as Brand)}>
            {DEVICE_BRANDS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Largeur du coffret">
          <select id="gen-modules" className="input" value={modulesPerRow} onChange={(e) => setModulesPerRow(Number(e.target.value) as 13 | 18)}>
            <option value={13}>13 modules par rangée</option>
            <option value={18}>18 modules par rangée</option>
          </select>
        </Field>
      </div>
      {replace && <p className="muted small">Les retouches faites à la main sur ce tableau seront remplacées (annulable avec Ctrl+Z).</p>}
    </Modal>
  );
}
