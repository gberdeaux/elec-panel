import { useState } from "react";
import { findingsForDevice } from "../domain/analysis";
import { type CatalogKind, KIND_LABEL, catalogById, deviceFromCatalog } from "../domain/catalog";
import { SECTIONS, STANDARD_RATINGS, USAGES, USAGE_ORDER, expectedProtection, maxPointsFor, mm2 } from "../domain/norm";
import { deviceTitle, findDevice, isCircuitDevice, protectionMap } from "../domain/panel";
import { BRANDS, type Brand, type Circuit, type CircuitUsage, type Condition, type Curve, type Device, type Finding, type Panel, type Poles, type RcdType } from "../domain/types";
import { useStore } from "../store/store";
import { CatalogPicker } from "./CatalogPicker";
import { DeviceArt } from "./DeviceArt";
import { IconArrowRight, IconBook, IconClose, IconDuplicate, IconTrash } from "./icons";
import { Field, FindingCard, NumberInput } from "./ui";

const KINDS: CatalogKind[] = ["mcb", "rcd", "rcbo", "fuse", "spd", "contactor", "teleruptor", "switch", "timer", "socket", "blank", "other"];
const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "bon", label: "Bon état" },
  { value: "usé", label: "Usé / douteux" },
  { value: "HS", label: "Hors service" },
  { value: "inconnu", label: "Inconnu" },
];

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
  const guard = protectionMap(panel).get(device.id);
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
    <div>
      <div className="inspector-head">
        <div className="inspector-thumb">
          <DeviceArt device={device} view="full" scale={device.modules > 2 ? 0.55 : 0.85} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="overline">
            Rangée {loc ? loc.row + 1 : "?"} · position {loc ? loc.index + 1 : "?"}
          </div>
          <h2 style={{ marginTop: 3 }}>{deviceTitle(device)}</h2>
          <p className="muted small" style={{ marginTop: 2 }}>
            {device.label || (c ? USAGES[c.usage].label : "Sans étiquette")}
          </p>
          <p className="muted xsmall mono" style={{ marginTop: 4 }}>
            {device.brand ?? "Marque ?"} · {device.ref ?? item?.ref ?? "réf. à compléter"}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => select(undefined)} aria-label="Fermer l'inspecteur">
          <IconClose size={17} />
        </button>
      </div>

      <div className="inspector-section" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <div className="btn-group" role="group" aria-label="Déplacer">
          <button type="button" className="btn btn-sm btn-icon" disabled={!loc || loc.index === 0} onClick={() => loc && move(panel.id, device.id, loc.row, loc.index - 1)} aria-label="Déplacer à gauche" title="Gauche">
            ←
          </button>
          <button type="button" className="btn btn-sm btn-icon" disabled={!loc || loc.index === panel.rows[loc.row].length - 1} onClick={() => loc && move(panel.id, device.id, loc.row, loc.index + 2)} aria-label="Déplacer à droite" title="Droite">
            →
          </button>
          <button type="button" className="btn btn-sm btn-icon" disabled={!loc || loc.row === 0} onClick={() => loc && move(panel.id, device.id, loc.row - 1, panel.rows[loc.row - 1].length)} aria-label="Rangée du dessus" title="Rangée du dessus">
            ↑
          </button>
          <button type="button" className="btn btn-sm btn-icon" onClick={() => loc && move(panel.id, device.id, loc.row + 1, panel.rows[loc.row + 1]?.length ?? 0)} aria-label="Rangée du dessous" title="Rangée du dessous">
            ↓
          </button>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => setReplacing(true)}>
          Remplacer
        </button>
        <button type="button" className="btn btn-sm btn-icon" onClick={() => duplicate(panel.id, device.id)} aria-label="Dupliquer" title="Dupliquer">
          <IconDuplicate size={15} />
        </button>
        {confirmDelete ? (
          <>
            <button type="button" className="btn btn-sm btn-danger-solid" onClick={() => remove(panel.id, device.id)}>
              Supprimer
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(false)}>
              Annuler
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-sm btn-icon btn-ghost btn-danger" onClick={() => setConfirmDelete(true)} aria-label="Supprimer" title="Supprimer">
            <IconTrash size={15} />
          </button>
        )}
      </div>

      {own.length > 0 && (
        <div className="inspector-section">
          <div className="overline">Constats sur cet appareil</div>
          <div className="findings">
            {own.map((f) => (
              <FindingCard key={f.id} finding={f} onAsk={() => onAsk(`Explique-moi ce problème et comment le corriger concrètement : « ${f.title} ».`)} />
            ))}
          </div>
        </div>
      )}

      {isCircuitDevice(device) && (
        <div className="inspector-section">
          <div className="overline">Ce qui est branché dessus</div>
          <div className="form-grid">
            <Field label="Usage du circuit" full>
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
                <option value="">Non décrit</option>
                {USAGE_ORDER.map((u) => (
                  <option key={u} value={u}>
                    {USAGES[u].label}
                  </option>
                ))}
              </select>
            </Field>
            {c && spec && (
              <>
                <Field label="Pièces desservies" full>
                  <input id="circuit-rooms" className="input" value={c.rooms} placeholder="Séjour, entrée…" onChange={(e) => setCircuit({ rooms: e.target.value })} />
                </Field>
                <Field label={`Nombre de ${spec.pointsLabel}`}>
                  <NumberInput id="circuit-points" value={c.points} min={0} max={99} onChange={(v) => setCircuit({ points: v ?? 0 })} />
                </Field>
                <Field label="Section des fils">
                  <select id="circuit-section" className="input" value={c.sectionMm2 ?? ""} onChange={(e) => setCircuit({ sectionMm2: e.target.value ? Number(e.target.value) : undefined })}>
                    <option value="">Inconnue</option>
                    {SECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {mm2(s)} mm²
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Puissance" hint={spec.powerBased ? "Nécessaire pour ce circuit" : "Facultatif"} full>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <NumberInput id="circuit-power" value={c.powerW} min={0} step={100} placeholder="0" onChange={(v) => setCircuit({ powerW: v })} />
                    <span className="muted">W</span>
                  </div>
                </Field>
                <Field label="Appareils, remarques" full>
                  <textarea id="circuit-description" className="input" value={c.description ?? ""} placeholder="Ex. : 3 radiateurs de 1 500 W, sèche-serviettes…" onChange={(e) => setCircuit({ description: e.target.value || undefined })} />
                </Field>
              </>
            )}
          </div>
          {c && spec && expected && (
            <>
              <div className="recommend">
                <span style={{ flex: 1, minWidth: 180 }}>
                  Recommandé : <b className="mono">{expected.rating} A</b> en <b className="mono">{mm2(expected.section)} mm²</b>
                  {maxPoints !== undefined && !spec.dedicated && (
                    <>
                      , <b className="mono">{maxPoints}</b> {spec.pointsLabel} max
                    </>
                  )}
                </span>
                {device.rating !== expected.rating && (
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => set({ rating: expected.rating })}>
                    Passer en {expected.rating} A <IconArrowRight size={14} />
                  </button>
                )}
              </div>
              <details>
                <summary className="small" style={{ cursor: "pointer", color: "var(--brand)", fontWeight: 550 }}>
                  Règle applicable
                </summary>
                <div className="finding-norm" style={{ marginTop: 8 }}>
                  <span className="ref">
                    <IconBook size={13} /> {spec.normRef}
                  </span>
                  {spec.normText}
                </div>
              </details>
            </>
          )}
          {c?.rewire && <p className="error-text">Câble à remplacer : la section actuelle est insuffisante pour ce circuit.</p>}
        </div>
      )}

      <div className="inspector-section">
        <div className="overline">Caractéristiques</div>
        <div className="form-grid">
          <Field label="Étiquette" full>
            <input id="device-label" className="input" value={device.label ?? ""} placeholder="Texte du porte-étiquette" onChange={(e) => set({ label: e.target.value || undefined })} />
          </Field>
          <Field label="Type d'appareil" full>
            <select id="device-kind" className="input" value={device.kind} onChange={(e) => set({ kind: e.target.value as Device["kind"], catalogId: undefined })}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          {hasRating && (
            <Field label="Calibre">
              <select id="device-rating" className="input" value={device.rating ?? ""} onChange={(e) => set({ rating: e.target.value ? Number(e.target.value) : undefined, catalogId: undefined })}>
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
            </Field>
          )}
          {isBreaker && (
            <Field label="Courbe">
              <select id="device-curve" className="input" value={device.curve ?? ""} onChange={(e) => set({ curve: (e.target.value || undefined) as Curve | undefined })}>
                <option value="">?</option>
                <option>B</option>
                <option>C</option>
                <option>D</option>
              </select>
            </Field>
          )}
          {(isBreaker || device.kind === "fuse") && (
            <Field label="Pôles">
              <select id="device-poles" className="input" value={device.poles ?? ""} onChange={(e) => set({ poles: (e.target.value || undefined) as Poles | undefined })}>
                <option value="">?</option>
                <option value="1P+N">Phase + neutre</option>
                <option value="1P">Phase seule</option>
                <option value="2P">Bipolaire</option>
              </select>
            </Field>
          )}
          {isBreaker && (
            <Field label="Pouvoir de coupure">
              <select id="device-pdc" className="input" value={device.breakingCapacity ?? ""} onChange={(e) => set({ breakingCapacity: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">Inconnu</option>
                {[1500, 3000, 4500, 6000, 10000].map((v) => (
                  <option key={v} value={v}>
                    {v / 1000} kA
                  </option>
                ))}
              </select>
            </Field>
          )}
          {isResidual && (
            <>
              <Field label="Type">
                <select id="device-rcdtype" className="input" value={device.rcdType ?? "AC"} onChange={(e) => set({ rcdType: e.target.value as RcdType, catalogId: undefined })}>
                  {(["AC", "A", "A-SI", "F", "B"] as RcdType[]).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Sensibilité">
                <select id="device-sensitivity" className="input" value={device.sensitivity ?? 30} onChange={(e) => set({ sensitivity: Number(e.target.value) })}>
                  {[10, 30, 300, 500].map((v) => (
                    <option key={v} value={v}>
                      {v} mA
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field label="Largeur">
            <select id="device-modules" className="input" value={device.modules} onChange={(e) => set({ modules: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6].map((m) => (
                <option key={m} value={m}>
                  {m} module{m > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="État">
            <select id="device-condition" className="input" value={device.condition ?? "inconnu"} onChange={(e) => set({ condition: e.target.value as Condition })}>
              {CONDITIONS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Marque">
            <select id="device-brand" className="input" value={device.brand ?? ""} onChange={(e) => set({ brand: (e.target.value || undefined) as Brand | undefined })}>
              <option value="">?</option>
              {BRANDS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Field label="Référence">
            <input id="device-ref" className="input mono" value={device.ref ?? ""} onChange={(e) => set({ ref: e.target.value || undefined })} />
          </Field>
        </div>
      </div>

      {device.kind !== "rcd" && device.kind !== "rcbo" && (
        <div className="inspector-section">
          <div className="overline">Protection différentielle</div>
          <Field label="Protégé par" hint={`Actuellement : ${guard ? deviceTitle(guard) : "aucune protection différentielle"}.`}>
            <select
              id="device-protected-by"
              className="input"
              value={device.protectedBy === null ? "none" : device.protectedBy ?? "auto"}
              onChange={(e) => {
                const v = e.target.value;
                set({ protectedBy: v === "auto" ? undefined : v === "none" ? null : v });
              }}
            >
              <option value="auto">Automatique (différentiel de la rangée)</option>
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
          </Field>
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
