import type { ReactNode } from "react";
import { surgeProtection } from "../domain/analysis";
import type { House } from "../domain/types";
import { useStore } from "../store/store";
import { IconInfo } from "./icons";
import { Badge, Field, NumberInput, Switch } from "./ui";

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
  const set = (patch: Partial<House>) => update(patch);
  const spd = SPD[surgeProtection(house)];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Ma maison</h1>
          <p className="sub">Ces informations conditionnent les règles appliquées à vos tableaux : nombre de circuits, parafoudre, terre, heures creuses.</p>
        </div>
      </div>
      <div className="stack-lg">
        <Section title="Logement" text="Le nombre de pièces principales fixe le minimum de circuits d'éclairage.">
          <div className="form-grid">
            <Field label="Nom du projet" full>
              <input id="house-name" className="input" value={house.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Surface habitable" hint="en m²">
              <NumberInput id="house-surface" value={house.surfaceM2} min={10} max={1000} onChange={(v) => set({ surfaceM2: v ?? 0 })} />
            </Field>
            <Field label="Pièces principales" hint="séjour + chambres">
              <NumberInput id="house-rooms" value={house.mainRooms} min={1} max={20} onChange={(v) => set({ mainRooms: v ?? 1 })} />
            </Field>
          </div>
          <Switch id="house-kitchen" checked={house.hasKitchenOver4m2} onChange={(v) => set({ hasKitchenOver4m2: v })} label="Cuisine de plus de 4 m²" hint="Impose un circuit dédié de 6 prises pour le plan de travail." />
          <Switch id="house-heating" checked={house.electricHeating} onChange={(v) => set({ electricHeating: v })} label="Chauffage électrique" hint="Radiateurs, plancher chauffant ou pompe à chaleur." />
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
              <select id="house-kva" className="input" value={house.subscriptionKva} onChange={(e) => set({ subscriptionKva: Number(e.target.value) })}>
                {[3, 6, 9, 12, 15, 18].map((k) => (
                  <option key={k} value={k}>
                    {k} kVA
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Disjoncteur de branchement" hint="30 A en 6 kVA, 45 A en 9 kVA, 60 A en 12 kVA">
              <select id="house-agcp" className="input" value={house.agcpRating} onChange={(e) => set({ agcpRating: Number(e.target.value) })}>
                {[15, 30, 45, 60, 75, 90].map((a) => (
                  <option key={a} value={a}>
                    {a} A
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sensibilité du disjoncteur de branchement">
              <select id="house-agcp-sens" className="input" value={house.agcpSensitivity} onChange={(e) => set({ agcpSensitivity: Number(e.target.value) })}>
                {[30, 300, 500, 650].map((a) => (
                  <option key={a} value={a}>
                    {a} mA
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Résistance de terre mesurée" hint="100 Ω maximum, moins de 50 Ω est une bonne valeur">
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <NumberInput id="house-earth" value={house.earthOhms} min={0} max={5000} placeholder="Non mesurée" onChange={(v) => set({ earthOhms: v })} />
                <span className="muted">Ω</span>
              </div>
            </Field>
          </div>
          <Switch id="house-offpeak" checked={house.offPeak} onChange={(v) => set({ offPeak: v })} label="Option heures creuses" hint="Le chauffe-eau est alors piloté par un contacteur jour/nuit." />
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
              <input id="house-department" className="input" value={house.department ?? ""} placeholder="ex. 38" onChange={(e) => set({ department: e.target.value || undefined })} />
            </Field>
          </div>
          <Switch id="house-aq2" checked={house.aq2Zone} onChange={(v) => set({ aq2Zone: v })} label="Zone AQ2 : plus de 25 jours d'orage par an" hint="Surtout le quart sud-est, les massifs montagneux et les DROM." />
          <Switch id="house-overhead" checked={house.overheadSupply} onChange={(v) => set({ overheadSupply: v })} label="Arrivée électrique aérienne" hint="Poteaux sur tout ou partie du raccordement." />
          <Switch id="house-rod" checked={house.lightningRod} onChange={(v) => set({ lightningRod: v })} label="Paratonnerre sur le bâtiment ou à moins de 50 m" />
          <Switch id="house-safety" checked={house.safetyEquipment} onChange={(v) => set({ safetyEquipment: v })} label="Équipement pour la sécurité des personnes" hint="Matériel médical à domicile, alarme intrusion ou incendie." />
          <Switch id="house-sensitive" checked={house.sensitiveEquipment} onChange={(v) => set({ sensitiveEquipment: v })} label="Équipements sensibles" hint="Informatique, domotique, congélateur." />
        </Section>
      </div>
    </div>
  );
}
