/**
 * Dessin réaliste d'un appareil modulaire, fidèle aux gammes du marché
 * (unités en millimètres, module de 18 mm, face avant de 46 mm).
 *  - Schneider Resi9 : boîtier blanc, marquage vert, badge maison, manette blanche à bout vert.
 *  - Legrand DNX³ / DX³ : boîtier gris clair, porte-étiquette bleuté, manette noire, bande rouge « I.On ».
 *  - Hager : boîtier gris perle, manette grise, marquage bleu.
 *  - Générique / Lexman : boîtier blanc, manette gris foncé.
 * Vue « front » : la face avant qui dépasse du plastron. Vue « full » : l'appareil entier avec ses bornes.
 */
import type { ReactNode } from "react";
import type { Brand, Device, RcdType } from "../domain/types";

export const MODULE_MM = 18;
export const DEVICE_H = 90;
export const NOSE_Y = 22;
export const NOSE_H = 46;

const PRINT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";
type Skin = "schneider" | "legrand" | "hager" | "generic";

const SKIN: Record<Skin, { body: string; bodyDark: string; face: string; faceEdge: string; ink: string; soft: string }> = {
  schneider: { body: "#f7f7f6", bodyDark: "#e3e3e0", face: "#fbfbfa", faceEdge: "#dcdcd8", ink: "#3c3c3b", soft: "#77787b" },
  legrand: { body: "#e7e7e5", bodyDark: "#d2d2cf", face: "#ededeb", faceEdge: "#cfcfcb", ink: "#1d1d1b", soft: "#6f6f6e" },
  hager: { body: "#efefed", bodyDark: "#dadad6", face: "#f4f4f2", faceEdge: "#d6d6d2", ink: "#2b2d31", soft: "#6c7078" },
  generic: { body: "#f5f5f3", bodyDark: "#e0e0dc", face: "#fafaf9", faceEdge: "#d9d9d5", ink: "#2a2c30", soft: "#71757c" },
};

const SCH_GREEN = "#3dae2b";
const LG_RED = "#d0102b";
const HG_BLUE = "#0a4e9b";

export function skinOf(brand?: Brand): Skin {
  if (brand === "Schneider") return "schneider";
  if (brand === "Legrand") return "legrand";
  if (brand === "Hager") return "hager";
  return "generic";
}

/** Dégradés partagés, rendus une seule fois dans la page. */
export function DeviceDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="qc-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".07" />
          <stop offset=".08" stopColor="#000" stopOpacity="0" />
          <stop offset=".92" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".09" />
        </linearGradient>
        <linearGradient id="qc-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".7" />
          <stop offset=".25" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".05" />
        </linearGradient>
        <linearGradient id="qc-lever-black" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4a4a" />
          <stop offset=".35" stopColor="#2a2a2a" />
          <stop offset="1" stopColor="#141414" />
        </linearGradient>
        <linearGradient id="qc-lever-grey" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8e939a" />
          <stop offset=".4" stopColor="#6b7077" />
          <stop offset="1" stopColor="#4d5157" />
        </linearGradient>
        <linearGradient id="qc-lever-white" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e4e4e1" />
        </linearGradient>
        <linearGradient id="qc-green-tab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#56c33f" />
          <stop offset="1" stopColor="#2f9a24" />
        </linearGradient>
        <linearGradient id="qc-dclic" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9aabcb" />
          <stop offset=".5" stopColor="#7d91ba" />
          <stop offset="1" stopColor="#6378a3" />
        </linearGradient>
        <linearGradient id="qc-window" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe3f6" />
          <stop offset=".45" stopColor="#e9f3fc" />
          <stop offset="1" stopColor="#d6e7f7" />
        </linearGradient>
        <radialGradient id="qc-screw" cx=".38" cy=".35" r=".75">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset=".6" stopColor="#b4bac0" />
          <stop offset="1" stopColor="#7a8188" />
        </radialGradient>
        <linearGradient id="qc-fuse" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d8d0bb" />
          <stop offset=".5" stopColor="#f4efe2" />
          <stop offset="1" stopColor="#d2c9b2" />
        </linearGradient>
      </defs>
    </svg>
  );
}

type ArtDevice = Pick<Device, "kind" | "modules" | "rating" | "curve" | "poles" | "breakingCapacity" | "rcdType" | "sensitivity" | "brand" | "condition" | "label" | "ref" | "series">;

export function DeviceArt({ device, view, scale }: { device: ArtDevice; view: "front" | "full"; scale: number }) {
  const m = Math.max(1, device.modules);
  const w = MODULE_MM * m;
  const skin = skinOf(device.brand);
  const aged = device.condition === "usé" || device.kind === "fuse";
  const on = device.condition !== "HS";
  const s = SKIN[skin];
  const vb = view === "front" ? `0 ${NOSE_Y} ${w} ${NOSE_H}` : `0 0 ${w} ${DEVICE_H}`;
  return (
    <svg width={w * scale} height={(view === "front" ? NOSE_H : DEVICE_H) * scale} viewBox={vb} aria-hidden="true" style={{ display: "block" }}>
      {/* Corps */}
      <rect x=".2" y=".2" width={w - 0.4} height={DEVICE_H - 0.4} rx="1.2" fill={aged ? "#ebe4cf" : s.body} stroke={s.bodyDark} strokeWidth=".3" />
      {view === "full" && <Terminals skin={skin} device={device} w={w} />}
      {/* Face avant */}
      <rect x=".35" y={NOSE_Y + 0.2} width={w - 0.7} height={NOSE_H - 0.4} rx="1.1" fill={aged ? "#f1ead6" : s.face} stroke={s.faceEdge} strokeWidth=".3" />
      <rect x=".35" y={NOSE_Y + 0.2} width={w - 0.7} height={NOSE_H - 0.4} rx="1.1" fill="url(#qc-sheen)" />
      <rect x=".35" y={NOSE_Y + 0.2} width={w - 0.7} height={NOSE_H - 0.4} rx="1.1" fill="url(#qc-shade)" />
      {Array.from({ length: m - 1 }, (_, i) => (
        <path key={i} d={`M${(i + 1) * MODULE_MM} ${NOSE_Y + 0.4} V${NOSE_Y + NOSE_H - 0.4}`} stroke="#000" strokeOpacity=".06" strokeWidth=".25" />
      ))}
      <g transform={`translate(0 ${NOSE_Y})`}>
        <Face device={device} skin={skin} w={w} on={on} />
      </g>
      {device.condition === "usé" && <rect x=".35" y={NOSE_Y + 0.2} width={w - 0.7} height={NOSE_H - 0.4} rx="1.1" fill="#8a6d1c" opacity=".06" />}
    </svg>
  );
}

/* ---------------------------------------------------------------- Bornes */

function Terminals({ skin, device, w }: { skin: Skin; device: ArtDevice; w: number }) {
  const xs = [w * 0.28, w * 0.72];
  const nx = device.kind === "rcd" ? xs[0] : xs[1];
  if (skin === "schneider") {
    // Resi9 XE : fentes du peigne en haut, bornes automatiques (bleu = neutre) en bas.
    return (
      <g>
        {xs.map((x, i) => (
          <g key={i}>
            <rect x={x - 2.4} y="4" width="4.8" height="3.4" rx=".5" fill="#2b2d30" />
            <rect x={x - 3} y={DEVICE_H - 13} width="6" height="8" rx=".8" fill={x === nx ? "#2f7fd6" : "#f1f1ee"} stroke={x === nx ? "#1d5fae" : "#c8c8c3"} strokeWidth=".3" />
            <rect x={x - 1.6} y={DEVICE_H - 11.2} width="3.2" height="2.2" rx=".4" fill={x === nx ? "#1f5da8" : "#d6d6d1"} />
            <rect x={x - 1} y={DEVICE_H - 7.8} width="2" height="1.8" rx=".3" fill="#1b1d20" />
          </g>
        ))}
        <circle cx={w / 2} cy="13.5" r="1.1" fill="#e2e2de" stroke="#c9c9c4" strokeWidth=".25" />
      </g>
    );
  }
  const r = w < 20 ? 2.1 : 2.6;
  const screw = (x: number, y: number) => (
    <g>
      <circle cx={x} cy={y} r={r + 0.7} fill="#cfd0cc" />
      <circle cx={x} cy={y} r={r} fill="url(#qc-screw)" stroke="#6d737a" strokeWidth=".25" />
      <path d={`M${x - r * 0.62} ${y} H${x + r * 0.62} M${x} ${y - r * 0.62} V${y + r * 0.62}`} stroke="#4c5258" strokeWidth=".5" strokeLinecap="round" />
    </g>
  );
  return (
    <g>
      {xs.map((x, i) => (
        <g key={i}>
          <rect x={x - r - 0.5} y="1.6" width={2 * r + 1} height="3.6" rx=".5" fill="#26282b" />
          {screw(x, 11)}
          {screw(x, DEVICE_H - 11)}
          <rect x={x - r - 0.5} y={DEVICE_H - 5.2} width={2 * r + 1} height="3.6" rx=".5" fill="#26282b" />
        </g>
      ))}
      {device.kind !== "spd" && device.kind !== "blank" && (
        <>
          <Txt x={nx} y={18.4} size={2.2} weight={700} fill="#3a3a3a">
            N
          </Txt>
          <Txt x={nx} y={DEVICE_H - 15.2} size={2.2} weight={700} fill="#3a3a3a">
            N
          </Txt>
        </>
      )}
      {skin === "legrand" && <rect x={w / 2 - 1.3} y="-1.2" width="2.6" height="2.8" rx=".6" fill="#8d9197" />}
    </g>
  );
}

/* ---------------------------------------------------------------- Primitives */

function Txt({ x, y, size, weight = 400, fill = "#222", anchor = "middle", children, spacing, italic, rotate }: { x: number; y: number; size: number; weight?: number; fill?: string; anchor?: "start" | "middle" | "end"; children: ReactNode; spacing?: number; italic?: boolean; rotate?: number }) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontFamily={PRINT}
      fontWeight={weight}
      fill={fill}
      textAnchor={anchor}
      letterSpacing={spacing}
      fontStyle={italic ? "italic" : undefined}
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
    >
      {children}
    </text>
  );
}

function PdcBox({ x, y, value, ink }: { x: number; y: number; value?: number; ink: string }) {
  if (!value) return null;
  const w = 7.6;
  return (
    <g>
      <rect x={x} y={y} width={w} height="2.5" fill="none" stroke={ink} strokeWidth=".2" />
      <path d={`M${x + w - 1.7} ${y} V${y + 2.5}`} stroke={ink} strokeWidth=".2" />
      <Txt x={x + (w - 1.7) / 2} y={y + 1.95} size={1.55} weight={700} fill={ink}>
        {value}
      </Txt>
      <Txt x={x + w - 0.85} y={y + 1.95} size={1.55} weight={700} fill={ink}>
        3
      </Txt>
    </g>
  );
}

function RcdSymbol({ type, x, y, ink }: { type?: RcdType; x: number; y: number; ink: string }) {
  const w = 4.6;
  const h = 2.8;
  const sine = `M${x + 0.5} ${y + h * 0.42} q${w / 8} ${-h * 0.5} ${w / 4 - 0.25} 0 t${w / 4 - 0.25} 0 t${w / 4 - 0.25} 0`;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={ink} strokeWidth=".2" />
      <path d={sine} fill="none" stroke={ink} strokeWidth=".22" />
      {type && type !== "AC" && <path d={`M${x + 0.6} ${y + h - 0.45} q.45 -1.1 .9 0 M${x + 1.9} ${y + h - 0.45} q.45 -1.1 .9 0`} fill="none" stroke={ink} strokeWidth=".22" />}
      {type === "B" && <path d={`M${x + 3.1} ${y + h - 0.9} h1.2 M${x + 3.1} ${y + h - 0.5} h1.2`} stroke={ink} strokeWidth=".2" />}
    </g>
  );
}

function HouseBadge({ x, y, label, color = SCH_GREEN }: { x: number; y: number; label?: string; color?: string }) {
  return (
    <g>
      <rect x={x} y={y} width="4.2" height="4.2" rx=".55" fill={color} />
      <path d={`M${x + 1} ${y + 3.4} V${y + 2} L${x + 2.1} ${y + 1} L${x + 3.2} ${y + 2} V${y + 3.4} Z M${x + 1.8} ${y + 3.4} V${y + 2.6} H${x + 2.4}`} fill="none" stroke="#fff" strokeWidth=".32" strokeLinejoin="round" />
      {label && (
        <>
          <rect x={x} y={y + 4.5} width="4.2" height="2.3" rx=".4" fill={color} />
          <Txt x={x + 2.1} y={y + 6.25} size={1.55} weight={700} fill="#fff">
            {label}
          </Txt>
        </>
      )}
    </g>
  );
}

function SchneiderMark({ x, y, small }: { x: number; y: number; small?: boolean }) {
  const k = small ? 0.82 : 1;
  return (
    <g>
      <Txt x={x} y={y} size={2.15 * k} weight={700} fill={SCH_GREEN} anchor="start" spacing={-0.06}>
        Schneider
      </Txt>
      <Txt x={x + 3.1 * k} y={y + 1.55 * k} size={1.2 * k} fill={SCH_GREEN} anchor="start" spacing={0.05}>
        Electric
      </Txt>
      <path d={`M${x + 0.4} ${y + 1.2 * k} q.8 -.9 1.6 0 q.8 .9 1.2 0`} fill="none" stroke={SCH_GREEN} strokeWidth=".28" />
    </g>
  );
}

/** Manette Resi9 : capot blanc, languette verte, fenêtre I.ON / O.OFF. */
function SchneiderToggle({ cx, on }: { cx: number; on: boolean }) {
  const top = 22.5;
  return (
    <g>
      <rect x={cx - 6.4} y={top} width="12.8" height="15.5" rx="1.1" fill="#f2f2f0" stroke="#d3d3cf" strokeWidth=".3" />
      <rect x={cx - 5.4} y={top + 0.9} width="10.8" height="6.2" rx=".6" fill="#ffffff" stroke="#e0e0dc" strokeWidth=".2" />
      <Txt x={cx} y={top + (on ? 5.2 : 5.2)} size={2.25} weight={700} fill="#4a4a49">
        {on ? "I.ON" : "O.OFF"}
      </Txt>
      <rect x={cx - 4.2} y={top + (on ? 7.8 : 9.4)} width="8.4" height="6" rx="1" fill="url(#qc-lever-white)" stroke="#cfcfcb" strokeWidth=".25" />
      <path d={`M${cx - 4.2} ${top + (on ? 11.2 : 12.8)} h8.4 v1.6 a1 1 0 0 1 -1 1 h-6.4 a1 1 0 0 1 -1 -1 Z`} fill="url(#qc-green-tab)" />
    </g>
  );
}

/** Manette Legrand : levier noir + bande rouge « I.On » (verte « O.Off » quand déclenché). */
function LegrandToggle({ cx, on, top = 13.2 }: { cx: number; on: boolean; top?: number }) {
  return (
    <g>
      <rect x={cx - 5.2} y={top + 4.2} width="10.4" height="7.4" rx=".5" fill="#1d1d1d" />
      <rect x={cx - 4.4} y={top + 6.3} width="8.8" height="3.2" rx=".3" fill={on ? LG_RED : "#2f8f46"} />
      <Txt x={cx} y={top + 8.55} size={1.6} weight={700} fill="#fff" italic>
        {on ? "I.On" : "O.Off"}
      </Txt>
      <rect x={cx - 6.1} y={on ? top : top + 2.2} width="12.2" height="4.4" rx=".8" fill="url(#qc-lever-black)" />
      <path d={`M${cx - 5} ${(on ? top : top + 2.2) + 1} H${cx + 5}`} stroke="#fff" strokeOpacity=".22" strokeWidth=".35" />
    </g>
  );
}

/** Porte-étiquette transparent bleuté des DNX³ / DX³. */
function LegrandWindow({ x, w }: { x: number; w: number }) {
  return (
    <g>
      <rect x={x} y="1.1" width={w} height="11.4" rx=".7" fill="url(#qc-window)" stroke="#86add6" strokeWidth=".35" />
      <rect x={x + 0.6} y="1.6" width={w - 1.2} height="2" rx=".4" fill="#fff" opacity=".55" />
      <path d={`M${x + 0.4} 12.1 H${x + w - 0.4}`} stroke="#6f98c4" strokeWidth=".35" />
    </g>
  );
}

function LegrandBrand({ x, y, lineTo }: { x: number; y: number; lineTo: number }) {
  return (
    <g>
      <Txt x={x} y={y} size={2.35} weight={700} fill="#1b1b1b" anchor="start" spacing={-0.04}>
        legrand
      </Txt>
      <rect x={x + 9.2} y={y - 0.65} width={Math.max(0, lineTo - x - 9.2)} height=".42" fill={LG_RED} />
    </g>
  );
}

function GreyToggle({ cx, on, top = 15, h = 19 }: { cx: number; on: boolean; top?: number; h?: number }) {
  const lh = h * 0.5;
  return (
    <g>
      <rect x={cx - 3.6} y={top} width="7.2" height={h} rx="1" fill="#2c2f33" />
      <rect x={cx - 3} y={on ? top + 0.6 : top + h - lh - 0.6} width="6" height={lh} rx=".8" fill="url(#qc-lever-grey)" />
      {[0.3, 0.55, 0.8].map((f) => (
        <path key={f} d={`M${cx - 2.2} ${(on ? top + 0.6 : top + h - lh - 0.6) + lh * f} H${cx + 2.2}`} stroke="#000" strokeOpacity=".3" strokeWidth=".3" />
      ))}
    </g>
  );
}

/* ---------------------------------------------------------------- Faces */

function Face({ device, skin, w, on }: { device: ArtDevice; skin: Skin; w: number; on: boolean }) {
  const k = device.kind;
  if (k === "mcb" || k === "rcd" || k === "rcbo") {
    if (skin === "schneider" && device.kind === "mcb" && device.series === "D'clic") return <DclicFace device={device} w={w} on={on} />;
    if (skin === "schneider") return <SchneiderFace device={device} w={w} on={on} />;
    if (skin === "legrand") return <LegrandFace device={device} w={w} on={on} />;
    return <NeutralFace device={device} w={w} on={on} skin={skin} />;
  }
  return <OtherFace device={device} w={w} on={on} skin={skin} />;
}

function SchneiderFace({ device, w, on }: { device: ArtDevice; w: number; on: boolean }) {
  const ink = SKIN.schneider.ink;
  const soft = SKIN.schneider.soft;
  if (device.kind === "mcb") {
    return (
      <g>
        <SchneiderMark x={1.6} y={4.2} />
        <Txt x={1.6} y={9.6} size={1.75} weight={700} fill={soft} anchor="start">
          Resi9
        </Txt>
        <path d="M1.6 10.3 H10.4" stroke={soft} strokeWidth=".22" />
        <Txt x={1.6} y={12.3} size={1.45} fill={soft} anchor="start">
          DM
        </Txt>
        <Txt x={1.6} y={14.2} size={.95} fill={soft} anchor="start">
          {device.ref ?? `R9PFC6${String(device.rating ?? 16).padStart(2, "0")}`}
        </Txt>
        <HouseBadge x={12.3} y={7.2} label="XP" />
        <SchneiderToggle cx={w / 2} on={on} />
        <Txt x={1.7} y={43.4} size={3.3} weight={700} fill={ink} anchor="start">
          {`${device.curve ?? "C"}${device.rating ?? "?"}`}
        </Txt>
        <Txt x={w - 1.4} y={40.9} size={1.15} fill={soft} anchor="end">
          230V~
        </Txt>
        <PdcBox x={w - 9} y={41.5} value={device.poles === "1P" ? undefined : device.breakingCapacity ?? 3000} ink={soft} />
      </g>
    );
  }
  // ID ou disjoncteur différentiel : 2 modules
  const rx = 19.4;
  return (
    <g>
      <ellipse cx="7.8" cy="6.6" rx="5" ry="4.4" fill="#e7e7e3" stroke="#c9c9c4" strokeWidth=".3" />
      <ellipse cx="7.8" cy="6.2" rx="4.1" ry="3.5" fill="#fbfbf9" />
      <ellipse cx="7" cy="5.1" rx="2.2" ry="1.2" fill="#ffffff" opacity=".9" />
      <path d="M5.4 8.9 q2.4 1.2 4.8 0" fill="none" stroke="#d2d2cd" strokeWidth=".35" />
      <Txt x={7.7} y={12.2} size={1.05} fill={SKIN.schneider.soft}>
        Test régulier
      </Txt>
      <SchneiderToggle cx={9} on={on} />
      <SchneiderMark x={rx} y={4.2} small />
      <Txt x={rx} y={9.1} size={1.6} weight={700} fill={soft} anchor="start">
        Resi9
      </Txt>
      <path d={`M${rx} 9.8 H${rx + 8.2}`} stroke={soft} strokeWidth=".22" />
      <Txt x={rx} y={11.8} size={1.4} fill={soft} anchor="start">
        {device.kind === "rcd" ? "ID" : "DDR"}
      </Txt>
      <Txt x={rx} y={13.7} size={.95} fill={soft} anchor="start">
        {device.ref ?? (device.kind === "rcd" ? `R9PR${device.rcdType === "AC" || !device.rcdType ? "C" : "A"}2${device.rating ?? 40}` : "R9PDC")}
      </Txt>
      <HouseBadge x={w - 5.6} y={7} label="XP" />
      <Txt x={w - 1.2} y={22} size={1} fill={soft} anchor="end" rotate={-90}>
        17W37
      </Txt>
      {device.kind === "rcbo" ? (
        <Txt x={rx} y={36.3} size={2.8} weight={700} fill={ink} anchor="start">
          {`${device.curve ?? "C"}${device.rating ?? "?"}`}
        </Txt>
      ) : null}
      <Txt x={rx + 5.8} y={38.4} size={1.2} fill={soft} anchor="start">
        {`Type ${device.rcdType ?? "AC"}`}
      </Txt>
      <Txt x={rx} y={43.2} size={device.kind === "rcbo" ? 2.2 : 3} weight={700} fill={ink} anchor="start">
        {device.kind === "rcbo" ? "" : `${device.rating ?? "?"}A`}
      </Txt>
      <Txt x={rx + (device.kind === "rcbo" ? 0 : 6.3)} y={43.2} size={1.7} weight={700} fill={(device.sensitivity ?? 30) > 30 ? "#b3261e" : ink} anchor="start">
        {`${device.sensitivity ?? 30}mA`}
      </Txt>
      <RcdSymbol type={device.rcdType} x={w - 6.2} y={40.9} ink={soft} />
    </g>
  );
}

/** Schneider D'clic : boîtier blanc, grande palette bleu-gris. */
function DclicFace({ device, w, on }: { device: ArtDevice; w: number; on: boolean }) {
  const soft = SKIN.schneider.soft;
  const top = on ? 20.2 : 25.4;
  return (
    <g>
      <SchneiderMark x={1.6} y={4.2} />
      <path d="M1.8 9.4 h1.6 v1.6 h-1.6 Z" fill="none" stroke={soft} strokeWidth=".25" />
      <Txt x={4.2} y={10.9} size={1.55} fill={soft} anchor="start">
        D'clic
      </Txt>
      <rect x="1.4" y="18.6" width={w - 2.8} height="17.6" rx="1.2" fill="#e8e9eb" stroke="#d0d2d6" strokeWidth=".25" />
      <rect x="2" y={top} width={w - 4} height="10" rx="1.3" fill="url(#qc-dclic)" />
      <rect x="2" y={top} width={w - 4} height="2.2" rx="1" fill="#ffffff" opacity=".35" />
      <path d={`M3.2 ${top + 6.4} H${w - 3.2}`} stroke="#ffffff" strokeOpacity=".45" strokeWidth=".35" />
      <Txt x={w / 2} y={top + 8.6} size={1.3} weight={700} fill="#eef2fa">
        {on ? "I-ON" : "O-OFF"}
      </Txt>
      <Txt x={1.6} y={41.4} size={1.05} fill={soft} anchor="start">
        230V~
      </Txt>
      <Txt x={1.6} y={43.1} size={1.05} fill={soft} anchor="start">
        3000
      </Txt>
      <Txt x={w - 1.4} y={43.6} size={3.4} weight={700} fill={SKIN.schneider.ink} anchor="end">
        {`${device.curve ?? "C"}${device.rating ?? "?"}`}
      </Txt>
    </g>
  );
}

function LegrandFace({ device, w, on }: { device: ArtDevice; w: number; on: boolean }) {
  const ink = SKIN.legrand.ink;
  if (device.kind === "mcb") {
    return (
      <g>
        <LegrandWindow x={1.5} w={w - 3} />
        <LegrandToggle cx={w / 2} on={on} />
        <rect x="1.9" y="27.4" width=".42" height="15.6" fill={LG_RED} />
        <Txt x={3.1} y={30.6} size={1.75} weight={700} fill={ink} anchor="start">
          DNX
          <tspan fontSize="1.1" dy="-.7">
            3
          </tspan>
        </Txt>
        <path d={`M${w - 6.6} 31.4 V29.1 L${w - 5.1} 27.9 L${w - 3.6} 29.1 V31.4 Z M${w - 5.6} 31.4 V30.3 H${w - 4.6}`} fill="none" stroke={LG_RED} strokeWidth=".38" strokeLinejoin="round" />
        <Txt x={3.1} y={35.3} size={3.7} weight={700} fill={ink} anchor="start" spacing={-0.1}>
          {`${device.curve ?? "C"}${device.rating ?? "?"}`}
        </Txt>
        {device.poles === "1P" ? (
          <Txt x={3.1} y={38.5} size={1.5} weight={700} fill={ink} anchor="start">
            1P
          </Txt>
        ) : (
          <PdcBox x={3.1} y={36.4} value={device.breakingCapacity ?? 3000} ink={ink} />
        )}
        <Txt x={w - 1.3} y={36} size={1} fill={ink} anchor="middle" rotate={-90}>
          {device.ref ?? "4068 24"}
        </Txt>
        <LegrandBrand x={3.1} y={43.4} lineTo={w - 1.6} />
      </g>
    );
  }
  const rx = 19;
  return (
    <g>
      <LegrandWindow x={1.5} w={w - 3} />
      <LegrandToggle cx={9} on={on} />
      <Txt x={rx + 1} y={18} size={1.25} fill={ink} anchor="start">
        IΔn
      </Txt>
      <Txt x={rx + 3.6} y={18.3} size={2.6} weight={700} fill={(device.sensitivity ?? 30) > 30 ? "#b3261e" : ink} anchor="start">
        {`${device.sensitivity ?? 30}mA`}
      </Txt>
      <RcdSymbol type={device.rcdType} x={rx + 8} y={20} ink={ink} />
      <Txt x={rx + 1} y={22.3} size={1.3} fill={ink} anchor="start">
        {`Type ${device.rcdType ?? "AC"}`}
      </Txt>
      <rect x={rx + 7.8} y={25} width="4.6" height="3.6" fill="#d9d9d6" stroke="#9e9e9b" strokeWidth=".2" />
      <rect x="1.9" y="27.4" width=".42" height="15.6" fill={LG_RED} />
      <Txt x={3.1} y={31} size={1.7} weight={700} fill={ink} anchor="start">
        DX
        <tspan fontSize="1.05" dy="-.7">
          3
        </tspan>
        <tspan dy=".7">{device.kind === "rcd" ? "-ID" : ""}</tspan>
      </Txt>
      <Txt x={3.1} y={35.8} size={3.5} weight={700} fill={ink} anchor="start">
        {device.kind === "rcbo" ? `${device.curve ?? "C"}${device.rating ?? "?"}` : `${device.rating ?? "?"}A`}
      </Txt>
      {device.kind === "rcbo" && <PdcBox x={3.1} y={37} value={4500} ink={ink} />}
      <Txt x={rx + 1} y={33.4} size={1} fill={ink} anchor="start">
        Test frequently
      </Txt>
      <Txt x={rx + 1} y={34.8} size={1} fill={ink} anchor="start">
        Tester souvent
      </Txt>
      <rect x={rx + 5.5} y={36.2} width={w - rx - 7} height="4.2" rx=".3" fill="#a9a9a6" />
      <Txt x={rx + 5.5 + (w - rx - 7) / 2} y={39.3} size={2.4} weight={700} fill="#f4f4f2">
        T
      </Txt>
      <LegrandBrand x={3.1} y={43.4} lineTo={w - 1.6} />
    </g>
  );
}

function NeutralFace({ device, w, on, skin }: { device: ArtDevice; w: number; on: boolean; skin: Skin }) {
  const s = SKIN[skin];
  const brandColor = skin === "hager" ? HG_BLUE : s.soft;
  const brandName = skin === "hager" ? "hager" : device.brand === "Lexman" ? "LEXMAN" : "";
  const residual = device.kind !== "mcb";
  const cx = residual ? 9 : w / 2;
  return (
    <g>
      {brandName && (
        <Txt x={residual ? 2 : w / 2} y={4.2} size={2.2} weight={700} fill={brandColor} anchor={residual ? "start" : "middle"} spacing={skin === "hager" ? -0.05 : 0.1}>
          {brandName}
        </Txt>
      )}
      <Txt x={cx} y={9.6} size={residual ? 2.6 : 3.3} weight={700} fill={s.ink}>
        {device.kind === "rcd" ? `${device.rating ?? "?"}A` : `${device.curve ?? "C"}${device.rating ?? "?"}`}
      </Txt>
      <GreyToggle cx={cx} on={on} top={12.5} h={18} />
      <rect x={cx - 2} y={32.2} width="4" height="1.9" rx=".4" fill={on ? "#d63a2c" : "#3aa45b"} />
      {residual ? (
        <>
          <Txt x={27} y={10} size={2.2} weight={700} fill={(device.sensitivity ?? 30) > 30 ? "#b3261e" : s.ink}>
            {`${device.sensitivity ?? 30}mA`}
          </Txt>
          <RcdSymbol type={device.rcdType} x={24.7} y={12.2} ink={s.soft} />
          <rect x={23.6} y={20} width="6.8" height="6.4" rx="1" fill={skin === "hager" ? "#c9ccd1" : "#f2c200"} stroke="#999" strokeWidth=".2" />
          <Txt x={27} y={24.4} size={2.8} weight={700} fill="#444">
            T
          </Txt>
          <Txt x={27} y={40} size={1.4} fill={s.soft}>
            {`Type ${device.rcdType ?? "AC"}`}
          </Txt>
        </>
      ) : device.poles === "1P" ? (
        <Txt x={cx} y={39.6} size={1.6} weight={700} fill={s.soft}>
          1P
        </Txt>
      ) : (
        <PdcBox x={cx - 3.8} y={37.6} value={device.breakingCapacity ?? 3000} ink={s.soft} />
      )}
      {skin === "hager" && <rect x="1.4" y="44.1" width={w - 2.8} height=".45" fill={HG_BLUE} />}
      <Txt x={residual ? 9 : cx} y={43} size={1.1} fill={s.soft}>
        230V~
      </Txt>
    </g>
  );
}

function OtherFace({ device, w, on, skin }: { device: ArtDevice; w: number; on: boolean; skin: Skin }) {
  const s = SKIN[skin];
  const cx = w / 2;
  switch (device.kind) {
    case "fuse":
      return (
        <g>
          <rect x={cx - 5.8} y="3" width="11.6" height="38" rx="2.4" fill="url(#qc-fuse)" stroke="#a89d83" strokeWidth=".35" />
          <rect x={cx - 3.6} y="5.2" width="7.2" height="5" rx="1" fill="#e9e2cf" stroke="#b3a88f" strokeWidth=".3" />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${cx - 2.8} ${6.2 + i} H${cx + 2.8}`} stroke="#a79c83" strokeWidth=".3" />
          ))}
          <Txt x={cx} y={20} size={3.8} weight={700} fill="#3a352b">
            {device.rating ?? "?"}
          </Txt>
          <Txt x={cx} y={23.8} size={2.2} weight={700} fill="#6b6456">
            A
          </Txt>
          <circle cx={cx} cy="32" r="1.7" fill={on ? "#8d9aa6" : "#c0392b"} stroke="#6b6558" strokeWidth=".25" />
        </g>
      );
    case "spd":
      return (
        <g>
          <Txt x={cx} y={4} size={1.8} weight={700} fill={skin === "schneider" ? SCH_GREEN : s.soft}>
            {skin === "schneider" ? "Schneider" : skin === "legrand" ? "legrand" : skin === "hager" ? "hager" : "Parafoudre"}
          </Txt>
          {Array.from({ length: device.modules }, (_, i) => {
            const mx = i * MODULE_MM + MODULE_MM / 2;
            return (
              <g key={i}>
                <rect x={mx - 7.2} y="6" width="14.4" height="30" rx="1.6" fill="#e6e7e4" stroke="#c4c5c0" strokeWidth=".3" />
                <rect x={mx - 3.4} y="9" width="6.8" height="4" rx=".6" fill={on ? "#46b35f" : "#d0392b"} stroke="#1e3a24" strokeWidth=".3" />
                <path d={`M${mx + 1} 17 l-3.2 6.4 h2.6 l-1.1 5.8 l3.9 -7.6 h-2.6 l1.3 -4.6 Z`} fill="#f2b800" stroke="#9d7700" strokeWidth=".2" />
              </g>
            );
          })}
          <Txt x={cx} y={40} size={1.9} weight={700} fill={s.ink}>
            Type 2 · Imax 20kA
          </Txt>
          <Txt x={cx} y={43.2} size={1.2} fill={s.soft}>
            Parafoudre 1P+N
          </Txt>
        </g>
      );
    case "contactor":
      return (
        <g>
          <Txt x={cx} y={4.4} size={2.6} weight={700} fill={s.ink}>
            {`${device.rating ?? 20}A`}
          </Txt>
          <rect x={cx - 3.4} y="8" width="6.8" height="17" rx="1.1" fill="#2a2d31" />
          <rect x={cx - 2.8} y={on ? 12.5 : 17} width="5.6" height="5.5" rx=".8" fill="url(#qc-lever-grey)" />
          <Txt x={cx} y={28} size={1.35} fill={s.soft}>
            I · AUTO · 0
          </Txt>
          <circle cx={cx} cy="32" r="1.3" fill={on ? "#46b35f" : "#9aa0a6"} stroke="#3a3f46" strokeWidth=".2" />
          <Txt x={cx} y={40.4} size={2.6} weight={700} fill="#1f5dc4">
            HC
          </Txt>
          <Txt x={cx} y={43.4} size={1} fill={s.soft}>
            Jour / Nuit
          </Txt>
        </g>
      );
    case "teleruptor":
      if (skin === "legrand")
        return (
          <g>
            <LegrandWindow x={1.5} w={w - 3} />
            <rect x={cx - 5.2} y="15.5" width="10.4" height="15" rx=".8" fill="#d9d9d6" stroke="#a9a9a6" strokeWidth=".3" />
            <rect x={cx - 3.6} y={on ? 16.6 : 22.2} width="7.2" height="7.2" rx=".8" fill="url(#qc-lever-grey)" />
            <path d={`M${cx - 2.6} ${(on ? 16.6 : 22.2) + 2.4} H${cx + 2.6}`} stroke="#000" strokeOpacity=".25" strokeWidth=".3" />
            <Txt x={cx} y={35.4} size={2.7} weight={700} fill={s.ink}>
              {`${device.rating ?? 16}AX`}
            </Txt>
            <Txt x={cx} y={38.4} size={1.2} fill={s.soft}>
              250V~
            </Txt>
            <LegrandBrand x={3.1} y={43.4} lineTo={w - 1.6} />
          </g>
        );
      return (
        <g>
          <Txt x={cx} y={4.6} size={2.6} weight={700} fill={s.ink}>
            {`${device.rating ?? 16}A`}
          </Txt>
          <rect x={cx - 3.4} y="9" width="6.8" height="11" rx="1.1" fill="#2a2d31" />
          <rect x={cx - 2.6} y={on ? 10 : 14} width="5.2" height="4.8" rx=".8" fill="url(#qc-lever-grey)" />
          <circle cx={cx} cy="28" r="3" fill="#e3e4e0" stroke="#9aa0a6" strokeWidth=".35" />
          <Txt x={cx} y={41} size={2.6} weight={700} fill={s.ink}>
            TL
          </Txt>
        </g>
      );
    case "switch":
      return (
        <g>
          <Txt x={cx} y={5} size={2.8} weight={700} fill={s.ink}>
            {`${device.rating ?? 40}A`}
          </Txt>
          <rect x={cx - 6} y="10" width="12" height="22" rx="1.2" fill="#2a2d31" />
          <rect x={cx - 5.2} y={on ? 11 : 20.5} width="10.4" height="10.5" rx="1" fill={on ? "#c9302c" : "url(#qc-lever-grey)"} />
          <Txt x={cx} y={40.5} size={1.9} weight={700} fill={s.soft}>
            I – O
          </Txt>
        </g>
      );
    case "timer":
      return (
        <g>
          <rect x={2.2} y="7" width={w - 4.4} height="9.4" rx="1" fill="#1f2226" />
          <rect x={3} y="7.8" width={w - 6} height="7.8" rx=".6" fill="#b9c9a0" />
          <Txt x={cx} y={13.4} size={w > 20 ? 4 : 2.9} weight={700} fill="#2b3a22">
            12:00
          </Txt>
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={cx - 4 + i * 4} cy="25" r="1.3" fill="#d4d6d0" stroke="#8f959b" strokeWidth=".25" />
          ))}
        </g>
      );
    case "socket": {
      const r = Math.min(w, NOSE_H) / 2 - 5;
      const cy = NOSE_H / 2 + 1;
      return (
        <g>
          <circle cx={cx} cy={cy} r={r} fill="#f3f3f0" stroke="#bcbfb8" strokeWidth=".4" />
          <circle cx={cx} cy={cy} r={r - 2} fill="none" stroke="#d6d8d2" strokeWidth=".3" />
          <circle cx={cx - r * 0.42} cy={cy} r="1.3" fill="#2a2d31" />
          <circle cx={cx + r * 0.42} cy={cy} r="1.3" fill="#2a2d31" />
          <rect x={cx - 0.9} y={cy - r + 1.3} width="1.8" height="3" rx=".6" fill="url(#qc-screw)" />
        </g>
      );
    }
    case "blank":
      return <rect x="2" y="3" width={w - 4} height={NOSE_H - 6} rx="1" fill="none" stroke="#000" strokeOpacity=".06" strokeWidth=".35" />;
    default:
      return (
        <g>
          <rect x={cx - 4} y="10" width="8" height="14" rx="1.2" fill="#dadcd6" stroke="#aeb2ab" strokeWidth=".3" />
          <Txt x={cx} y={36} size={1.8} fill={s.soft}>
            {(device.label ?? "").slice(0, Math.max(4, device.modules * 6))}
          </Txt>
        </g>
      );
  }
}
