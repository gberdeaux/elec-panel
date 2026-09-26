import { useMemo, useState } from "react";
import { bomToCsv, bomToText, bomTotals, computeBom } from "../domain/bom";
import { KIND_LABEL, leroyMerlinSearchUrl } from "../domain/catalog";
import { exportFile } from "../store/persistence";
import { useStore } from "../store/store";
import { NumberInput, euro } from "./ui";

export function MaterialsView() {
  const project = useStore((s) => s.project);
  const setMaterialPanels = useStore((s) => s.setMaterialPanels);
  const setInventory = useStore((s) => s.setInventory);
  const setCrossBrand = useStore((s) => s.setCrossBrand);
  const addPanel = useStore((s) => s.addPanel);
  const [copied, setCopied] = useState<string>();

  const targets = project.panels.filter((p) => p.role === "new");
  const sources = project.panels.filter((p) => p.role === "existing");
  const target = project.panels.find((p) => p.id === project.targetPanelId && p.role === "new") ?? targets[0];
  const source = project.panels.find((p) => p.id === project.sourcePanelId && p.role === "existing") ?? sources[0];

  const lines = useMemo(() => (target ? computeBom(project, target, source) : []), [project, target, source]);
  const totals = bomTotals(lines);

  if (!target) {
    return (
      <div className="stack" style={{ gap: 16 }}>
        <h2>Matériel</h2>
        <div className="card stack">
          <p>Il n'y a pas encore de nouveau tableau. Générez-en un depuis votre tableau existant, ou créez-le à la main.</p>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => addPanel("new")}>
              Créer un nouveau tableau vide
            </button>
          </div>
        </div>
      </div>
    );
  }

  const copyList = async () => {
    const text = `Liste d'achat — ${target.name}\n${bomToText(lines)}\nTotal indicatif : ${euro(totals.cost)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Liste copiée dans le presse-papiers.");
    } catch {
      setCopied("Copie refusée par le navigateur : sélectionnez le tableau et copiez-le.");
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="eyebrow">Nomenclature et liste d'achat</div>
          <h2>Matériel</h2>
        </div>
        <label className="field" style={{ minWidth: 190 }}>
          <span>Nouveau tableau</span>
          <select id="bom-target" className="input" value={target.id} onChange={(e) => setMaterialPanels(source?.id, e.target.value)}>
            {targets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ minWidth: 190 }}>
          <span>Réemployer depuis</span>
          <select id="bom-source" className="input" value={source?.id ?? ""} onChange={(e) => setMaterialPanels(e.target.value || undefined, target.id)}>
            <option value="">Aucun tableau</option>
            {sources.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="kpis">
        <div className="kpi">
          <span className="muted">Articles nécessaires</span>
          <b>{totals.items}</b>
        </div>
        <div className="kpi">
          <span className="muted">Déjà en ma possession</span>
          <b>{totals.reused}</b>
        </div>
        <div className="kpi">
          <span className="muted">À acheter</span>
          <b style={{ color: "var(--accent)" }}>{totals.toBuy}</b>
        </div>
        <div className="kpi">
          <span className="muted">Budget indicatif</span>
          <b>{euro(totals.cost)}</b>
        </div>
      </div>

      <div className="row">
        <label className="check">
          <input id="bom-cross" type="checkbox" checked={project.allowCrossBrandReuse} onChange={(e) => setCrossBrand(e.target.checked)} />
          <span>Réemployer aussi les appareils d'une autre marque (vérifier la compatibilité des peignes)</span>
        </label>
        <span className="spacer" />
        <button type="button" className="btn" onClick={copyList}>
          Copier la liste d'achat
        </button>
        <button type="button" className="btn" onClick={() => exportFile(`materiel-${target.name.replace(/\W+/g, "-").toLowerCase()}.csv`, "﻿" + bomToCsv(lines), "text/csv")}>
          Exporter en CSV
        </button>
      </div>
      {copied && <p className="muted">{copied}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th>Marque · réf.</th>
              <th className="num">Besoin</th>
              <th className="num">J'ai</th>
              <th className="num">À acheter</th>
              <th className="num">Prix u.</th>
              <th className="num">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key}>
                <td>
                  <div className="eyebrow" style={{ fontSize: "0.7rem" }}>
                    {KIND_LABEL[l.kind]}
                  </div>
                  {l.label}
                  {l.reuse.length > 0 && (
                    <div className="muted" style={{ fontSize: "0.78rem" }}>
                      Réemploi : {l.reuse.join(", ")}
                    </div>
                  )}
                  {l.note && (
                    <div className="muted" style={{ fontSize: "0.78rem" }}>
                      {l.note}
                    </div>
                  )}
                </td>
                <td>
                  {l.brand}
                  <div className="mono muted" style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                    {l.ref ?? "réf. à compléter"}
                  </div>
                </td>
                <td className="num">{l.needed}</td>
                <td className="num">
                  <div className="row" style={{ justifyContent: "flex-end", gap: 4, flexWrap: "nowrap" }}>
                    <NumberInput
                      id={`owned-${l.key}`}
                      className="input qty-input"
                      value={l.owned}
                      min={0}
                      onChange={(v) => setInventory(l.key, { owned: v === undefined ? undefined : Math.max(0, Math.round(v)) })}
                    />
                    {l.ownedOverridden && (
                      <button
                        type="button"
                        className="btn ghost small icon"
                        title={`Revenir au calcul automatique (${l.autoOwned})`}
                        aria-label="Revenir au calcul automatique"
                        onClick={() => setInventory(l.key, { owned: undefined })}
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </td>
                <td className="num">
                  <span className="to-buy" data-zero={l.toBuy === 0}>
                    {l.toBuy === 0 ? "✓" : l.toBuy}
                  </span>
                </td>
                <td className="num">
                  <NumberInput
                    id={`price-${l.key}`}
                    className="input price-input"
                    value={l.unitPrice}
                    min={0}
                    step={0.5}
                    onChange={(v) => setInventory(l.key, { price: v })}
                  />
                </td>
                <td className="num">{euro(l.total)}</td>
                <td>
                  <a className="btn small ghost" href={leroyMerlinSearchUrl(l.ref ?? l.label)} target="_blank" rel="noreferrer">
                    Chercher
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total</td>
              <td className="num">{totals.items}</td>
              <td className="num">{totals.reused}</td>
              <td className="num">{totals.toBuy}</td>
              <td />
              <td className="num">{euro(totals.cost)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="muted" style={{ fontSize: "0.82rem" }}>
        Prix indicatifs relevés en grande surface de bricolage : ils varient selon les magasins et les promotions, et sont modifiables. « Chercher » ouvre
        la recherche Leroy Merlin. Pensez aussi aux fournitures hors tableau : fils de liaison 10 mm², câbles pour les circuits à recâbler, étiquettes.
      </p>
    </div>
  );
}
