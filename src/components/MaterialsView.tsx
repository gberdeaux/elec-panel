import { useMemo, useState } from "react";
import { type BomLine, type Leftover, bomToCsv, bomToText, bomTotals, computeBom, leftoversFrom } from "../domain/bom";
import { KIND_LABEL, catalogById, leroyMerlinSearchUrl } from "../domain/catalog";
import { exportFile } from "../store/persistence";
import { useStore } from "../store/store";
import { repereMap } from "../domain/panel";
import { CatalogArt } from "./CatalogPicker";
import { DeviceArt } from "./DeviceArt";
import { IconBox, IconCopy, IconDownload, IconExternal, IconPlus, IconUndo } from "./icons";
import { Field, NumberInput, Switch, euro, toast } from "./ui";

function EnclosureThumb() {
  return (
    <svg width="40" height="44" viewBox="0 0 40 44" aria-hidden="true">
      <rect x="1" y="1" width="38" height="42" rx="5" fill="#f7f7f3" stroke="#c9cbc4" />
      <rect x="5" y="7" width="30" height="7" rx="1" fill="#1d2024" />
      <rect x="5" y="18" width="30" height="7" rx="1" fill="#1d2024" />
      <rect x="5" y="29" width="30" height="7" rx="1" fill="#e6e6e0" />
    </svg>
  );
}

function Thumb({ line }: { line: BomLine }) {
  const custom = useStore((s) => s.project.customCatalog);
  const item = catalogById(line.catalogId, custom);
  if (line.kind === "enclosure") return <EnclosureThumb />;
  if (line.kind === "comb") {
    return (
      <svg width="46" height="20" viewBox="0 0 46 20" aria-hidden="true">
        <rect x="1" y="3" width="44" height="7" rx="1.5" fill="#62676e" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={3 + i * 5.4} y="10" width="2.4" height="6" fill="#c7803d" />
        ))}
      </svg>
    );
  }
  if (item) return <CatalogArt item={item} scale={0.95} />;
  return <IconBox />;
}

const LEFTOVER_TONE: Record<Leftover["reason"], { tone: string; label: string }> = {
  hs: { tone: "danger", label: "Hors service" },
  use: { tone: "avertissement", label: "Usé" },
  nonconforme: { tone: "nonconforme", label: "Non conforme" },
  "autre-marque": { tone: "conseil", label: "Autre marque" },
  remplace: { tone: "brand", label: "Remplacé" },
  surplus: { tone: "brand", label: "En surplus" },
  inutile: { tone: "brand", label: "Plus utile" },
  obturateur: { tone: "conseil", label: "Sans usage" },
};

/** Matériel de l'ancien tableau que le nouveau ne reprend pas. */
function Leftovers({ items, reperes }: { items: Leftover[]; reperes: Map<string, string> }) {
  const recyclable = items.filter((l) => l.device && ["remplace", "surplus", "inutile", "autre-marque"].includes(l.reason)).length;
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Matériel de l'ancien tableau non réutilisé</h2>
          <p className="muted small">
            {items.length === 0
              ? "Tout le matériel de l'ancien tableau est repris dans le nouveau."
              : `${items.length} élément${items.length > 1 ? "s" : ""} retiré${items.length > 1 ? "s" : ""}${recyclable ? `, dont ${recyclable} en bon état à garder en dépannage ou à revendre` : ""}.`}
          </p>
        </div>
      </div>
      {items.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Appareil</th>
                <th>Repère</th>
                <th>Rangée</th>
                <th>Raison</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l, i) => {
                const tone = LEFTOVER_TONE[l.reason];
                return (
                  <tr key={l.device?.id ?? `enc-${i}`}>
                    <td>
                      <div className="product">
                        <span className="product-thumb">{l.device ? <DeviceArt device={l.device} view="front" scale={l.device.modules > 2 ? 0.66 : 0.95} /> : <EnclosureThumb />}</span>
                        <b>{l.label}</b>
                      </div>
                    </td>
                    <td className="mono">{l.device ? reperes.get(l.device.id) ?? "—" : "—"}</td>
                    <td>{l.row === undefined ? "—" : `Rangée ${l.row + 1}`}</td>
                    <td>
                      <span className="badge" data-tone={tone.tone}>
                        {tone.label}
                      </span>
                      <div className="muted xsmall" style={{ marginTop: 4 }}>
                        {l.detail}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function MaterialsView() {
  const project = useStore((s) => s.project);
  const setMaterialPanels = useStore((s) => s.setMaterialPanels);
  const setInventory = useStore((s) => s.setInventory);
  const setCrossBrand = useStore((s) => s.setCrossBrand);
  const addPanel = useStore((s) => s.addPanel);

  const targets = project.panels.filter((p) => p.role === "new");
  const sources = project.panels.filter((p) => p.role === "existing");
  const target = project.panels.find((p) => p.id === project.targetPanelId && p.role === "new") ?? targets[0];
  const source = project.panels.find((p) => p.id === project.sourcePanelId && p.role === "existing") ?? sources[0];

  const lines = useMemo(() => (target ? computeBom(project, target, source) : []), [project, target, source]);
  const leftovers = useMemo(() => (target && source ? leftoversFrom(project, target, source) : []), [project, target, source]);
  const reperes = useMemo(() => (source ? repereMap(source) : new Map<string, string>()), [source]);
  const totals = bomTotals(lines);
  const [filter, setFilter] = useState<"all" | "buy" | "stock">("all");
  const toBuyLines = lines.filter((l) => l.toBuy > 0);
  const bought = toBuyLines.filter((l) => project.inventory[l.key]?.bought).length;
  const shown = lines.filter((l) => (filter === "buy" ? l.toBuy > 0 : filter === "stock" ? l.toBuy === 0 : true));

  if (!target) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>Matériel et achats</h1>
            <p className="sub">La liste de matériel se calcule à partir d'un nouveau tableau.</p>
          </div>
        </div>
        <div className="card empty">
          <span className="empty-icon">
            <IconBox />
          </span>
          <h3>Pas encore de nouveau tableau</h3>
          <p>Générez-le depuis votre tableau existant, ou créez-en un vide pour le composer vous-même.</p>
          <button type="button" className="btn btn-primary" onClick={() => addPanel("new")}>
            <IconPlus size={16} /> Créer un nouveau tableau
          </button>
        </div>
      </div>
    );
  }

  const copyList = async () => {
    const text = `Liste d'achat — ${target.name}\n${bomToText(lines)}\nTotal indicatif : ${euro(totals.cost)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast("Liste d'achat copiée");
    } catch {
      toast("Copie refusée par le navigateur");
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Matériel et achats</h1>
          <p className="sub">Ce qu'il faut pour « {target.name} », ce que vous avez déjà et ce qu'il reste à acheter.</p>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={copyList}>
            <IconCopy size={16} /> Copier la liste
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              const ok = await exportFile(`materiel-${target.name.replace(/\W+/g, "-").toLowerCase()}.csv`, "﻿" + bomToCsv(lines), "text/csv");
              if (ok) toast("Liste exportée en CSV");
            }}
          >
            <IconDownload size={16} /> Exporter en CSV
          </button>
        </div>
      </div>

      <div className="stack-lg">
        <div className="grid-4">
          <div className="card kpi">
            <span className="kpi-label">Articles nécessaires</span>
            <span className="kpi-value">{totals.items}</span>
            <span className="kpi-foot">{lines.length} références différentes</span>
          </div>
          <div className="card kpi">
            <span className="kpi-label">Déjà en ma possession</span>
            <span className="kpi-value" style={{ color: "var(--ok)" }}>
              {totals.reused}
            </span>
            <span className="kpi-foot">réemploi et stock saisi</span>
          </div>
          <div className="card kpi">
            <span className="kpi-label">À acheter</span>
            <span className="kpi-value" style={{ color: "var(--brand)" }}>
              {totals.toBuy}
            </span>
            <span className="kpi-foot">articles</span>
          </div>
          <div className="card kpi">
            <span className="kpi-label">Budget indicatif</span>
            <span className="kpi-value">{euro(totals.cost)}</span>
            <span className="kpi-foot">prix grande surface TTC</span>
          </div>
        </div>

        <section className="card">
          <div className="card-head" style={{ flexWrap: "wrap", gap: 16 }}>
            <Field label="Nouveau tableau">
              <select id="bom-target" className="input" value={target.id} onChange={(e) => setMaterialPanels(source?.id, e.target.value)}>
                {targets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Réemployer depuis">
              <select id="bom-source" className="input" value={source?.id ?? ""} onChange={(e) => setMaterialPanels(e.target.value || undefined, target.id)}>
                <option value="">Aucun tableau</option>
                {sources.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <div style={{ flex: 1, minWidth: 260 }}>
              <Switch
                id="bom-cross"
                checked={project.allowCrossBrandReuse}
                onChange={setCrossBrand}
                label="Réemployer les autres marques"
                hint="Vérifiez alors la compatibilité des peignes d'alimentation."
              />
            </div>
          </div>
          <div className="board-bar" style={{ gap: 16 }}>
            <div className="segmented" role="group" aria-label="Filtrer">
              <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                Tout <span className="count">{lines.length}</span>
              </button>
              <button type="button" aria-pressed={filter === "buy"} onClick={() => setFilter("buy")}>
                À acheter <span className="count">{toBuyLines.length}</span>
              </button>
              <button type="button" aria-pressed={filter === "stock"} onClick={() => setFilter("stock")}>
                Déjà en stock <span className="count">{lines.length - toBuyLines.length}</span>
              </button>
            </div>
            <span className="spacer" />
            {toBuyLines.length > 0 && (
              <div className="row" style={{ gap: 10, minWidth: 220 }}>
                <span className="small muted">
                  Courses : <b className="mono" style={{ color: "var(--text)" }}>{bought}</b>/{toBuyLines.length} achetés
                </span>
                <div className="progress" style={{ width: 120 }}>
                  <span style={{ width: `${(bought / toBuyLines.length) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th aria-label="Acheté" style={{ width: 44 }} />
                  <th>Article</th>
                  <th>Marque · référence</th>
                  <th className="r">Besoin</th>
                  <th className="r">J'ai</th>
                  <th className="r">À acheter</th>
                  <th className="r">Prix unitaire</th>
                  <th className="r">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.key} data-bought={l.toBuy > 0 && !!project.inventory[l.key]?.bought}>
                    <td>
                      {l.toBuy > 0 && (
                        <input
                          type="checkbox"
                          className="check-buy"
                          aria-label={`${l.label} acheté`}
                          checked={!!project.inventory[l.key]?.bought}
                          onChange={(e) => setInventory(l.key, { bought: e.target.checked || undefined })}
                        />
                      )}
                    </td>
                    <td>
                      <div className="product">
                        <span className="product-thumb">
                          <Thumb line={l} />
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span className="overline" style={{ fontSize: "0.66rem" }}>
                            {KIND_LABEL[l.kind]}
                          </span>
                          <b>{l.label}</b>
                          {l.reuse.length > 0 && <span className="muted xsmall">Réemploi : {l.reuse.join(", ")}</span>}
                          {l.note && (
                            <span className="muted xsmall" style={{ display: "block" }}>
                              {l.note}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {l.brand}
                      <div className="mono muted xsmall">{l.ref ?? "réf. à compléter"}</div>
                    </td>
                    <td className="r">{l.needed}</td>
                    <td className="r">
                      <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap", gap: 4 }}>
                        {l.ownedOverridden && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon btn-sm"
                            title={`Revenir au calcul automatique (${l.autoOwned})`}
                            aria-label="Revenir au calcul automatique"
                            onClick={() => setInventory(l.key, { owned: undefined })}
                          >
                            <IconUndo size={14} />
                          </button>
                        )}
                        <NumberInput
                          id={`owned-${l.key}`}
                          className="input input-sm qty-input"
                          value={l.owned}
                          min={0}
                          onChange={(val) => setInventory(l.key, { owned: val === undefined ? undefined : Math.max(0, Math.round(val)) })}
                        />
                      </div>
                    </td>
                    <td className="r">
                      <span className="buy" data-zero={l.toBuy === 0}>
                        {l.toBuy === 0 ? "✓" : l.toBuy}
                      </span>
                    </td>
                    <td className="r">
                      <NumberInput id={`price-${l.key}`} className="input input-sm price-input" value={l.unitPrice} min={0} step={0.5} onChange={(val) => setInventory(l.key, { price: val })} />
                    </td>
                    <td className="r">{euro(l.total)}</td>
                    <td>
                      <a className="btn btn-ghost btn-sm" href={leroyMerlinSearchUrl(l.ref ?? l.label)} target="_blank" rel="noreferrer" title="Rechercher chez Leroy Merlin">
                        <IconExternal size={15} /> Leroy Merlin
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td className="r">{totals.items}</td>
                  <td className="r">{totals.reused}</td>
                  <td className="r">{totals.toBuy}</td>
                  <td />
                  <td className="r">{euro(totals.cost)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
        {source && <Leftovers items={leftovers} reperes={reperes} />}
        <p className="muted xsmall">
          Prix indicatifs, modifiables : ils varient selon les magasins et les promotions. Pensez aussi aux fournitures hors tableau : fils de liaison 10 mm²,
          câbles des circuits à recâbler, étiquettes.
        </p>
      </div>
    </div>
  );
}
