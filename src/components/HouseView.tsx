import { type ReactNode, useEffect, useRef, useState } from "react";
import { surgeProtection } from "../domain/analysis";
import type { House } from "../domain/types";
import { useDraftGuard } from "../store/draft";
import { useStore } from "../store/store";
import { IconCheck, IconInfo } from "./icons";
import { Badge, Field, NumberInput, Switch, toast } from "./ui";

const SPD = {
  obligatoire: { tone: "nonconforme", label: "Parafoudre obligatoire" },
  recommande: { tone: "conseil", label: "Parafoudre recommandé" },
  facultatif: { tone: "ok", label: "Parafoudre facultatif" },
} as const;

function Section({ title, text, aside, children }: { title: string; text: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card settings">
      <div className="settings-intro">
        <h2>{title}</h2>
        <p className="muted small">{text}</p>
        {aside}
      </div>
      <div className="settings-fields">{children}</div>
    </section>
  );
}

export function HouseView() {
  const house = useStore((s) => s.project.house);
  const update = useStore((s) => s.updateHouse);
  const [draft, setDraft] = useState<House>(house);
  const set = (patch: Partial<House>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = (Object.keys({ ...house, ...draft }) as (keyof House)[]).some((k) => k !== "validatedAt" && house[k] !== draft[k]);
  const validated = !!house.validatedAt;
  const spd = SPD[surgeProtection(draft)];

  const save = () => {
    const saved = { ...draft, validatedAt: Date.now() };
    update(saved);
    setDraft(saved);
    toast("Informations de la maison enregistrées");
  };
  const discard = () => setDraft(house);

  // Si la maison change ailleurs (annulation, import) et qu'aucune saisie n'est en cours, on suit.
  const previous = useRef(house);
  useEffect(() => {
    const before = previous.current;
    previous.current = house;
    setDraft((d) => ((Object.keys({ ...before, ...d }) as (keyof House)[]).every((k) => before[k] === d[k]) ? house : d));
  }, [house]);

  // Garde de navigation : proposer d'enregistrer avant de quitter la page.
  const latest = useRef({ save, discard });
  latest.current = { save, discard };
  useEffect(() => {
    useDraftGuard.getState().register({ label: "Ma maison", save: () => latest.current.save(), discard: () => latest.current.discard() });
    return () => useDraftGuard.getState().register(null);
  }, []);
  useEffect(() => {
    useDraftGuard.getState().setDirty(dirty);
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        latest.current.save();
      }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("keydown", key);
    };
  }, [dirty]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Ma maison</h1>
          <p className="sub">Ces informations conditionnent les règles appliquées à vos tableaux : nombre de circuits, parafoudre, terre, heures creuses.</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <span className={dirty ? "unsaved-state" : "saved-state"} role="status">
            {dirty ? (
              "Modifications non enregistrées"
            ) : validated ? (
              <>
                <IconCheck size={16} /> Aucune modification, tout est enregistré
              </>
            ) : (
              "Vérifiez les informations puis validez"
            )}
          </span>
          <button type="button" className="btn btn-ghost" disabled={!dirty} onClick={discard}>
            Annuler
          </button>
          <button type="button" className="btn btn-primary" disabled={!dirty && validated} onClick={save}>
            {!dirty && !validated ? "Valider ces informations" : "Enregistrer"}
          </button>
        </div>
      </div>
      <div className="stack-lg">
        <Section title="Logement" text="Le nombre de pièces principales fixe le minimum de circuits d'éclairage.">
          <div className="form-grid">
            <Field label="Nom du projet" full>
              <input id="house-name" className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Surface habitable" hint="en m²">
              <NumberInput id="house-surface" value={draft.surfaceM2} min={10} max={1000} onChange={(v) => set({ surfaceM2: v ?? 0 })} />
            </Field>
            <Field label="Pièces principales" hint="séjour + chambres">
              <NumberInput id="house-rooms" value={draft.mainRooms} min={1} max={20} onChange={(v) => set({ mainRooms: v ?? 1 })} />
            </Field>
          </div>
          <Switch id="house-kitchen" checked={draft.hasKitchenOver4m2} onChange={(v) => set({ hasKitchenOver4m2: v })} label="Cuisine de plus de 4 m²" hint="Impose un circuit dédié de 6 prises pour le plan de travail." />
          <Switch id="house-heating" checked={draft.electricHeating} onChange={(v) => set({ electricHeating: v })} label="Chauffage électrique" hint="Radiateurs, plancher chauffant ou pompe à chaleur." />
        </Section>

        <Section
          title="Alimentation"
          text="Installation monophasée. Le calibre du disjoncteur de branchement sert à dimensionner les interrupteurs différentiels."
          aside={
            <div className="alert" style={{ marginTop: 14 }}>
              <IconInfo size={16} />
              <div className="alert-body small">Un disjoncteur de branchement à 2 fils (phase + neutre) confirme le monophasé ; 4 pôles indiqueraient du triphasé.</div>
            </div>
          }
        >
          <div className="form-grid">
            <Field label="Abonnement">
              <select id="house-kva" className="input" value={draft.subscriptionKva} onChange={(e) => set({ subscriptionKva: Number(e.target.value) })}>
                {[3, 6, 9, 12, 15, 18].map((k) => (
                  <option key={k} value={k}>
                    {k} kVA
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Disjoncteur de branchement" hint="30 A en 6 kVA, 45 A en 9 kVA, 60 A en 12 kVA">
              <select id="house-agcp" className="input" value={draft.agcpRating} onChange={(e) => set({ agcpRating: Number(e.target.value) })}>
                {[15, 30, 45, 60, 75, 90].map((a) => (
                  <option key={a} value={a}>
                    {a} A
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sensibilité du disjoncteur de branchement">
              <select id="house-agcp-sens" className="input" value={draft.agcpSensitivity} onChange={(e) => set({ agcpSensitivity: Number(e.target.value) })}>
                {[30, 300, 500, 650].map((a) => (
                  <option key={a} value={a}>
                    {a} mA
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Résistance de terre mesurée" hint="100 Ω maximum, moins de 50 Ω est une bonne valeur">
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <NumberInput id="house-earth" value={draft.earthOhms} min={0} max={5000} placeholder="Non mesurée" onChange={(v) => set({ earthOhms: v })} />
                <span className="muted">Ω</span>
              </div>
            </Field>
          </div>
          <Switch id="house-offpeak" checked={draft.offPeak} onChange={(v) => set({ offPeak: v })} label="Option heures creuses" hint="Le chauffe-eau est alors piloté par un contacteur jour/nuit." />
        </Section>

        <Section
          title="Foudre"
          text="Détermine si un parafoudre est obligatoire ou recommandé en tête de tableau."
          aside={
            <div style={{ marginTop: 14 }}>
              <Badge tone={spd.tone}>{spd.label}</Badge>
            </div>
          }
        >
          <div className="form-grid">
            <Field label="Département" hint="Vérifiez la densité orageuse de votre département.">
              <input id="house-department" className="input" value={draft.department ?? ""} placeholder="ex. 38" onChange={(e) => set({ department: e.target.value || undefined })} />
            </Field>
          </div>
          <Switch id="house-aq2" checked={draft.aq2Zone} onChange={(v) => set({ aq2Zone: v })} label="Zone AQ2 : plus de 25 jours d'orage par an" hint="Surtout le quart sud-est, les massifs montagneux et les DROM." />
          <Switch id="house-overhead" checked={draft.overheadSupply} onChange={(v) => set({ overheadSupply: v })} label="Arrivée électrique aérienne" hint="Poteaux sur tout ou partie du raccordement." />
          <Switch id="house-rod" checked={draft.lightningRod} onChange={(v) => set({ lightningRod: v })} label="Paratonnerre sur le bâtiment ou à moins de 50 m" />
          <Switch id="house-safety" checked={draft.safetyEquipment} onChange={(v) => set({ safetyEquipment: v })} label="Équipement pour la sécurité des personnes" hint="Matériel médical à domicile, alarme intrusion ou incendie." />
          <Switch id="house-sensitive" checked={draft.sensitiveEquipment} onChange={(v) => set({ sensitiveEquipment: v })} label="Équipements sensibles" hint="Informatique, domotique, congélateur." />
        </Section>
      </div>
      {dirty && (
        <div className="savebar" role="region" aria-label="Modifications non enregistrées">
          <span className="savebar-dot" />
          <span className="savebar-text">
            <b>Modifications non enregistrées</b>
            <span>Les règles de vos tableaux seront recalculées à l'enregistrement.</span>
          </span>
          <button type="button" className="btn btn-sm" onClick={discard}>
            Annuler
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={save}>
            Enregistrer <span className="kbd-inline">Ctrl S</span>
          </button>
        </div>
      )}
    </div>
  );
}
