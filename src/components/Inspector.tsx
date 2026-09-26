import { useState } from "react";
import { findingsForDevice } from "../domain/analysis";
import { type CatalogKind, KIND_LABEL, catalogById, deviceFromCatalog } from "../domain/catalog";
import { SECTIONS, STANDARD_RATINGS, USAGES, USAGE_ORDER, expectedProtection, maxPointsFor } from "../domain/norm";
import { deviceTitle, findDevice, isCircuitDevice, protectionMap } from "../domain/panel";
import { BRANDS, type Brand, type Circuit, type CircuitUsage, type Condition, type Curve, type Device, type Finding, type Panel, type Poles, type RcdType } from "../domain/types";
import { useStore } from "../store/store";
import { CatalogPicker } from "./CatalogPicker";
import { FindingCard, NumberInput } from "./ui";

const KINDS: CatalogKind[] = ["mcb", "rcd", "rcbo", "fuse", "spd", "contactor", "teleruptor", "switch", "timer", "socket", "blank", "other"];
const CONDITIONS: Condition[] = ["bon", "usé", "HS", "inconnu"];

export function Inspector({ panel, device, findings, onAsk }: { panel: Panel; device: Device; findings: Finding[]; onAsk: (q: string) => void }) {
  const update = useStore((s) => s.updateDevice);
  const remove = useStore((s) => s.removeDevice);
  const move = useStore((s) => s.moveDevice);
  const duplicate = useStore((s) => s.duplicateDevice);
  const select = useStore((s) => s.selectDevice);
  const custom = useStore((s) => s.project.customCatalog);
  const [replacing, setReplacing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (patch: Partial<Device>) => update(panel.id, device.id, patch);
  const setCircuit = (patch: Partial<Circuit>) => {
    const base: Circuit = device.circuit ?? { usage: "prises", rooms: "", points: USAGES.prises.defaultPoints };
    set({ circuit: { ...base, ...patch } });
  };

  const loc = findDevice(panel, device.id);
  const guards = protectionMap(panel);
  const guard = guards.get(device.id);
  const rcds = panel.rows.flat().filter((d) => d.kind === "rcd");
  const own = findingsForDevice(findings, device.id);
  const item = catalogById(device.catalogId, custom);
  const hasRating = ["mcb", "rcd", "rcbo", "fuse", "contactor", "teleruptor", "switch"].includes(device.kind);
  const isBreaker = device.kind === "mcb" || device.kind === "rcbo";
  const isResidual = device.kind === "rcd" || device.kind === "rcbo";
  const c = device.circuit;
  const spec = c ? USAGES[c.usage] : undefined;
  const expected = c ? expectedProtection(c.usage, c.powerW, c.sectionMm2) : undefined;
  const maxPoints = c ? maxPointsFor(c.usage, device.rating) : undefined;

  return (
    <div className="stack">
      <div className="row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">
            Rangée {loc ? loc.row + 1 : "?"} · position {loc ? loc.index + 1 : "?"}
          </div>
          <h3>{deviceTitle(device)}</h3>
          {item && (
            <p className="muted" style={{ fontSize: "0.82rem" }}>
              {item.brand} {item.range} · <span className="mono">{device.ref ?? item.ref ?? "réf. à compléter"}</span>
            </p>
          )}
        </div>
        <button type="button" className="btn ghost icon" onClick={() => select(undefined)} aria-label="Fermer l'inspecteur">
          ✕
        </button>
      </div>

      <div className="row">
        <button type="button" className="btn small icon" disabled={!loc || loc.index === 0} onClick={() => loc && move(panel.id, device.id, loc.row, loc.index - 1)} aria-label="Déplacer à gauche">
          ←
        </button>
        <button type="button" className="btn small icon" disabled={!loc || loc.index === panel.rows[loc.row].length - 1} onClick={() => loc && move(panel.id, device.id, loc.row, loc.index + 2)} aria-label="Déplacer à droite">
          →
        </button>
        <button type="button" className="btn small icon" disabled={!loc || loc.row === 0} onClick={() => loc && move(panel.id, device.id, loc.row - 1, panel.rows[loc.row - 1].length)} aria-label="Rangée du dessus">
          ↑
        </button>
        <button type="button" className="btn small icon" onClick={() => loc && move(panel.id, device.id, loc.row + 1, panel.rows[loc.row + 1]?.length ?? 0)} aria-label="Rangée du dessous">
          ↓
        </button>
        <button type="button" className="btn small" onClick={() => duplicate(panel.id, device.id)}>
          Dupliquer
        </button>
        <button type="button" className="btn small" onClick={() => setReplacing(true)}>
          Catalogue
        </button>
        {confirmDelete ? (
          <>
            <button type="button" className="btn small danger" onClick={() => remove(panel.id, device.id)}>
              Confirmer
            </button>
            <button type="button" className="btn small ghost" onClick={() => setConfirmDelete(false)}>
              Annuler
            </button>
          </>
        ) : (
          <button type="button" className="btn small danger" onClick={() => setConfirmDelete(true)}>
            Supprimer
          </button>
        )}
      </div>

      {own.length > 0 && (
        <div className="side-section stack">
          <div className="eyebrow">Constats sur cet appareil</div>
          {own.map((f) => (
            <FindingCard key={f.id} finding={f} onAsk={() => onAsk(`Explique-moi ce problème et comment le corriger concrètement : « ${f.title} ».`)} />
          ))}
        </div>
      )}

      {isCircuitDevice(device) && (
        <div className="side-section stack">
          <div className="eyebrow">Ce qui est branché dessus</div>
          <div className="grid-fields">
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>Usage du circuit</span>
              <select
                id="circuit-usage"
                className="input"
                value={c?.usage ?? ""}
                onChange={(e) => {
                  const usage = e.target.value as CircuitUsage;
                  if (!usage) return set({ circuit: undefined });
                  setCircuit({ usage, points: c?.points ?? USAGES[usage].defaultPoints });
                }}
              >
                <option value="">— Non décrit —</option>
                {USAGE_ORDER.map((u) => (
                  <option key={u} value={u}>
                    {USAGES[u].label}
                  </option>
                ))}
              </select>
            </label>
            {c && spec && (
              <>
                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  <span>Pièces desservies</span>
                  <input id="circuit-rooms" className="input" value={c.rooms} placeholder="Séjour, entrée…" onChange={(e) => setCircuit({ rooms: e.target.value })} />
                </label>
                <label className="field">
                  <span>Nombre de {spec.pointsLabel}</span>
                  <NumberInput id="circuit-points" value={c.points} min={0} max={99} onChange={(v) => setCircuit({ points: v ?? 0 })} />
                </label>
                <label className="field">
                  <span>Section des fils</span>
                  <select
                    id="circuit-section"
                    className="input"
                    value={c.sectionMm2 ?? ""}
                    onChange={(e) => setCircuit({ sectionMm2: e.target.value ? Number(e.target.value) : undefined })}
                  >
                    <option value="">Inconnue</option>
                    {SECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {String(s).replace(".", ",")} mm²
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Puissance (W)</span>
                  <NumberInput id="circuit-power" value={c.powerW} min={0} step={100} placeholder={spec.powerBased ? "à renseigner" : "facultatif"} onChange={(v) => setCircuit({ powerW: v })} />
                </label>
                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  <span>Détail (appareils, remarques)</span>
                  <textarea id="circuit-description" className="input" value={c.description ?? ""} onChange={(e) => setCircuit({ description: e.target.value || undefined })} />
                </label>
              </>
            )}
          </div>
          {c && spec && expected && (
            <div className="norm-box">
              <span className="ref">{spec.normRef}</span>
              {spec.normText}
              <div style={{ marginTop: 6 }}>
                Recommandé ici : <b className="mono">{expected.rating} A</b> en <b className="mono">{String(expected.section).replace(".", ",")} mm²</b>
                {maxPoints !== undefined && !spec.dedicated && (
                  <>
                    , <b className="mono">{maxPoints}</b> {spec.pointsLabel} max
                  </>
                )}
                .
              </div>
              {device.rating !== expected.rating && (
                <button type="button" className="btn small" style={{ marginTop: 6 }} onClick={() => set({ rating: expected.rating })}>
                  Passer le disjoncteur en {expected.rating} A
                </button>
              )}
            </div>
          )}
          {c?.rewire && <p className="error-text">Câble à remplacer : la section actuelle est insuffisante pour ce circuit.</p>}
        </div>
      )}

      <div className="side-section stack">
        <div className="eyebrow">Caractéristiques</div>
        <div className="grid-fields">
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>Libellé (étiquette)</span>
            <input id="device-label" className="input" value={device.label ?? ""} onChange={(e) => set({ label: e.target.value || undefined })} />
          </label>
          <label className="field">
            <span>Type</span>
            <select id="device-kind" className="input" value={device.kind} onChange={(e) => set({ kind: e.target.value as Device["kind"], catalogId: undefined })}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          {hasRating && (
            <label className="field">
              <span>Calibre</span>
              <select
                id="device-rating"
                className="input"
                value={device.rating ?? ""}
                onChange={(e) => set({ rating: e.target.value ? Number(e.target.value) : undefined, catalogId: undefined })}
              >
                <option value="">?</option>
                {[...new Set([...STANDARD_RATINGS, device.rating ?? 0])]
                  .filter(Boolean)
                  .sort((a, b) => a - b)
                  .map((r) => (
                    <option key={r} value={r}>
                      {r} A
                    </option>
                  ))}
              </select>
            </label>
          )}
          {isBreaker && (
            <>
              <label className="field">
                <span>Courbe</span>
                <select id="device-curve" className="input" value={device.curve ?? ""} onChange={(e) => set({ curve: (e.target.value || undefined) as Curve | undefined })}>
                  <option value="">?</option>
                  <option>B</option>
                  <option>C</option>
                  <option>D</option>
                </select>
              </label>
              <label className="field">
                <span>Pouvoir de coupure</span>
                <select
                  id="device-pdc"
                  className="input"
                  value={device.breakingCapacity ?? ""}
                  onChange={(e) => set({ breakingCapacity: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">Inconnu</option>
                  {[1500, 3000, 4500, 6000, 10000].map((v) => (
                    <option key={v} value={v}>
                      {v / 1000} kA
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {(isBreaker || device.kind === "fuse") && (
            <label className="field">
              <span>Pôles</span>
              <select id="device-poles" className="input" value={device.poles ?? ""} onChange={(e) => set({ poles: (e.target.value || undefined) as Poles | undefined })}>
                <option value="">?</option>
                <option value="1P+N">Phase + neutre</option>
                <option value="1P">Phase seule</option>
                <option value="2P">Bipolaire</option>
              </select>
            </label>
          )}
          {isResidual && (
            <>
              <label className="field">
                <span>Type</span>
                <select id="device-rcdtype" className="input" value={device.rcdType ?? "AC"} onChange={(e) => set({ rcdType: e.target.value as RcdType, catalogId: undefined })}>
                  {(["AC", "A", "A-SI", "F", "B"] as RcdType[]).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Sensibilité</span>
                <select id="device-sensitivity" className="input" value={device.sensitivity ?? 30} onChange={(e) => set({ sensitivity: Number(e.target.value) })}>
                  {[10, 30, 300, 500].map((v) => (
                    <option key={v} value={v}>
                      {v} mA
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="field">
            <span>Largeur (modules)</span>
            <NumberInput id="device-modules" value={device.modules} min={1} max={12} onChange={(v) => set({ modules: Math.max(1, Math.round(v ?? 1)) })} />
          </label>
          <label className="field">
            <span>État</span>
            <select id="device-condition" className="input" value={device.condition ?? "inconnu"} onChange={(e) => set({ condition: e.target.value as Condition })}>
              {CONDITIONS.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Marque</span>
            <select id="device-brand" className="input" value={device.brand ?? ""} onChange={(e) => set({ brand: (e.target.value || undefined) as Brand | undefined })}>
              <option value="">?</option>
              {BRANDS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Référence</span>
            <input id="device-ref" className="input mono" value={device.ref ?? ""} onChange={(e) => set({ ref: e.target.value || undefined })} />
          </label>
        </div>
      </div>

      {device.kind !== "rcd" && device.kind !== "rcbo" && (
        <div className="side-section stack">
          <div className="eyebrow">Protection différentielle</div>
          <label className="field">
            <span>Protégé par</span>
            <select
              id="device-protected-by"
              className="input"
              value={device.protectedBy === null ? "none" : device.protectedBy ?? "auto"}
              onChange={(e) => {
                const v = e.target.value;
                set({ protectedBy: v === "auto" ? undefined : v === "none" ? null : v });
              }}
            >
              <option value="auto">Automatique (différentiel à gauche dans la rangée)</option>
              {rcds.map((r) => {
                const l = findDevice(panel, r.id);
                return (
                  <option key={r.id} value={r.id}>
                    {deviceTitle(r)} — rangée {l ? l.row + 1 : "?"}
                  </option>
                );
              })}
              <option value="none">Aucun différentiel</option>
            </select>
          </label>
          <p className="muted" style={{ fontSize: "0.82rem" }}>
            Actuellement : {guard ? deviceTitle(guard) : "aucune protection différentielle"}.
          </p>
        </div>
      )}

      {replacing && (
        <CatalogPicker
          brand={device.brand && device.brand !== "Générique" ? device.brand : panel.enclosure.brand}
          title="Remplacer par un article du catalogue"
          onClose={() => setReplacing(false)}
          onPick={(picked) => {
            const next = deviceFromCatalog(picked);
            set({ ...next, label: device.label, circuit: device.circuit, protectedBy: device.protectedBy, condition: "bon" });
            setReplacing(false);
          }}
        />
      )}
    </div>
  );
}
