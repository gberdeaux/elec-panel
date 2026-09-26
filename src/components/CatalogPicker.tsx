import { useMemo, useState } from "react";
import { type CatalogItem, type CatalogKind, KIND_LABEL, allCatalog } from "../domain/catalog";
import { BRANDS, type Brand, type DeviceKind } from "../domain/types";
import { useStore } from "../store/store";
import { DeviceArt } from "./DeviceArt";
import { IconPlus, IconSearch } from "./icons";
import { Field, Modal, NumberInput, euro } from "./ui";

const CATEGORIES: { label: string; kinds: CatalogKind[] }[] = [
  { label: "Disjoncteurs", kinds: ["mcb"] },
  { label: "Interrupteurs différentiels", kinds: ["rcd"] },
  { label: "Disjoncteurs différentiels", kinds: ["rcbo"] },
  { label: "Parafoudres", kinds: ["spd"] },
  { label: "Commande et gestion", kinds: ["contactor", "teleruptor", "timer", "switch", "socket"] },
  { label: "Fusibles (ancien)", kinds: ["fuse"] },
  { label: "Divers", kinds: ["other", "blank"] },
];

const DEVICE_KINDS: CatalogKind[] = CATEGORIES.flatMap((c) => c.kinds);

export function CatalogArt({ item, scale = 1.25 }: { item: CatalogItem; scale?: number }) {
  if (item.kind === "enclosure" || item.kind === "comb") return null;
  const kind: DeviceKind = item.kind === "blankStrip" ? "blank" : item.kind;
  return (
    <DeviceArt
      device={{ ...item, kind, modules: item.kind === "blankStrip" ? 1 : item.modules ?? 1, condition: "bon" }}
      view="front"
      scale={(item.modules ?? 1) > 2 ? scale * 0.7 : scale}
    />
  );
}

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
    <Modal title={title} subtitle="Références et prix indicatifs, à vérifier avant achat." onClose={onClose}>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <IconSearch size={16} style={{ position: "absolute", left: 11, top: 11, color: "var(--faint)" }} />
          <input id="catalog-search" className="input" style={{ paddingLeft: 34 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher : 20 A, type A, R9PFC616…" />
        </div>
        <select id="catalog-brand" className="input" style={{ width: 150 }} value={filterBrand} onChange={(e) => setFilterBrand(e.target.value as Brand)} aria-label="Marque">
          {BRANDS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
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
        <div className="catalog-layout">
          <nav className="catalog-cats" aria-label="Catégories">
            {CATEGORIES.map((c, i) => (
              <button key={c.label} type="button" className="nav-item" aria-current={category === i ? "page" : undefined} onClick={() => setCategory(i)}>
                <span className="nav-text">{c.label}</span>
              </button>
            ))}
            <button type="button" className="nav-item" onClick={() => setCreating(true)} style={{ marginTop: 8, color: "var(--brand)" }}>
              <IconPlus size={16} />
              <span className="nav-text">Article personnalisé</span>
            </button>
          </nav>
          <div className="catalog-grid">
            {items.map((item) => (
              <button key={item.id} type="button" className="catalog-card" onClick={() => onPick(item)}>
                <div className="catalog-art">
                  <CatalogArt item={item} />
                </div>
                <b>{item.label}</b>
                <div className="catalog-meta">
                  <span className="mono">{overrides[item.id]?.ref ?? item.ref ?? `${item.modules ?? 1} mod.`}</span>
                  <span className="price">{euro(overrides[item.id]?.price ?? item.price)}</span>
                </div>
              </button>
            ))}
            {items.length === 0 && (
              <div className="empty" style={{ gridColumn: "1 / -1" }}>
                <p>Aucun article {filterBrand} dans cette catégorie.</p>
              </div>
            )}
          </div>
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
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (item.label.trim()) onSave(item);
      }}
    >
      <div className="row" style={{ alignItems: "flex-start", gap: 20, flexWrap: "nowrap" }}>
        <div className="catalog-art" style={{ width: 120, height: 130, flex: "none" }}>
          <CatalogArt item={{ ...item, id: "preview" }} />
        </div>
        <div className="form-grid" style={{ flex: 1 }}>
          <Field label="Désignation" full>
            <input id="custom-label" className="input" required value={item.label} onChange={(e) => set({ label: e.target.value })} placeholder="Disjoncteur 16 A courbe C…" />
          </Field>
          <Field label="Type">
            <select id="custom-kind" className="input" value={item.kind} onChange={(e) => set({ kind: e.target.value as CatalogKind })}>
              {DEVICE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Marque">
            <select id="custom-brand" className="input" value={item.brand} onChange={(e) => set({ brand: e.target.value as Brand })}>
              {BRANDS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Field label="Référence">
            <input id="custom-ref" className="input mono" value={item.ref ?? ""} onChange={(e) => set({ ref: e.target.value || undefined })} />
          </Field>
          <Field label="Largeur (modules)">
            <NumberInput id="custom-modules" value={item.modules} min={1} max={12} onChange={(v) => set({ modules: v ?? 1 })} />
          </Field>
          {hasRating && (
            <Field label="Calibre (A)">
              <NumberInput id="custom-rating" value={item.rating} min={1} max={125} onChange={(v) => set({ rating: v })} />
            </Field>
          )}
          {(item.kind === "rcd" || item.kind === "rcbo") && (
            <Field label="Type de différentiel">
              <select id="custom-rcd" className="input" value={item.rcdType} onChange={(e) => set({ rcdType: e.target.value as CatalogItem["rcdType"] })}>
                {["AC", "A", "A-SI", "F", "B"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Prix unitaire (€)">
            <NumberInput id="custom-price" value={item.price} min={0} step={0.5} onChange={(v) => set({ price: v ?? 0 })} />
          </Field>
        </div>
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Retour au catalogue
        </button>
        <button type="submit" className="btn btn-primary">
          Ajouter au catalogue
        </button>
      </div>
    </form>
  );
}
