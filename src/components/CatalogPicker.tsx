import { useMemo, useState } from "react";
import { type CatalogItem, type CatalogKind, KIND_LABEL, allCatalog } from "../domain/catalog";
import { BRANDS, type Brand } from "../domain/types";
import { useStore } from "../store/store";
import { Modal, NumberInput, euro } from "./ui";

const CATEGORIES: { label: string; kinds: CatalogKind[] }[] = [
  { label: "Disjoncteurs", kinds: ["mcb"] },
  { label: "Différentiels", kinds: ["rcd"] },
  { label: "Disj. différentiels", kinds: ["rcbo"] },
  { label: "Parafoudre", kinds: ["spd"] },
  { label: "Commande", kinds: ["contactor", "teleruptor", "timer", "switch", "socket"] },
  { label: "Fusibles", kinds: ["fuse"] },
  { label: "Autres", kinds: ["other", "blank"] },
];

const DEVICE_KINDS: CatalogKind[] = CATEGORIES.flatMap((c) => c.kinds);

export function CatalogPicker({
  brand,
  onPick,
  onClose,
  title = "Ajouter un appareil",
}: {
  brand: Brand;
  onPick: (item: CatalogItem) => void;
  onClose: () => void;
  title?: string;
}) {
  const custom = useStore((s) => s.project.customCatalog);
  const overrides = useStore((s) => s.project.catalogOverrides);
  const addCustomItem = useStore((s) => s.addCustomItem);
  const [filterBrand, setFilterBrand] = useState<Brand>(brand);
  const [category, setCategory] = useState(0);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const items = useMemo(() => {
    const kinds = CATEGORIES[category].kinds;
    const q = query.trim().toLowerCase();
    return allCatalog(custom).filter(
      (c) =>
        kinds.includes(c.kind) &&
        (c.brand === filterBrand || (kinds.includes("fuse") && c.brand === "Générique")) &&
        (!q || `${c.label} ${c.ref ?? ""}`.toLowerCase().includes(q)),
    );
  }, [custom, category, filterBrand, query]);

  return (
    <Modal title={title} onClose={onClose}>
      <div className="row">
        <label className="field" style={{ width: 170 }}>
          <span>Marque</span>
          <select id="catalog-brand" className="input" value={filterBrand} onChange={(e) => setFilterBrand(e.target.value as Brand)}>
            {BRANDS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: 1, minWidth: 180 }}>
          <span>Rechercher</span>
          <input id="catalog-search" className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="16 A, type A, réf…" />
        </label>
      </div>
      <div className="segmented" role="group" aria-label="Catégorie">
        {CATEGORIES.map((c, i) => (
          <button key={c.label} type="button" aria-pressed={category === i} onClick={() => setCategory(i)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="catalog-list">
        {items.map((item) => (
          <button key={item.id} type="button" className="catalog-item" onClick={() => onPick(item)}>
            <span>{item.label}</span>
            <span className="meta">
              <span className="mono">{overrides[item.id]?.ref ?? item.ref ?? "réf. à compléter"}</span>
              <span className="mono">
                {item.modules ?? 1} mod · {euro(overrides[item.id]?.price ?? item.price)}
              </span>
            </span>
          </button>
        ))}
        {items.length === 0 && <p className="muted">Aucun article dans cette catégorie pour {filterBrand}.</p>}
      </div>
      {creating ? (
        <CustomItemForm
          brand={filterBrand}
          onCancel={() => setCreating(false)}
          onSave={(item) => {
            const id = addCustomItem(item);
            setCreating(false);
            onPick({ ...item, id, custom: true });
          }}
        />
      ) : (
        <div className="row">
          <p className="muted" style={{ flex: 1, fontSize: "0.85rem" }}>
            Références et prix indicatifs, à vérifier avant achat. L'article ne figure pas au catalogue ?
          </p>
          <button type="button" className="btn small" onClick={() => setCreating(true)}>
            Créer un article
          </button>
        </div>
      )}
    </Modal>
  );
}

function CustomItemForm({
  brand,
  onSave,
  onCancel,
}: {
  brand: Brand;
  onSave: (item: Omit<CatalogItem, "id" | "custom">) => void;
  onCancel: () => void;
}) {
  const [item, setItem] = useState<Omit<CatalogItem, "id" | "custom">>({
    brand,
    range: "Personnalisé",
    kind: "mcb",
    label: "",
    modules: 1,
    rating: 16,
    curve: "C",
    poles: "1P+N",
    sensitivity: 30,
    rcdType: "AC",
    price: 0,
  });
  const set = (patch: Partial<CatalogItem>) => setItem((i) => ({ ...i, ...patch }));
  const hasRating = ["mcb", "rcd", "rcbo", "fuse", "contactor", "teleruptor", "switch"].includes(item.kind);
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!item.label.trim()) return;
        onSave(item);
      }}
    >
      <h3>Nouvel article</h3>
      <div className="grid-fields">
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span>Désignation</span>
          <input id="custom-label" className="input" required value={item.label} onChange={(e) => set({ label: e.target.value })} />
        </label>
        <label className="field">
          <span>Type</span>
          <select id="custom-kind" className="input" value={item.kind} onChange={(e) => set({ kind: e.target.value as CatalogKind })}>
            {DEVICE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Marque</span>
          <select id="custom-brand" className="input" value={item.brand} onChange={(e) => set({ brand: e.target.value as Brand })}>
            {BRANDS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Référence</span>
          <input id="custom-ref" className="input" value={item.ref ?? ""} onChange={(e) => set({ ref: e.target.value || undefined })} />
        </label>
        <label className="field">
          <span>Modules</span>
          <NumberInput id="custom-modules" value={item.modules} min={1} max={12} onChange={(v) => set({ modules: v ?? 1 })} />
        </label>
        {hasRating && (
          <label className="field">
            <span>Calibre (A)</span>
            <NumberInput id="custom-rating" value={item.rating} min={1} max={125} onChange={(v) => set({ rating: v })} />
          </label>
        )}
        {(item.kind === "rcd" || item.kind === "rcbo") && (
          <label className="field">
            <span>Type différentiel</span>
            <select id="custom-rcd" className="input" value={item.rcdType} onChange={(e) => set({ rcdType: e.target.value as CatalogItem["rcdType"] })}>
              {["AC", "A", "A-SI", "F", "B"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Prix (€)</span>
          <NumberInput id="custom-price" value={item.price} min={0} step={0.5} onChange={(v) => set({ price: v ?? 0 })} />
        </label>
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="btn primary">
          Ajouter au catalogue
        </button>
      </div>
    </form>
  );
}
