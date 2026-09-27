import { type ReactNode, useEffect, useMemo, useState } from "react";
import { verdict } from "../domain/analysis";
import { type CatalogItem, DEVICE_BRANDS, catalogById, deviceFromCatalog, findCatalogItem } from "../domain/catalog";
import { autoFix, quickFixFor } from "../domain/fixes";
import { deviceTitle, findDevice, freeModules, isCircuitDevice, locatedDevices, panelCapacity, repereMap, rowModules } from "../domain/panel";
import { BRANDS, type Brand, type Panel } from "../domain/types";
import { type View, useActivePanel, useStore } from "../store/store";
import { useUi } from "../store/ui";
import { CatalogPicker } from "./CatalogPicker";
import { DeviceArt } from "./DeviceArt";
import { IconArrowRight, IconBolt, IconCamera, IconCheck, IconDuplicate, IconEye, IconTrash, IconWand } from "./icons";
import { Inspector } from "./Inspector";
import { Palette } from "./Palette";
import { PanelVisual, type PanelViewMode } from "./PanelVisual";
import { Badge, Field, FindingCard, Modal, NumberInput, complianceScore, toast, useFindings } from "./ui";

export function PanelView({ onAsk, onNavigate }: { onAsk: (q: string) => void; onNavigate: (v: View) => void }) {
  const panel = useActivePanel();
  const house = useStore((s) => s.project.house);
  const panels = useStore((s) => s.project.panels);
  const custom = useStore((s) => s.project.customCatalog);
  const selectedId = useStore((s) => s.selectedDeviceId);
  const select = useStore((s) => s.selectDevice);
  const addDevice = useStore((s) => s.addDevice);
  const moveDevice = useStore((s) => s.moveDevice);
  const updatePanel = useStore((s) => s.updatePanel);
  const updateEnclosure = useStore((s) => s.updateEnclosure);
  const replacePanel = useStore((s) => s.replacePanel);
  const rebrand = useStore((s) => s.rebrand);
  const removePanel = useStore((s) => s.removePanel);
  const duplicatePanel = useStore((s) => s.duplicatePanel);
  const findings = useFindings(panel, house);
  const [addingRow, setAddingRow] = useState<number>();
  const [generating, setGenerating] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [mode, setMode] = useState<PanelViewMode>("front");
  const [tab, setTab] = useState<"device" | "issues">("issues");

  useEffect(() => {
    setTab(selectedId ? "device" : "issues");
  }, [selectedId]);

  // Clavier : Suppr supprime la sélection, Échap désélectionne, flèches pour naviguer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, select, [contenteditable]") || document.querySelector(".modal")) return;
      const current = useStore.getState().selectedDeviceId;
      if (!current) return;
      const loc = findDevice(panel, current);
      if (!loc) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const row = panel.rows[loc.row];
        const neighbour = row[loc.index + 1] ?? row[loc.index - 1];
        useStore.getState().removeDevice(panel.id, current);
        select(neighbour?.id);
        toast(`${deviceTitle(loc.device)} supprimé · Ctrl+Z pour annuler`);
      } else if (e.key === "Escape") {
        select(undefined);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const row = panel.rows[loc.row];
        const next = row[loc.index + (e.key === "ArrowRight" ? 1 : -1)];
        if (next) select(next.id);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const rows = panel.rows;
        for (let r = loc.row + (e.key === "ArrowDown" ? 1 : -1); r >= 0 && r < rows.length; r += e.key === "ArrowDown" ? 1 : -1) {
          if (rows[r].length) {
            select(rows[r][Math.min(loc.index, rows[r].length - 1)].id);
            break;
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, select]);

  const selected = panel.rows.flat().find((d) => d.id === selectedId);
  const v = verdict(findings);
  const capacity = panelCapacity(panel);
  const free = freeModules(panel);
  const used = capacity - free;
  const devices = panel.rows.flat();
  const rcdCount = devices.filter((d) => d.kind === "rcd").length;
  const circuitCount = devices.filter(isCircuitDevice).length;
  const sources = panels.filter((p) => p.role === "existing");
  const serious = findings.filter((f) => f.severity === "danger" || f.severity === "nonconforme");
  const undescribed = locatedDevices(panel).filter(({ device }) => isCircuitDevice(device) && !device.circuit);

  /** Insère un article là où il y a de la place : rangée de l'appareil sélectionné, sinon première rangée libre. */
  const insert = (item: CatalogItem, row?: number, index?: number) => {
    const modules = item.modules ?? 1;
    let target = row;
    if (target === undefined) {
      const selRow = selectedId ? findDevice(panel, selectedId)?.row : undefined;
      const fits = (r: number) => rowModules(panel.rows[r] ?? []) + modules <= panel.enclosure.modulesPerRow;
      target = selRow !== undefined && fits(selRow) ? selRow : panel.rows.findIndex((_, r) => fits(r));
      if (target < 0) target = panel.rows.length;
    }
    const at = index ?? (selectedId && findDevice(panel, selectedId)?.row === target ? findDevice(panel, selectedId)!.index + 1 : undefined);
    addDevice(panel.id, target, deviceFromCatalog(item), at);
  };

  const setEnclosure = (brand: Brand, rows: number, modulesPerRow: number) => {
    const item = findCatalogItem(brand, { kind: "enclosure", rows, modulesPerRow });
    updateEnclosure(panel.id, { brand, rows, modulesPerRow, catalogId: item?.id, ref: item?.ref, label: item?.label ?? `Coffret ${rows} rangées ${modulesPerRow} modules` });
  };

  const reperes = useMemo(() => repereMap(panel), [panel]);

  return (
    <div>
      <div className="page-head">
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <Badge tone={panel.role === "new" ? "brand" : "neutral"} plain>
              {panel.role === "new" ? "Nouveau tableau" : "Tableau existant"}
            </Badge>
            {devices.length > 0 && (
              <Badge tone={v.status === "conforme" ? "ok" : v.status === "dangereux" ? "danger" : "nonconforme"}>
                {v.status === "conforme" ? "Conforme NF C 15-100" : v.status === "dangereux" ? "Dangereux" : "À mettre en conformité"}
              </Badge>
            )}
          </div>
          <input
            id="panel-name"
            className="input"
            value={panel.name}
            aria-label="Nom du tableau"
            onChange={(e) => updatePanel(panel.id, { name: e.target.value })}
            style={{ fontSize: "1.75rem", fontWeight: 750, fontStretch: "115%", letterSpacing: "-0.02em", border: "1px solid transparent", boxShadow: "none", background: "transparent", padding: "0 6px", marginLeft: -7, maxWidth: 560, minHeight: 44 }}
          />
        </div>
        <div className="row">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => duplicatePanel(panel.id)}>
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
          <button type="button" className="btn btn-sm" onClick={() => useUi.getState().openPhoto(panel.id)}>
            <IconCamera size={15} /> Depuis une photo
          </button>
          {panel.role === "new" && sources.length > 0 && (
            <button type="button" className="btn btn-sm" onClick={() => setGenerating(true)}>
              <IconWand size={15} /> Régénérer
            </button>
          )}
        </div>
      </div>

      <NextStep
        panel={panel}
        empty={devices.length === 0}
        undescribed={undescribed.length}
        serious={serious.length}
        onDescribeNext={() => undescribed[0] && select(undescribed[0].device.id)}
        onGenerate={() => setGenerating(true)}
        onAutoFix={() => {
          const before = serious.length;
          const next = autoFix(panel, house, custom);
          replacePanel(next);
          toast(`${before} point${before > 1 ? "s" : ""} traité${before > 1 ? "s" : ""} automatiquement`);
        }}
        onNavigate={onNavigate}
      />

      {devices.length === 0 && <Starter panel={panel} onChoose={setEnclosure} />}

      <div className="workspace">
        <div className="stack-lg" style={{ minWidth: 0 }}>
        <section className="card board">
          <div className="board-bar">
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
              <span className="label">Marque</span>
              <select
                id="panel-brand"
                className="input"
                value={panel.enclosure.brand}
                onChange={(e) => {
                  const brand = e.target.value as Brand;
                  if (panel.role === "new" && DEVICE_BRANDS.includes(brand)) {
                    rebrand(panel.id, brand);
                    toast(`Tableau converti en ${brand}`);
                  } else setEnclosure(brand, panel.enclosure.rows, panel.enclosure.modulesPerRow);
                }}
              >
                {BRANDS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Coffret</span>
              <select id="panel-rows" className="input" value={panel.enclosure.rows} onChange={(e) => setEnclosure(panel.enclosure.brand, Number(e.target.value), panel.enclosure.modulesPerRow)}>
                {[1, 2, 3, 4, 5, 6].map((r) => (
                  <option key={r} value={r} disabled={r < panel.rows.filter((row) => row.length).length}>
                    {r} rangée{r > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
              <select
                id="panel-modules"
                className="input"
                value={panel.enclosure.modulesPerRow}
                onChange={(e) => setEnclosure(panel.enclosure.brand, panel.enclosure.rows, Number(e.target.value))}
                aria-label="Modules par rangée"
              >
                <option value={13}>13 modules</option>
                <option value={18}>18 modules</option>
              </select>
            </label>
          </div>

          <Palette brand={panel.enclosure.brand} role={panel.role} onPick={(item) => insert(item)} onMore={() => setAddingRow(-1)} />

          <PanelVisual
            panel={panel}
            findings={findings}
            selectedId={selectedId}
            mode={mode}
            onSelect={select}
            onAdd={(row) => setAddingRow(row)}
            onMove={(id, row, index) => moveDevice(panel.id, id, row, index)}
            onInsert={(catalogId, row, index) => {
              const item = catalogById(catalogId, custom);
              if (item) insert(item, row, index);
            }}
          />

          <div className="stats-bar">
            <span>
              Occupation <b>{used}</b>/{capacity}{" "}
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
            <label className="row" style={{ gap: 6 }}>
              <span>Manettes à</span>
              <NumberInput id="panel-height" className="input input-sm" value={panel.controlHeightM} min={0} max={3} step={0.05} onChange={(val) => updatePanel(panel.id, { controlHeightM: val })} />
              <span>m du sol</span>
            </label>
          </div>
          <div className="legend">
            <span>
              <span className="kbd">Suppr</span> supprimer · <span className="kbd">Échap</span> désélectionner · <span className="kbd">← →</span> naviguer
            </span>
            <span>
              <b className="mono" style={{ background: "#121417", color: "var(--volt)", borderRadius: 999, padding: "0 5px", marginRight: 5 }}>?</b>
              Circuit à décrire
            </span>
          </div>
        </section>
        </div>

        <aside className="card side-panel" aria-label="Détails">
          <div className="side-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "device"} onClick={() => setTab("device")}>
              Appareil
            </button>
            <button type="button" role="tab" aria-selected={tab === "issues"} onClick={() => setTab("issues")}>
              Conformité <span className="nav-count" data-tone={serious.length ? "danger" : "ok"}>{serious.length}</span>
            </button>
          </div>
          {tab === "device" ? (
            selected ? (
              <Inspector panel={panel} device={selected} findings={findings} onAsk={onAsk} />
            ) : (
              <div className="empty">
                <span className="empty-icon">
                  <IconBolt />
                </span>
                <h3>Sélectionnez un appareil</h3>
                <p>Cliquez un disjoncteur dans le coffret pour dire ce qui y est branché.</p>
              </div>
            )
          ) : (
            <IssuesList panel={panel} reperes={reperes} onAsk={onAsk} />
          )}
        </aside>
      </div>

      {addingRow !== undefined && (
        <CatalogPicker
          brand={panel.enclosure.brand}
          onClose={() => setAddingRow(undefined)}
          onPick={(item: CatalogItem) => {
            insert(item, addingRow >= 0 ? addingRow : undefined);
            setAddingRow(undefined);
          }}
        />
      )}
      {generating && <GenerateDialog panel={panel} onClose={() => setGenerating(false)} />}
    </div>
  );
}

function NextStep({
  panel,
  empty,
  undescribed,
  serious,
  onDescribeNext,
  onGenerate,
  onAutoFix,
  onNavigate,
}: {
  panel: Panel;
  empty: boolean;
  undescribed: number;
  serious: number;
  onDescribeNext: () => void;
  onGenerate: () => void;
  onAutoFix: () => void;
  onNavigate: (v: View) => void;
}) {
  let tone: "todo" | "ok" = "todo";
  let title: string;
  let text: string;
  let actions: ReactNode;
  if (empty) {
    title = panel.role === "existing" ? "Reproduisez votre tableau actuel" : "Composez votre nouveau tableau";
    text = "Choisissez le coffret ci-dessous, puis ajoutez les appareils de gauche à droite depuis la palette.";
    actions = null;
  } else if (panel.role === "existing" && undescribed > 0) {
    title = `${undescribed} disjoncteur${undescribed > 1 ? "s" : ""} à décrire`;
    text = "Indiquez ce qui est branché sur chacun : c'est ce qui permet de vérifier la norme et de générer le nouveau tableau.";
    actions = (
      <button type="button" className="btn btn-primary" onClick={onDescribeNext}>
        Décrire le suivant <IconArrowRight size={15} />
      </button>
    );
  } else if (panel.role === "existing") {
    title = serious ? `Diagnostic terminé : ${serious} point${serious > 1 ? "s" : ""} à corriger` : "Diagnostic terminé : rien à corriger";
    text = serious ? "Générez un tableau conforme à partir de ces circuits, dans la marque de votre choix." : "Votre tableau respecte les règles vérifiées.";
    actions = (
      <button type="button" className="btn btn-primary" onClick={onGenerate}>
        <IconWand size={16} /> Générer le tableau conforme
      </button>
    );
  } else if (serious > 0) {
    title = `${serious} point${serious > 1 ? "s" : ""} à corriger`;
    text = "Corrigez-les un par un dans l'onglet Conformité, ou laissez l'outil appliquer les corrections.";
    actions = (
      <button type="button" className="btn btn-primary" onClick={onAutoFix}>
        <IconWand size={16} /> Tout corriger automatiquement
      </button>
    );
  } else {
    tone = "ok";
    title = "Nouveau tableau conforme";
    text = "Vérifiez les travaux à prévoir, puis préparez la liste d'achat.";
    actions = (
      <>
        <button type="button" className="btn" onClick={() => onNavigate("compare")}>
          Avant / après
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onNavigate("materials")}>
          Liste d'achat <IconArrowRight size={15} />
        </button>
      </>
    );
  }
  return (
    <div className="nextstep" data-tone={tone} role="status">
      <span className="nextstep-icon">{tone === "ok" ? <IconCheck size={18} /> : <IconBolt size={18} />}</span>
      <div className="nextstep-body">
        <b>{title}</b>
        <span>{text}</span>
      </div>
      {actions}
    </div>
  );
}

function Starter({ panel, onChoose }: { panel: Panel; onChoose: (brand: Brand, rows: number, modules: number) => void }) {
  const brands: { brand: Brand; name: string }[] = [
    { brand: "Schneider", name: "Schneider Resi9" },
    { brand: "Legrand", name: "Legrand Drivia" },
    { brand: "Hager", name: "Hager Gamma" },
    { brand: "Générique", name: "Autre / ancien" },
  ];
  return (
    <section className="card" style={{ marginBottom: 20 }}>
      <div className="card-head" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2>Quel est le coffret ?</h2>
          <p className="sub">La marque figure en bas du capot ; comptez les rangées et les emplacements d'une rangée (13 ou 18).</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => useUi.getState().openPhoto(panel.id)}>
          <IconCamera size={16} /> Gagner du temps : importer une photo
        </button>
      </div>
      <div className="card-body stack">
        <div className="starter">
          {brands.map((b) => (
            <button key={b.brand} type="button" aria-pressed={panel.enclosure.brand === b.brand} onClick={() => onChoose(b.brand, panel.enclosure.rows, panel.enclosure.modulesPerRow)}>
              <span style={{ display: "flex", gap: 1, background: "var(--wall)", padding: 8, borderRadius: 8 }}>
                <DeviceArt device={{ kind: "rcd", modules: 2, rating: 40, rcdType: "AC", sensitivity: 30, brand: b.brand, condition: "bon" }} view="front" scale={1.25} />
                <DeviceArt device={{ kind: "mcb", modules: 1, rating: 16, curve: "C", poles: "1P+N", breakingCapacity: 3000, brand: b.brand, condition: "bon" }} view="front" scale={1.25} />
              </span>
              {b.name}
            </button>
          ))}
        </div>
        <div className="row">
          <span className="small muted">Taille :</span>
          <div className="chips" role="group" aria-label="Nombre de rangées">
            {[1, 2, 3, 4].map((r) => (
              <button key={r} type="button" aria-pressed={panel.enclosure.rows === r} onClick={() => onChoose(panel.enclosure.brand, r, panel.enclosure.modulesPerRow)}>
                {r} rangée{r > 1 ? "s" : ""}
              </button>
            ))}
          </div>
          <div className="chips" role="group" aria-label="Modules par rangée">
            {[13, 18].map((m) => (
              <button key={m} type="button" aria-pressed={panel.enclosure.modulesPerRow === m} onClick={() => onChoose(panel.enclosure.brand, panel.enclosure.rows, m)}>
                {m} modules
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function IssuesList({ panel, reperes, onAsk }: { panel: Panel; reperes: Map<string, string>; onAsk: (q: string) => void }) {
  const house = useStore((s) => s.project.house);
  const custom = useStore((s) => s.project.customCatalog);
  const select = useStore((s) => s.selectDevice);
  const replacePanel = useStore((s) => s.replacePanel);
  const findings = useFindings(panel, house);
  const [showAll, setShowAll] = useState(false);
  const serious = findings.filter((f) => f.severity === "danger" || f.severity === "nonconforme");
  const list = showAll ? findings : serious;
  return (
    <div className="inspector-section">
      {serious.length === 0 && !showAll && (
        <div className="recommend" data-ok="true">
          <IconCheck size={16} /> Aucune non-conformité d'après ce qui est décrit.
        </div>
      )}
      {panel.role === "existing" && serious.length > 0 && (
        <p className="helpbox">Ce tableau décrit l'existant : les corrections se font dans le nouveau tableau généré.</p>
      )}
      <div className="findings">
        {list.map((f) => {
          const fix = panel.role === "new" ? quickFixFor(f, panel, house, custom) : undefined;
          return (
            <FindingCard
              key={f.id}
              finding={f}
              reference={f.deviceIds[0] ? reperes.get(f.deviceIds[0]) : undefined}
              onFix={
                fix
                  ? () => {
                      replacePanel(fix.apply(panel));
                      toast(fix.label);
                    }
                  : undefined
              }
              fixLabel={fix?.label}
              onLocate={f.deviceIds.length ? () => select(f.deviceIds[0]) : undefined}
              onAsk={() => onAsk(`Explique-moi ce problème et comment le corriger concrètement : « ${f.title} ».`)}
            />
          );
        })}
      </div>
      {findings.length > serious.length && (
        <button type="button" className="btn btn-sm btn-block" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Masquer les points à vérifier et conseils" : `Afficher aussi ${findings.length - serious.length} point${findings.length - serious.length > 1 ? "s" : ""} à vérifier et conseil${findings.length - serious.length > 1 ? "s" : ""}`}
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
      title={replace ? "Régénérer ce tableau" : "Générer le tableau conforme"}
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
      <Field label="Marque du nouveau tableau">
        <div className="starter" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          {DEVICE_BRANDS.map((b) => (
            <button key={b} type="button" aria-pressed={brand === b} onClick={() => setBrand(b)} style={{ padding: "10px 6px" }}>
              <DeviceArt device={{ kind: "mcb", modules: 1, rating: 20, curve: "C", poles: "1P+N", breakingCapacity: 3000, brand: b, condition: "bon" }} view="front" scale={1.2} />
              <small>{b}</small>
            </button>
          ))}
        </div>
      </Field>
      <div className="form-grid">
        <Field label="À partir de">
          <select id="gen-source" className="input" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            {sources.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
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
