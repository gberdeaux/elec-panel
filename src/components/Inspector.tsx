import { useState } from "react";
import { findingsForDevice, rcdLoadReport, suitableRcdRating } from "../domain/analysis";
import { type CatalogKind, KIND_LABEL, deviceFromCatalog } from "../domain/catalog";
import { SECTIONS, STANDARD_RATINGS, USAGES, USAGE_ORDER, expectedProtection, maxPointsFor, mm2, recommendedRating as recommendRating } from "../domain/norm";
import { deviceTitle, findDevice, isCircuitDevice, protectionMap, repereMap } from "../domain/panel";
import { BRANDS, type Brand, type Circuit, type CircuitUsage, type Condition, type Curve, type Device, type Finding, type Panel, type Poles, type RcdType } from "../domain/types";
import { useStore } from "../store/store";
import { CatalogPicker } from "./CatalogPicker";
import { DeviceArt } from "./DeviceArt";
import { IconArrowRight, IconBook, IconCheck, IconChevronRight, IconClose, IconDuplicate, IconTrash, Picto } from "./icons";
import { Chips, Field, FindingCard, NumberInput, Stepper } from "./ui";

const KINDS: CatalogKind[] = ["mcb", "rcd", "rcbo", "fuse", "spd", "contactor", "teleruptor", "switch", "timer", "socket", "blank", "other"];

const SHORT: Partial<Record<CircuitUsage, string>> = {
  prises_cuisine: "Prises cuisine",
  plaque: "Plaque cuisson",
  chauffe_eau: "Chauffe-eau",
  irve_prise: "Prise VE",
  irve_borne: "Borne VE",
  pac_clim: "PAC / clim",
  chaudiere: "Chaudière",
  adoucisseur: "Adoucisseur",
  tableau_secondaire: "Tableau secondaire",
  exterieur: "Extérieur",
  informatique: "Informatique",
  volets: "Volets",
  chauffage: "Radiateurs",
  lave_linge: "Lave-linge",
  lave_vaisselle: "Lave-vaisselle",
  seche_linge: "Sèche-linge",
  congelateur: "Congélateur",
  refrigerateur: "Réfrigérateur",
  micro_ondes: "Micro-ondes",
};

const SECTION_HELP =
  "1,5 mm² : fil fin (Ø 1,4 mm), éclairage et prises en 16 A. 2,5 mm² : Ø 1,8 mm, prises 20 A et gros appareils. 6 mm² : Ø 2,8 mm, plaque de cuisson. La section est souvent imprimée sur la gaine du câble (ex. 3G2,5).";

export function Inspector({ panel, device, findings, onAsk }: { panel: Panel; device: Device; findings: Finding[]; onAsk: (q: string) => void }) {
  const update = useStore((s) => s.updateDevice);
  const remove = useStore((s) => s.removeDevice);
  const move = useStore((s) => s.moveDevice);
  const duplicate = useStore((s) => s.duplicateDevice);
  const select = useStore((s) => s.selectDevice);
  const [replacing, setReplacing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [changingUsage, setChangingUsage] = useState(false);

  const set = (patch: Partial<Device>) => update(panel.id, device.id, patch);
  const setCircuit = (patch: Partial<Circuit>) => {
    const base: Circuit = device.circuit ?? { usage: "prises", rooms: "", points: USAGES.prises.defaultPoints };
    set({ circuit: { ...base, ...patch } });
  };

  const loc = findDevice(panel, device.id);
  const repere = repereMap(panel).get(device.id);
  const guard = protectionMap(panel).get(device.id);
  const rcds = panel.rows.flat().filter((d) => d.kind === "rcd");
  const own = findingsForDevice(findings, device.id);
  const hasRating = ["mcb", "rcd", "rcbo", "fuse", "contactor", "teleruptor", "switch"].includes(device.kind);
  const isBreaker = device.kind === "mcb" || device.kind === "rcbo";
  const isResidual = device.kind === "rcd" || device.kind === "rcbo";
  const c = device.circuit;
  const spec = c ? USAGES[c.usage] : undefined;
  const expected = c ? expectedProtection(c.usage, c.powerW, c.sectionMm2) : undefined;
  const maxPoints = c ? maxPointsFor(c.usage, device.rating) : undefined;
  const recommendedRating = c ? recommendRating(c.usage, device.rating, c.sectionMm2, c.powerW) : undefined;
  const showTiles = isCircuitDevice(device) && (!c || changingUsage);

  return (
    <div>
      <div className="inspector-head">
        <div className="inspector-thumb">
          <DeviceArt device={device} view="front" scale={device.modules > 2 ? 0.95 : 1.55} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="overline">
            {repere ?? "—"} · rangée {loc ? loc.row + 1 : "?"}
          </div>
          <h2 style={{ marginTop: 4 }}>{deviceTitle(device)}</h2>
          <p className="muted small" style={{ marginTop: 2 }}>
            {device.brand ?? "Marque ?"} · <span className="mono">{device.ref ?? "réf. à compléter"}</span>
          </p>
          <div className="row" style={{ marginTop: 10, gap: 4 }}>
            <div className="btn-group" role="group" aria-label="Déplacer">
              <button type="button" className="btn btn-sm btn-icon" disabled={!loc || loc.index === 0} onClick={() => loc && move(panel.id, device.id, loc.row, loc.index - 1)} aria-label="Vers la gauche" title="Vers la gauche">
                ←
              </button>
              <button type="button" className="btn btn-sm btn-icon" disabled={!loc || loc.index === panel.rows[loc.row].length - 1} onClick={() => loc && move(panel.id, device.id, loc.row, loc.index + 2)} aria-label="Vers la droite" title="Vers la droite">
                →
              </button>
              <button type="button" className="btn btn-sm btn-icon" disabled={!loc || loc.row === 0} onClick={() => loc && move(panel.id, device.id, loc.row - 1, panel.rows[loc.row - 1].length)} aria-label="Rangée du dessus" title="Rangée du dessus">
                ↑
              </button>
              <button type="button" className="btn btn-sm btn-icon" onClick={() => loc && move(panel.id, device.id, loc.row + 1, panel.rows[loc.row + 1]?.length ?? 0)} aria-label="Rangée du dessous" title="Rangée du dessous">
                ↓
              </button>
            </div>
            <button type="button" className="btn btn-sm btn-icon" onClick={() => duplicate(panel.id, device.id)} aria-label="Dupliquer" title="Dupliquer">
              <IconDuplicate size={15} />
            </button>
            {confirmDelete ? (
              <button type="button" className="btn btn-sm btn-danger-solid" onClick={() => remove(panel.id, device.id)}>
                Confirmer
              </button>
            ) : (
              <button type="button" className="btn btn-sm btn-icon btn-ghost btn-danger" onClick={() => setConfirmDelete(true)} aria-label="Supprimer" title="Supprimer">
                <IconTrash size={15} />
              </button>
            )}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => select(undefined)} aria-label="Fermer">
          <IconClose size={17} />
        </button>
      </div>

      {isCircuitDevice(device) && (
        <div className="inspector-section">
          <div className="section-title">
            <h3>Qu'est-ce qui est branché dessus ?</h3>
          </div>
          {showTiles ? (
            <div className="usage-grid">
              {USAGE_ORDER.map((u) => (
                <button
                  key={u}
                  type="button"
                  className="usage-tile"
                  aria-pressed={c?.usage === u}
                  onClick={() => {
                    setCircuit({ usage: u, points: c?.usage === u ? c.points : USAGES[u].defaultPoints, sectionMm2: c?.sectionMm2 });
                    setChangingUsage(false);
                  }}
                >
                  <Picto kind={u} size={20} />
                  {SHORT[u] ?? USAGES[u].label}
                </button>
              ))}
            </div>
          ) : (
            c &&
            spec && (
              <>
                <div className="usage-summary">
                  <span className="usage-icon">
                    <Picto kind={c.usage} size={20} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{spec.label}</b>
                    <div className="muted xsmall">{spec.normRef}</div>
                  </div>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setChangingUsage(true)}>
                    Changer
                  </button>
                </div>
                <Field label="Pièces desservies">
                  <input id="circuit-rooms" className="input" value={c.rooms} placeholder="Séjour, entrée…" onChange={(e) => setCircuit({ rooms: e.target.value })} />
                </Field>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <span id="circuit-points-label" className="small" style={{ fontWeight: 600 }}>
                    Nombre de {spec.pointsLabel}
                  </span>
                  <Stepper id="circuit-points" value={c.points} onChange={(v) => setCircuit({ points: v })} />
                </div>
                {maxPoints !== undefined && !spec.dedicated && (
                  <span className="limit" data-over={c.points > maxPoints}>
                    {c.points > maxPoints ? `Trop de ${spec.pointsLabel} : ${maxPoints} maximum en ${device.rating} A.` : `Maximum ${maxPoints} ${spec.pointsLabel} en ${device.rating} A.`}
                  </span>
                )}
                <Field label="Section des fils">
                  <Chips
                    label="Section des fils"
                    value={c.sectionMm2 ?? 0}
                    recommended={expected?.section}
                    options={[...SECTIONS.map((s) => ({ value: s, label: mm2(s) })), { value: 0, label: "?" }]}
                    onChange={(v) => setCircuit({ sectionMm2: v || undefined })}
                  />
                </Field>
                <details>
                  <summary className="xsmall" style={{ cursor: "pointer", color: "var(--link)", fontWeight: 600 }}>
                    Comment reconnaître la section ?
                  </summary>
                  <p className="helpbox" style={{ marginTop: 6 }}>
                    {SECTION_HELP}
                  </p>
                </details>
                {(spec.powerBased || c.usage === "chauffage" || c.powerW) && (
                  <Field label="Puissance totale" hint={c.usage === "chauffage" ? "Additionnez la puissance des radiateurs de ce circuit." : undefined}>
                    <div className="row" style={{ flexWrap: "nowrap" }}>
                      <NumberInput id="circuit-power" value={c.powerW} min={0} step={100} placeholder="0" onChange={(v) => setCircuit({ powerW: v })} />
                      <span className="muted">W</span>
                    </div>
                  </Field>
                )}
                {expected && recommendedRating !== undefined && (
                  <div className="recommend" data-ok={device.rating === recommendedRating}>
                    {device.rating === recommendedRating ? <IconCheck size={16} /> : null}
                    <span style={{ flex: 1, minWidth: 170 }}>
                      {device.rating === recommendedRating ? (
                        <>
                          Calibre adapté : <b className="mono">{recommendedRating} A</b>
                        </>
                      ) : (
                        <>
                          Calibre conseillé : <b className="mono">{recommendedRating} A</b> (actuellement {device.rating ?? "?"} A)
                        </>
                      )}
                    </span>
                    {device.rating !== recommendedRating && (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => set({ rating: recommendedRating })}>
                        Appliquer <IconArrowRight size={14} />
                      </button>
                    )}
                  </div>
                )}
                <details>
                  <summary className="xsmall" style={{ cursor: "pointer", color: "var(--link)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <IconBook size={13} /> Règle de la norme
                  </summary>
                  <p className="helpbox" style={{ marginTop: 6 }}>
                    {spec.normText}
                  </p>
                </details>
                <Field label="Remarques">
                  <textarea id="circuit-description" className="input" value={c.description ?? ""} placeholder="Ex. : 3 radiateurs de 1 500 W, sèche-serviettes…" onChange={(e) => setCircuit({ description: e.target.value || undefined })} />
                </Field>
                {c.rewire && <p className="error-text">Câble à remplacer : la section actuelle est insuffisante.</p>}
              </>
            )
          )}
        </div>
      )}

      {device.kind === "rcd" && <RcdLoadSection panel={panel} device={device} />}

      {own.length > 0 && (
        <div className="inspector-section">
          <h3>Constats sur {repere ?? "cet appareil"}</h3>
          <div className="findings">
            {own.map((f) => (
              <FindingCard key={f.id} finding={f} onAsk={() => onAsk(`Explique-moi ce problème et comment le corriger concrètement : « ${f.title} ».`)} />
            ))}
          </div>
        </div>
      )}

      <div className="inspector-section">
        <h3>Appareil</h3>
        {hasRating && (
          <Field label="Calibre">
            <Chips
              label="Calibre"
              value={device.rating}
              recommended={recommendedRating}
              options={(isResidual && device.kind === "rcd" ? [25, 40, 63] : STANDARD_RATINGS.filter((r) => r <= 63)).map((r) => ({ value: r, label: `${r} A` }))}
              onChange={(v) => set({ rating: v, catalogId: undefined })}
            />
          </Field>
        )}
        {isResidual && (
          <>
            <Field label="Type de différentiel">
              <Chips
                label="Type"
                text
                value={device.rcdType ?? "AC"}
                options={(["AC", "A", "A-SI", "F", "B"] as RcdType[]).map((t) => ({ value: t, label: t }))}
                onChange={(v) => set({ rcdType: v, catalogId: undefined })}
              />
            </Field>
            <Field label="Sensibilité">
              <Chips label="Sensibilité" value={device.sensitivity ?? 30} options={[30, 300, 500].map((v) => ({ value: v, label: `${v} mA` }))} onChange={(v) => set({ sensitivity: v })} />
            </Field>
          </>
        )}
        <Field label="État">
          <Chips
            label="État"
            text
            value={device.condition ?? "inconnu"}
            options={[
              { value: "bon" as Condition, label: "Bon" },
              { value: "usé" as Condition, label: "Usé" },
              { value: "HS" as Condition, label: "Hors service" },
              { value: "inconnu" as Condition, label: "?" },
            ]}
            onChange={(v) => set({ condition: v })}
          />
        </Field>
        <Field label="Texte de l'étiquette">
          <input id="device-label" className="input" value={device.label ?? ""} placeholder={c ? USAGES[c.usage].label : "Étiquette"} onChange={(e) => set({ label: e.target.value || undefined })} />
        </Field>
        <details>
          <summary className="small" style={{ cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconChevronRight size={14} /> Caractéristiques détaillées
          </summary>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <Field label="Type d'appareil" full>
              <select id="device-kind" className="input" value={device.kind} onChange={(e) => set({ kind: e.target.value as Device["kind"], catalogId: undefined })}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
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
            <Field label="Largeur">
              <select id="device-modules" className="input" value={device.modules} onChange={(e) => set({ modules: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 6].map((m) => (
                  <option key={m} value={m}>
                    {m} module{m > 1 ? "s" : ""}
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
            {device.kind !== "rcd" && device.kind !== "rcbo" && (
              <Field label="Protégé par" full hint={`Actuellement : ${guard ? deviceTitle(guard) : "aucune protection différentielle"}.`}>
                <select
                  id="device-protected-by"
                  className="input"
                  value={device.protectedBy === null ? "none" : device.protectedBy ?? "auto"}
                  onChange={(e) => {
                    const val = e.target.value;
                    set({ protectedBy: val === "auto" ? undefined : val === "none" ? null : val });
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
            )}
          </div>
        </details>
        <button type="button" className="btn btn-sm" onClick={() => setReplacing(true)}>
          Remplacer par un article du catalogue
        </button>
      </div>

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

function RcdLoadSection({ panel, device }: { panel: Panel; device: Device }) {
  const house = useStore((s) => s.project.house);
  const update = useStore((s) => s.updateDevice);
  const r = rcdLoadReport(panel, device, house);
  const ok = r.status !== "insuffisant";
  const nextRating = suitableRcdRating(r.load, r.agcp);
  return (
    <div className="inspector-section">
      <h3>Charge du différentiel</h3>
      <div className="delta" style={{ gridTemplateColumns: "minmax(0, 1fr) auto", gap: "6px 14px", fontSize: "0.86rem" }}>
        <span>Circuits protégés</span>
        <b className="mono" style={{ color: r.circuits > 8 ? "var(--danger)" : undefined }}>{r.circuits} / 8</b>
        <span>Somme brute des disjoncteurs</span>
        <span className="mono muted">{r.rawSum} A</span>
        <span>Charge calculée (norme)</span>
        <b className="mono">{Math.round(r.load)} A</b>
        <span>Calibre du différentiel</span>
        <b className="mono">{r.rating ?? "?"} A</b>
        <span>Disjoncteur de branchement</span>
        <span className="mono muted">{r.agcp} A</span>
      </div>
      <div className="recommend" data-ok={ok}>
        {ok && <IconCheck size={16} />}
        <span style={{ flex: 1, minWidth: 180 }}>
          {r.status === "amont" && <>Conforme : le différentiel est au moins égal au disjoncteur de branchement ({r.agcp} A), quelle que soit la charge en aval.</>}
          {r.status === "aval" && <>Conforme : la charge calculée ({Math.round(r.load)} A) ne dépasse pas le calibre du différentiel.</>}
          {r.status === "insuffisant" && (
            <>
              Calibre insuffisant : {Math.round(r.load)} A de charge calculée pour un différentiel de {r.rating ?? "?"} A, inférieur au disjoncteur de branchement ({r.agcp} A).
            </>
          )}
        </span>
        {r.status === "insuffisant" && nextRating && nextRating !== r.rating && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => update(panel.id, device.id, { rating: nextRating, catalogId: undefined })}>
            Passer en {nextRating} A
          </button>
        )}
        {r.status === "insuffisant" && !nextRating && <span className="small">Répartissez des circuits sur un autre différentiel.</span>}
      </div>
      <details>
        <summary className="xsmall" style={{ cursor: "pointer", color: "var(--link)", fontWeight: 600 }}>
          Comment est calculée la charge ?
        </summary>
        <p className="helpbox" style={{ marginTop: 6 }}>
          La somme brute des disjoncteurs n'est pas le bon critère : tous les circuits ne consomment pas leur calibre en même temps. La norme retient 100 % des disjoncteurs de chauffage et de chauffe-eau et 50 % des autres (règle de l'aval). Le différentiel est aussi conforme s'il est au moins égal au calibre du disjoncteur de branchement (règle de l'amont).
        </p>
      </details>
    </div>
  );
}
