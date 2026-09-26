/**
 * Dessin réaliste d'un appareil modulaire (unités en millimètres, module de 18 mm).
 * Vue « front » : seul le nez de l'appareil dépasse du plastron (capot fermé).
 * Vue « full » : appareil entier avec ses bornes à vis (capot ouvert).
 */
import type { ReactNode } from "react";
import type { Device, RcdType } from "../domain/types";

export const MODULE_MM = 18;
export const DEVICE_H = 90;
export const NOSE_Y = 22;
export const NOSE_H = 46;

const PRINT = "Arial, Helvetica, sans-serif";

/** Dégradés partagés, à rendre une seule fois dans la page. */
export function DeviceDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="qc-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f6f3" />
          <stop offset="1" stopColor="#e2e2dc" />
        </linearGradient>
        <linearGradient id="qc-body-aged" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe9d8" />
          <stop offset="1" stopColor="#d9d0b9" />
        </linearGradient>
        <linearGradient id="qc-nose" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e9e9e4" />
          <stop offset=".12" stopColor="#f8f8f6" />
          <stop offset=".88" stopColor="#f8f8f6" />
          <stop offset="1" stopColor="#e4e4de" />
        </linearGradient>
        <linearGradient id="qc-nose-aged" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e2dbc6" />
          <stop offset=".12" stopColor="#f1ebda" />
          <stop offset=".88" stopColor="#f1ebda" />
          <stop offset="1" stopColor="#ddd5bd" />
        </linearGradient>
        <linearGradient id="qc-lever" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2a2d32" />
          <stop offset=".45" stopColor="#50555c" />
          <stop offset="1" stopColor="#2c3035" />
        </linearGradient>
        <linearGradient id="qc-lever-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".28" />
          <stop offset=".5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="qc-screw" cx=".38" cy=".35" r=".75">
          <stop offset="0" stopColor="#f3f5f7" />
          <stop offset=".6" stopColor="#b3b9bf" />
          <stop offset="1" stopColor="#7c838a" />
        </radialGradient>
        <linearGradient id="qc-test" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd84a" />
          <stop offset="1" stopColor="#e2ad00" />
        </linearGradient>
        <linearGradient id="qc-fuse" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9d1bd" />
          <stop offset=".5" stopColor="#f4efe3" />
          <stop offset="1" stopColor="#d4ccb6" />
        </linearGradient>
        <linearGradient id="qc-spd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a6068" />
          <stop offset="1" stopColor="#3b4047" />
        </linearGradient>
      </defs>
    </svg>
  );
}

type ArtDevice = Pick<Device, "kind" | "modules" | "rating" | "curve" | "poles" | "breakingCapacity" | "rcdType" | "sensitivity" | "brand" | "condition" | "label">;

interface Props {
  device: ArtDevice;
  view: "front" | "full";
  /** Pixels par millimètre. */
  scale: number;
}

export function DeviceArt({ device, view, scale }: Props) {
  const w = MODULE_MM * Math.max(1, device.modules);
  const aged = device.condition === "usé" || (device.brand === "Générique" && device.kind === "fuse");
  const on = device.condition !== "HS";
  const vb = view === "front" ? `0 ${NOSE_Y} ${w} ${NOSE_H}` : `0 0 ${w} ${DEVICE_H}`;
  const height = (view === "front" ? NOSE_H : DEVICE_H) * scale;
  return (
    <svg width={w * scale} height={height} viewBox={vb} role="img" aria-hidden="true" style={{ display: "block" }}>
      <rect x=".25" y=".2" width={w - 0.5} height={DEVICE_H - 0.4} rx="1.4" fill={aged ? "url(#qc-body-aged)" : "url(#qc-body)"} stroke="#aeb1aa" strokeWidth=".3" />
      {view === "full" && <Terminals device={device} w={w} />}
      <rect
        x=".45"
        y={NOSE_Y + 0.25}
        width={w - 0.9}
        height={NOSE_H - 0.5}
        rx="1.6"
        fill={aged ? "url(#qc-nose-aged)" : "url(#qc-nose)"}
        stroke="#c3c5be"
        strokeWidth=".3"
      />
      <path d={`M1.6 ${NOSE_Y + 0.6} H${w - 1.6}`} stroke="#ffffff" strokeWidth=".5" opacity=".8" />
      {Array.from({ length: device.modules - 1 }, (_, i) => (
        <path key={i} d={`M${(i + 1) * MODULE_MM} ${view === "full" ? 1 : NOSE_Y + 44} V${view === "full" ? NOSE_Y : NOSE_Y + 45.5}`} stroke="#c9cbc4" strokeWidth=".3" />
      ))}
      <Face device={device} w={w} on={on} />
    </svg>
  );
}

function Terminals({ device, w }: { device: ArtDevice; w: number }) {
  // Phase et neutre : deux bornes en haut, deux en bas.
  const xs = [w * 0.27, w * 0.73];
  const neutralX = device.kind === "rcd" ? xs[0] : xs[1];
  const r = device.modules === 1 ? 1.9 : 2.4;
  const screw = (x: number, y: number, key: string) => (
    <g key={key}>
      <circle cx={x} cy={y} r={r} fill="url(#qc-screw)" stroke="#6d737a" strokeWidth=".25" />
      <path d={`M${x - r * 0.7} ${y + r * 0.7} L${x + r * 0.7} ${y - r * 0.7}`} stroke="#4e545a" strokeWidth=".5" strokeLinecap="round" />
    </g>
  );
  return (
    <g>
      {xs.map((x, i) => (
        <g key={i}>
          <rect x={x - r - 0.3} y="2" width={2 * r + 0.6} height="4.2" rx=".6" fill="#1b1e22" />
          <rect x={x - r - 0.3} y={DEVICE_H - 6.2} width={2 * r + 0.6} height="4.2" rx=".6" fill="#1b1e22" />
          {screw(x, 11, `t${i}`)}
          {screw(x, DEVICE_H - 11, `b${i}`)}
        </g>
      ))}
      {device.kind !== "spd" && device.kind !== "blank" && (
        <>
          <text x={neutralX} y="17.6" fontSize="2.4" fontFamily={PRINT} fontWeight="700" fill="#2c5bd0" textAnchor="middle">
            N
          </text>
          <text x={neutralX} y={DEVICE_H - 15} fontSize="2.4" fontFamily={PRINT} fontWeight="700" fill="#2c5bd0" textAnchor="middle">
            N
          </text>
        </>
      )}
    </g>
  );
}

function Text({ x, y, size, weight = 400, fill = "#1f2328", anchor = "middle", children, spacing }: { x: number; y: number; size: number; weight?: number; fill?: string; anchor?: "start" | "middle" | "end"; children: ReactNode; spacing?: number }) {
  return (
    <text x={x} y={y} fontSize={size} fontFamily={PRINT} fontWeight={weight} fill={fill} textAnchor={anchor} letterSpacing={spacing}>
      {children}
    </text>
  );
}

function Lever({ cx, on, top = NOSE_Y + 12.5, height = 20, width = 6.8 }: { cx: number; on: boolean; top?: number; height?: number; width?: number }) {
  const lw = width - 1.2;
  const lh = height * 0.52;
  const ly = on ? top + 0.8 : top + height - lh - 0.8;
  return (
    <g>
      <rect x={cx - width / 2} y={top} width={width} height={height} rx="1.3" fill="#17191c" />
      <rect x={cx - width / 2 + 0.35} y={top + 0.35} width={width - 0.7} height={height - 0.7} rx="1.1" fill="#26292d" />
      <rect x={cx - lw / 2} y={ly} width={lw} height={lh} rx="1" fill="url(#qc-lever)" />
      <rect x={cx - lw / 2} y={ly} width={lw} height={lh} rx="1" fill="url(#qc-lever-top)" />
      {[0.3, 0.5, 0.7].map((f) => (
        <path key={f} d={`M${cx - lw / 2 + 0.8} ${ly + lh * f} H${cx + lw / 2 - 0.8}`} stroke="#1c1f23" strokeWidth=".35" opacity=".7" />
      ))}
      <Text x={cx} y={top - 0.9} size={2.1} fill="#6b7178" weight={700}>
        I
      </Text>
      <Text x={cx} y={top + height + 2.6} size={2.1} fill="#6b7178" weight={700}>
        O
      </Text>
    </g>
  );
}

function Indicator({ cx, y, on }: { cx: number; y: number; on: boolean }) {
  return <rect x={cx - 2} y={y} width="4" height="1.9" rx=".5" fill={on ? "#d63a2c" : "#3aa45b"} stroke="#6f6f6a" strokeWidth=".2" />;
}

function BrandMark({ brand, x, y }: { brand?: string; x: number; y: number }) {
  if (!brand || brand === "Générique") return null;
  return (
    <Text x={x} y={y} size={2.2} fill="#7a8088" weight={700} spacing={0.1}>
      {brand.toLowerCase()}
    </Text>
  );
}

function RcdSymbol({ type, x, y, w = 10 }: { type?: RcdType; x: number; y: number; w?: number }) {
  const h = 5.4;
  const sine = `M${x + 1} ${y + h / 2} q${(w - 2) / 8} ${-h * 0.55} ${(w - 2) / 4} 0 t${(w - 2) / 4} 0 t${(w - 2) / 4} 0 t${(w - 2) / 4} 0`;
  const pulses =
    type && type !== "AC"
      ? `M${x + 1.2} ${y + h - 0.6} q.9 -2.2 1.8 0 M${x + 4} ${y + h - 0.6} q.9 -2.2 1.8 0`
      : "";
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx=".5" fill="none" stroke="#3a3f46" strokeWidth=".3" />
      <path d={sine} fill="none" stroke="#1f2328" strokeWidth=".35" transform={type && type !== "AC" ? `translate(0 -1)` : undefined} />
      {pulses && <path d={pulses} fill="none" stroke="#1f2328" strokeWidth=".35" />}
      {type && type !== "AC" && type !== "A" && (
        <Text x={x + w - 1.6} y={y + h - 0.8} size={2} weight={700}>
          {type === "A-SI" ? "SI" : type}
        </Text>
      )}
      {type === "B" && <path d={`M${x + 6} ${y + h - 1.2} h3 M${x + 6} ${y + h - 0.6} h3`} stroke="#1f2328" strokeWidth=".3" strokeDasharray=".6 .4" />}
    </g>
  );
}

function Face({ device, w, on }: { device: ArtDevice; w: number; on: boolean }) {
  const cx = w / 2;
  const top = NOSE_Y;
  switch (device.kind) {
    case "mcb":
      return (
        <g>
          <BrandMark brand={device.brand} x={cx} y={top + 3.8} />
          <Text x={cx} y={top + 9} size={4.6} weight={700}>
            {`${device.curve ?? ""}${device.rating ?? "?"}`}
          </Text>
          <Lever cx={cx} on={on} />
          <Indicator cx={cx} y={top + 35.6} on={on} />
          {device.poles === "1P" ? (
            <Text x={cx} y={top + 41.6} size={2.2} fill="#5b6168" weight={700}>
              1P
            </Text>
          ) : (
            device.breakingCapacity && (
              <g>
                <rect x={cx - 4.4} y={top + 38.6} width="8.8" height="3.8" fill="none" stroke="#50565d" strokeWidth=".25" />
                <Text x={cx} y={top + 41.5} size={2.3} weight={700}>
                  {device.breakingCapacity}
                </Text>
              </g>
            )
          )}
        </g>
      );
    case "rcd":
    case "rcbo": {
      const lx = w * 0.3;
      const rx = w * 0.7;
      return (
        <g>
          <BrandMark brand={device.brand} x={lx} y={top + 3.8} />
          <Text x={rx} y={top + 5.4} size={3.6} weight={700}>
            {device.kind === "rcbo" ? `${device.curve ?? "C"}${device.rating ?? "?"}` : `${device.rating ?? "?"}A`}
          </Text>
          <Text x={rx} y={top + 9.4} size={2.8} weight={700} fill={(device.sensitivity ?? 30) > 30 ? "#b3261e" : "#1f2328"}>
            {`${device.sensitivity ?? 30}mA`}
          </Text>
          <RcdSymbol type={device.rcdType} x={rx - 5} y={top + 11.2} />
          <Lever cx={lx} on={on} />
          <Indicator cx={lx} y={top + 35.6} on={on} />
          <g>
            <rect x={rx - 3.6} y={top + 21.5} width="7.2" height="7.2" rx="1.2" fill="#caa000" />
            <rect x={rx - 3.2} y={top + 21.8} width="6.4" height="6.2" rx="1" fill="url(#qc-test)" />
            <Text x={rx} y={top + 26.4} size={3.4} weight={700} fill="#4d3b00">
              T
            </Text>
          </g>
          <Text x={rx} y={top + 34.6} size={2} fill="#5b6168">
            {device.kind === "rcbo" ? "DDR" : "ID"}
          </Text>
          <Text x={cx} y={top + 42.5} size={2} fill="#5b6168">
            230V~
          </Text>
        </g>
      );
    }
    case "fuse":
      return (
        <g>
          <rect x={cx - 5.6} y={top + 4} width="11.2" height="37" rx="2.2" fill="url(#qc-fuse)" stroke="#a79c83" strokeWidth=".35" />
          <rect x={cx - 3.4} y={top + 6.2} width="6.8" height="4.5" rx="1" fill="#e8e1cf" stroke="#b3a88f" strokeWidth=".3" />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${cx - 2.6} ${top + 7.2 + i * 0.9} H${cx + 2.6}`} stroke="#a79c83" strokeWidth=".3" />
          ))}
          <Text x={cx} y={top + 20} size={3.8} weight={700}>
            {device.rating ?? "?"}
          </Text>
          <Text x={cx} y={top + 23.8} size={2.4} weight={700} fill="#5b6168">
            A
          </Text>
          <circle cx={cx} cy={top + 32} r="1.6" fill={on ? "#8d9aa6" : "#c0392b"} stroke="#6b6558" strokeWidth=".25" />
        </g>
      );
    case "spd":
      return (
        <g>
          <BrandMark brand={device.brand} x={cx} y={top + 3.6} />
          {Array.from({ length: device.modules }, (_, i) => {
            const mx = i * MODULE_MM + MODULE_MM / 2;
            return (
              <g key={i}>
                <rect x={mx - 7} y={top + 6} width="14" height="30" rx="1.6" fill="url(#qc-spd)" />
                <rect x={mx - 3.2} y={top + 9} width="6.4" height="4" rx=".6" fill={on ? "#46b35f" : "#d0392b"} stroke="#1e3a24" strokeWidth=".3" />
                <path d={`M${mx + 0.9} ${top + 17} l-3 6 h2.4 l-1 5.5 l3.6 -7.2 h-2.4 l1.2 -4.3 Z`} fill="#f2c200" />
              </g>
            );
          })}
          <Text x={cx} y={top + 40.2} size={2.2} weight={700} fill="#3b4047">
            Type 2 · 20kA
          </Text>
        </g>
      );
    case "contactor":
      return (
        <g>
          <Text x={cx} y={top + 5} size={3} weight={700}>
            {`${device.rating ?? 20}A`}
          </Text>
          <rect x={cx - 3.2} y={top + 9} width="6.4" height="16" rx="1.2" fill="#1f2226" />
          <rect x={cx - 2.6} y={top + (on ? 14.5 : 18)} width="5.2" height="5" rx=".8" fill="url(#qc-lever)" />
          <Text x={cx + 5.2} y={top + 11.5} size={1.7} anchor="end" fill="#5b6168">
            I
          </Text>
          <Text x={cx} y={top + 28.4} size={1.8} fill="#5b6168">
            AUTO · 0
          </Text>
          <circle cx={cx} cy={top + 32} r="1.3" fill={on ? "#46b35f" : "#9aa0a6"} stroke="#3a3f46" strokeWidth=".2" />
          <Text x={cx} y={top + 40.5} size={3} weight={700} fill="#2c5bd0">
            HC
          </Text>
        </g>
      );
    case "teleruptor":
      return (
        <g>
          <Text x={cx} y={top + 5} size={3} weight={700}>
            {`${device.rating ?? 16}A`}
          </Text>
          <rect x={cx - 3.2} y={top + 10} width="6.4" height="11" rx="1.2" fill="#1f2226" />
          <rect x={cx - 2.4} y={top + (on ? 11 : 15)} width="4.8" height="4.6" rx=".8" fill="url(#qc-lever)" />
          <circle cx={cx} cy={top + 29} r="3" fill="#dfe1dc" stroke="#9aa0a6" strokeWidth=".35" />
          <Text x={cx} y={top + 40.5} size={3} weight={700}>
            TL
          </Text>
        </g>
      );
    case "switch":
      return (
        <g>
          <Text x={cx} y={top + 5.2} size={3.2} weight={700}>
            {`${device.rating ?? 40}A`}
          </Text>
          <Lever cx={cx} on={on} width={10} />
          <Text x={cx} y={top + 40.8} size={2.2} weight={700} fill="#5b6168">
            I – O
          </Text>
        </g>
      );
    case "timer":
      return (
        <g>
          <rect x={2.2} y={top + 8} width={w - 4.4} height="9" rx="1" fill="#1f2226" />
          <rect x={3} y={top + 8.8} width={w - 6} height="7.4" rx=".6" fill="#b9c9a0" />
          <Text x={cx} y={top + 14.2} size={w > 20 ? 4 : 3} weight={700} fill="#2b3a22">
            12:00
          </Text>
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={cx - 4 + i * 4} cy={top + 25} r="1.3" fill="#d4d6d0" stroke="#8f959b" strokeWidth=".25" />
          ))}
        </g>
      );
    case "socket": {
      const r = Math.min(w, NOSE_H) / 2 - 5;
      const cy = top + NOSE_H / 2 + 1;
      return (
        <g>
          <BrandMark brand={device.brand} x={cx} y={top + 3.6} />
          <circle cx={cx} cy={cy} r={r} fill="#f1f1ed" stroke="#b8bbb4" strokeWidth=".4" />
          <circle cx={cx} cy={cy} r={r - 2} fill="none" stroke="#d3d5cf" strokeWidth=".3" />
          <circle cx={cx - r * 0.42} cy={cy} r="1.3" fill="#2a2d31" />
          <circle cx={cx + r * 0.42} cy={cy} r="1.3" fill="#2a2d31" />
          <rect x={cx - 0.9} y={cy - r + 1.3} width="1.8" height="3" rx=".6" fill="url(#qc-screw)" />
        </g>
      );
    }
    case "blank":
      return (
        <g>
          <rect x="2" y={top + 3} width={w - 4} height={NOSE_H - 6} rx="1" fill="none" stroke="#dcddd7" strokeWidth=".35" />
        </g>
      );
    default:
      return (
        <g>
          <BrandMark brand={device.brand} x={cx} y={top + 3.8} />
          <rect x={cx - 4} y={top + 12} width="8" height="14" rx="1.2" fill="#dadcd6" stroke="#aeb2ab" strokeWidth=".3" />
          <Text x={cx} y={top + 36} size={2.2} fill="#5b6168">
            {(device.label ?? "").slice(0, Math.max(3, device.modules * 5))}
          </Text>
        </g>
      );
  }
}
