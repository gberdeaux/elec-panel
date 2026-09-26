/** Planche de contrôle visuel des appareils (développement uniquement, URL #specimens). */
import type { Brand, Device } from "../domain/types";
import { analyzePanel } from "../domain/analysis";
import { readLocal } from "../store/persistence";
import { DeviceArt, DeviceDefs } from "./DeviceArt";
import { PanelVisual } from "./PanelVisual";

const BRANDS: Brand[] = ["Schneider", "Legrand", "Hager", "Lexman"];
const KINDS: Omit<Device, "id" | "brand">[] = [
  { kind: "mcb", modules: 1, rating: 20, curve: "C", poles: "1P+N", breakingCapacity: 3000, condition: "bon" },
  { kind: "mcb", modules: 1, rating: 16, curve: "C", poles: "1P+N", breakingCapacity: 3000, condition: "HS" },
  { kind: "rcd", modules: 2, rating: 40, rcdType: "A", sensitivity: 30, condition: "bon" },
  { kind: "rcbo", modules: 2, rating: 20, curve: "C", rcdType: "F", sensitivity: 30, condition: "bon" },
  { kind: "spd", modules: 2, condition: "bon" },
  { kind: "contactor", modules: 1, rating: 20, condition: "bon" },
];

export function Specimens() {
  const params = new URLSearchParams(location.search);
  const scale = Number(params.get("s") ?? 5);
  const only = params.get("b");
  return (
    <div style={{ padding: 24, background: "#e9e7e2", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 28 }}>
      <DeviceDefs />
      {BRANDS.filter((b) => !only || b === only).map((brand) => (
        <div key={brand} style={{ display: "flex", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
          <b style={{ width: 90 }}>{brand}</b>
          {KINDS.map((k, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <DeviceArt device={{ ...k, brand }} view="front" scale={scale} />
              <DeviceArt device={{ ...k, brand }} view="full" scale={scale / 2.5} />
            </div>
          ))}
        </div>
      ))}
      <div style={{ display: "flex", gap: 18 }}>
        <DeviceArt device={{ kind: "fuse", modules: 1, rating: 32, brand: "Générique", condition: "usé" }} view="front" scale={scale} />
        <DeviceArt device={{ kind: "mcb", modules: 1, rating: 10, curve: "C", poles: "1P", brand: "Générique", condition: "bon" }} view="front" scale={scale} />
      </div>
    </div>
  );
}

/** Planche des coffrets du projet en grand (développement uniquement, URL #boards). */
export function Boards() {
  const params = new URLSearchParams(location.search);
  const project = readLocal();
  const mode = (params.get("m") as "front" | "open") ?? "front";
  const idx = Number(params.get("p") ?? 0);
  const panel = project?.panels[idx];
  if (!project || !panel) return <p>Aucun projet.</p>;
  return (
    <div style={{ minHeight: "100vh" }}>
      <DeviceDefs />
      <PanelVisual panel={panel} findings={analyzePanel(panel, project.house)} mode={mode} maxScale={Number(params.get("s") ?? 3)} onSelect={() => undefined} />
    </div>
  );
}
