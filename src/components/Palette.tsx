import { useMemo } from "react";
import { type CatalogItem, type DeviceQuery, findCatalogItem } from "../domain/catalog";
import type { Brand, PanelRole } from "../domain/types";
import { useStore } from "../store/store";
import { CatalogArt } from "./CatalogPicker";
import { IconSearch } from "./icons";
import { DRAG_CATALOG } from "./PanelVisual";

interface Entry {
  q: DeviceQuery;
  label: string;
  brand?: Brand;
}

const NEW: Entry[] = [
  { q: { kind: "rcd", rating: 40, rcdType: "AC" }, label: "ID 40 AC" },
  { q: { kind: "rcd", rating: 40, rcdType: "A" }, label: "ID 40 A" },
  { q: { kind: "rcd", rating: 63, rcdType: "AC" }, label: "ID 63 AC" },
  { q: { kind: "mcb", rating: 2 }, label: "C2" },
  { q: { kind: "mcb", rating: 10 }, label: "C10" },
  { q: { kind: "mcb", rating: 16 }, label: "C16" },
  { q: { kind: "mcb", rating: 20 }, label: "C20" },
  { q: { kind: "mcb", rating: 32 }, label: "C32" },
  { q: { kind: "rcbo", rating: 20, rcdType: "F" }, label: "VE 20 F" },
  { q: { kind: "spd" }, label: "Parafoudre" },
  { q: { kind: "contactor" }, label: "Contact. HC" },
];

const EXISTING: Entry[] = [
  { q: { kind: "rcd", rating: 40, rcdType: "AC" }, label: "ID 40 AC" },
  { q: { kind: "mcb", rating: 10 }, label: "C10" },
  { q: { kind: "mcb", rating: 16 }, label: "C16" },
  { q: { kind: "mcb", rating: 20 }, label: "C20" },
  { q: { kind: "mcb", rating: 25 }, label: "C25" },
  { q: { kind: "mcb", rating: 32 }, label: "C32" },
  { q: { kind: "fuse", rating: 16 }, label: "Fusible 16", brand: "Générique" },
  { q: { kind: "fuse", rating: 32 }, label: "Fusible 32", brand: "Générique" },
  { q: { kind: "contactor" }, label: "Contact. HC" },
];

export function Palette({ brand, role, onPick, onMore }: { brand: Brand; role: PanelRole; onPick: (item: CatalogItem) => void; onMore: () => void }) {
  const custom = useStore((s) => s.project.customCatalog);
  const items = useMemo(
    () =>
      (role === "new" ? NEW : EXISTING)
        .map((e) => ({ e, item: findCatalogItem(e.brand ?? brand, e.q, custom) ?? findCatalogItem("Générique", e.q, custom) }))
        .filter((x): x is { e: Entry; item: CatalogItem } => !!x.item),
    [brand, role, custom],
  );
  return (
    <div className="palette" role="toolbar" aria-label="Ajouter un appareil">
      <div className="palette-title">
        <b>Ajouter</b>
        <span>Cliquez ou glissez dans le coffret</span>
      </div>
      {items.map(({ e, item }) => (
        <button
          key={e.label}
          type="button"
          className="palette-item"
          draggable
          title={item.label}
          onDragStart={(ev) => {
            ev.dataTransfer.setData(DRAG_CATALOG, item.id);
            ev.dataTransfer.effectAllowed = "copy";
          }}
          onClick={() => onPick(item)}
        >
          <span className="palette-art">
            <CatalogArt item={item} scale={item.modules && item.modules > 1 ? 0.95 : 1.25} />
          </span>
          <span>{e.label}</span>
        </button>
      ))}
      <button type="button" className="palette-more" onClick={onMore}>
        <IconSearch size={16} />
        Catalogue
      </button>
    </div>
  );
}
