import { surgeProtection } from "../domain/analysis";
import type { House } from "../domain/types";
import { useStore } from "../store/store";
import { NumberInput } from "./ui";

const SPD_TEXT = {
  obligatoire: { sev: "nonconforme", label: "Parafoudre obligatoire" },
  recommande: { sev: "conseil", label: "Parafoudre recommandé" },
  facultatif: { sev: "ok", label: "Parafoudre facultatif" },
} as const;

export function HouseView() {
  const house = useStore((s) => s.project.house);
  const update = useStore((s) => s.updateHouse);
  const set = (patch: Partial<House>) => update(patch);
  const spd = SPD_TEXT[surgeProtection(house)];

  const check = (key: keyof House, label: string, hint?: string) => (
    <label className="check">
      <input id={`house-${key}`} type="checkbox" checked={!!house[key]} onChange={(e) => set({ [key]: e.target.checked } as Partial<House>)} />
      <span>
        {label}
        {hint && (
          <>
            <br />
            <span className="muted" style={{ fontSize: "0.82rem" }}>
              {hint}
            </span>
          </>
        )}
      </span>
    </label>
  );

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div>
        <div className="eyebrow">Les données qui conditionnent les règles</div>
        <h2>Ma maison</h2>
      </div>
      <div className="house-grid">
        <section className="card stack">
          <h3>Logement</h3>
          <div className="grid-fields">
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>Nom du projet</span>
              <input id="house-name" className="input" value={house.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label className="field">
              <span>Surface (m²)</span>
              <NumberInput id="house-surface" value={house.surfaceM2} min={10} max={1000} onChange={(v) => set({ surfaceM2: v ?? 0 })} />
            </label>
            <label className="field">
              <span>Pièces principales</span>
              <NumberInput id="house-rooms" value={house.mainRooms} min={1} max={20} onChange={(v) => set({ mainRooms: v ?? 1 })} />
            </label>
          </div>
          {check("hasKitchenOver4m2", "Cuisine de plus de 4 m²", "Impose un circuit dédié de 6 prises pour le plan de travail.")}
          {check("electricHeating", "Chauffage électrique", "Radiateurs, plancher chauffant ou pompe à chaleur.")}
        </section>

        <section className="card stack">
          <h3>Alimentation et terre</h3>
          <div className="banner" style={{ margin: 0 }}>
            <span>
              <b>Monophasé</b> : un disjoncteur de branchement bipolaire (2 fils, phase + neutre). Un disjoncteur à 4 pôles ou la mention « triphasé » sur
              le Linky indiqueraient du triphasé.
            </span>
          </div>
          <div className="grid-fields">
            <label className="field">
              <span>Abonnement (kVA)</span>
              <select id="house-kva" className="input" value={house.subscriptionKva} onChange={(e) => set({ subscriptionKva: Number(e.target.value) })}>
                {[3, 6, 9, 12, 15, 18].map((k) => (
                  <option key={k} value={k}>
                    {k} kVA
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Disjoncteur de branchement</span>
              <select id="house-agcp" className="input" value={house.agcpRating} onChange={(e) => set({ agcpRating: Number(e.target.value) })}>
                {[15, 30, 45, 60, 75, 90].map((a) => (
                  <option key={a} value={a}>
                    {a} A
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Sa sensibilité</span>
              <select id="house-agcp-sens" className="input" value={house.agcpSensitivity} onChange={(e) => set({ agcpSensitivity: Number(e.target.value) })}>
                {[30, 300, 500, 650].map((a) => (
                  <option key={a} value={a}>
                    {a} mA
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Terre mesurée (Ω)</span>
              <NumberInput id="house-earth" value={house.earthOhms} min={0} max={5000} placeholder="non mesurée" onChange={(v) => set({ earthOhms: v })} />
            </label>
          </div>
          {check("offPeak", "Option heures creuses", "Le chauffe-eau est alors piloté par un contacteur jour/nuit.")}
          <p className="muted" style={{ fontSize: "0.82rem" }}>
            Réglage courant du disjoncteur de branchement : 30 A en 6 kVA, 45 A en 9 kVA, 60 A en 12 kVA.
          </p>
        </section>

        <section className="card stack">
          <div className="row">
            <h3 style={{ flex: 1 }}>Foudre</h3>
            <span className="chip" data-sev={spd.sev}>
              {spd.label}
            </span>
          </div>
          <label className="field">
            <span>Département</span>
            <input id="house-department" className="input" value={house.department ?? ""} placeholder="ex. 38" onChange={(e) => set({ department: e.target.value || undefined })} />
          </label>
          {check("aq2Zone", "Zone AQ2 (plus de 25 jours d'orage par an)", "Surtout le quart sud-est, les massifs montagneux et les DROM. Vérifiez la carte kéraunique de votre département.")}
          {check("overheadSupply", "Arrivée électrique aérienne (poteaux)", "Totalement ou en partie.")}
          {check("lightningRod", "Paratonnerre sur le bâtiment ou à moins de 50 m")}
          {check("safetyEquipment", "Équipement pour la sécurité des personnes", "Matériel médical à domicile, alarme intrusion ou incendie…")}
          {check("sensitiveEquipment", "Équipements sensibles", "Informatique, domotique, congélateur…")}
        </section>
      </div>
    </div>
  );
}
