import { type CSSProperties, type DragEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { findingsForDevice, worstSeverity } from "../domain/analysis";
import { USAGES } from "../domain/norm";
import { deviceTitle, isCircuitDevice, isHighSensitivity, protectionMap, repereMap, rowModules } from "../domain/panel";
import type { Device, Finding, Panel } from "../domain/types";
import { DEVICE_H, DeviceArt, MODULE_MM, NOSE_H, NOSE_Y, skinOf } from "./DeviceArt";
import { IconPlus, Picto } from "./icons";

export type PanelViewMode = "front" | "open";

/** Entraxe réel entre deux rangées d'un coffret résidentiel (Resi9, Drivia, Gamma). */
export const ROW_PITCH_MM = 125;
/** Marge entre le haut de la rangée et le haut de l'appareil posé sur le rail. */
const ROW_TOP_MM = (ROW_PITCH_MM - DEVICE_H) / 2;
/** Position du nez de l'appareil (partie visible capot fermé) dans la rangée. */
const NOSE_TOP_MM = ROW_TOP_MM + NOSE_Y;
const LABEL_H_MM = 11;

export const DRAG_DEVICE = "application/x-qc-device";
export const DRAG_CATALOG = "application/x-qc-catalog";

interface Props {
  panel: Panel;
  findings: Finding[];
  mode: PanelViewMode;
  selectedId?: string;
  readOnly?: boolean;
  /** Échelle maximale (px/mm). */
  maxScale?: number;
  onSelect?(id?: string): void;
  onAdd?(row: number): void;
  onMove?(id: string, row: number, index: number): void;
  onInsert?(catalogId: string, row: number, index: number): void;
}

export const GROUP_COLORS = ["#2f6df6", "#0e9f9f", "#9b51e0", "#e0891a", "#3f9b3a", "#d6457f"];

export function rcdColors(panel: Panel): Map<string, string> {
  const map = new Map<string, string>();
  let i = 0;
  for (const row of panel.rows) for (const d of row) if (d.kind === "rcd" || d.kind === "rcbo") map.set(d.id, GROUP_COLORS[i++ % GROUP_COLORS.length]);
  return map;
}

/** Échelle (px/mm) ajustée à la largeur disponible, pour que le coffret tienne sans défilement. */
function useFitScale(widestModules: number, max: number): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      setWidth(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Marges du coffret, du plastron et des numéros de rangée.
  const chrome = 118;
  return [ref, Math.max(1.1, Math.min(max, (width - chrome) / (widestModules * MODULE_MM)))];
}

function labelText(d: Device): string {
  if (d.label) return d.label;
  if (d.circuit) return USAGES[d.circuit.usage].label;
  if (d.kind === "rcd") return "Différentiel";
  return deviceTitle(d);
}

function pictoFor(d: Device) {
  if (d.circuit) return d.circuit.usage;
  if (d.kind === "rcd" || d.kind === "rcbo") return "rcd" as const;
  if (d.kind === "spd") return "spd" as const;
  if (d.kind === "contactor" || d.kind === "timer" || d.kind === "teleruptor") return "contactor" as const;
  return "generic" as const;
}

export function PanelVisual({ panel, findings, mode, selectedId, readOnly, maxScale = 2.5, onSelect, onAdd, onMove, onInsert }: Props) {
  const guards = useMemo(() => protectionMap(panel), [panel]);
  const colors = useMemo(() => rcdColors(panel), [panel]);
  const reperes = useMemo(() => repereMap(panel), [panel]);
  const [dragId, setDragId] = useState<string>();
  const [drop, setDrop] = useState<{ row: number; index: number }>();

  const rowCount = Math.max(panel.enclosure.rows, panel.rows.length);
  const mpr = panel.enclosure.modulesPerRow;
  const widest = Math.max(mpr, ...panel.rows.map(rowModules));
  const [stageRef, scale] = useFitScale(widest, maxScale);
  const mod = MODULE_MM * scale;
  const skin = skinOf(panel.enclosure.brand);
  const style = {
    "--mod": `${mod}px`,
    "--row-w": `${mpr * mod}px`,
    "--nose-h": `${NOSE_H * scale}px`,
    "--dev-h": `${DEVICE_H * scale}px`,
    "--pitch": `${ROW_PITCH_MM * scale}px`,
    "--row-top": `${ROW_TOP_MM * scale}px`,
    "--nose-top": `${NOSE_TOP_MM * scale}px`,
    "--label-h": `${Math.max(24, LABEL_H_MM * scale)}px`,
    "--s": scale,
  } as CSSProperties;

  const endDrag = () => {
    setDragId(undefined);
    setDrop(undefined);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const catalogId = e.dataTransfer.getData(DRAG_CATALOG);
    const id = dragId ?? e.dataTransfer.getData(DRAG_DEVICE);
    if (drop) {
      if (catalogId) onInsert?.(catalogId, drop.row, drop.index);
      else if (id) onMove?.(id, drop.row, drop.index);
    }
    endDrag();
  };
  const acceptsDrop = (e: DragEvent) => !readOnly && (e.dataTransfer.types.includes(DRAG_DEVICE) || e.dataTransfer.types.includes(DRAG_CATALOG));

  const renderDevice = (d: Device, r: number, i: number) => {
    const guard = guards.get(d.id);
    const unprotected = isCircuitDevice(d) && (!guard || !isHighSensitivity(guard));
    const own = findingsForDevice(findings, d.id).filter((f) => f.severity !== "conseil");
    const sev = worstSeverity(own);
    const marker = drop && drop.row === r && drop.index === i && dragId !== d.id;
    const undescribed = isCircuitDevice(d) && !d.circuit;
    return (
      <div key={d.id} className="dev-slot" style={{ width: d.modules * mod }}>
        {marker && <span className="drop-marker" />}
        <button
          type="button"
          className="dev"
          disabled={readOnly && !onSelect}
          aria-pressed={selectedId === d.id}
          aria-label={`${reperes.get(d.id) ?? ""} ${deviceTitle(d)} — ${labelText(d)}${unprotected ? ", sans protection 30 mA" : ""}`}
          data-dragging={dragId === d.id}
          draggable={!readOnly}
          onDragStart={(e) => {
            setDragId(d.id);
            e.dataTransfer.setData(DRAG_DEVICE, d.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={endDrag}
          onDragOver={(e) => {
            if (!acceptsDrop(e)) return;
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            setDrop({ row: r, index: e.clientX > rect.left + rect.width / 2 ? i + 1 : i });
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(selectedId === d.id ? undefined : d.id);
          }}
        >
          <DeviceArt device={d} view={mode === "front" ? "front" : "full"} scale={scale} />
          {!readOnly && sev && (
            <span className="dev-badge" data-sev={sev} title={own.map((f) => f.title).join("\n")}>
              {own.length}
            </span>
          )}
          {!readOnly && undescribed && (
            <span className="dev-badge dev-badge--todo" title="Circuit non décrit">
              ?
            </span>
          )}
        </button>
        {mode === "open" && isCircuitDevice(d) && <Wires device={d} mod={mod} height={ROW_TOP_MM * scale - 2} unprotected={unprotected} />}
        {mode === "open" && d.kind === "rcd" && <SupplyWires mod={mod} modules={d.modules} height={ROW_TOP_MM * scale} />}
      </div>
    );
  };

  return (
    <div className="panel-stage" ref={stageRef} data-readonly={readOnly} onClick={() => onSelect?.(undefined)}>
      <div className={`coffret coffret--${mode}`} data-skin={skin} style={style} onClick={(e) => e.stopPropagation()}>
        {["tl", "tr", "bl", "br"].map((c) => (
          <span key={c} className={`screw screw--${c}`} aria-hidden="true" />
        ))}
        <div className="plastron">
          {Array.from({ length: rowCount }, (_, r) => {
            const row = panel.rows[r] ?? [];
            const used = rowModules(row);
            const free = Math.max(0, mpr - used);
            const over = used > mpr;
            const seam = `${(skin === "schneider" ? 5 : 1) * mod}px`;
            return (
              <div className="prow" key={r} data-over={over}>
                {mode === "front" && (
                  <div className="label-holder" aria-hidden="true">
                    <span className="label-tab" />
                    <div className="label-paper">
                      {row.map((d) => {
                        const guard = guards.get(d.id);
                        const color = d.kind === "rcd" || d.kind === "rcbo" ? colors.get(d.id) : guard ? colors.get(guard.id) : undefined;
                        const unprotected = isCircuitDevice(d) && (!guard || !isHighSensitivity(guard));
                        return (
                          <span
                            key={d.id}
                            className="label-cell"
                            data-selected={selectedId === d.id}
                            style={{ width: d.modules * mod, ["--grp" as string]: unprotected ? "#d33a2f" : color ?? "transparent" }}
                            title={`${reperes.get(d.id) ?? ""} · ${labelText(d)}`}
                          >
                            <span className="label-top">
                              <Picto kind={pictoFor(d)} size={Math.max(9, Math.min(13, scale * 5.2))} />
                              <span className="label-ref">{reperes.get(d.id)}</span>
                            </span>
                            <span className="label-text">{labelText(d)}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div
                  className="cutout"
                  role="list"
                  aria-label={`Rangée ${r + 1} : ${used} modules occupés sur ${mpr}`}
                  onDragOver={(e) => {
                    if (!acceptsDrop(e)) return;
                    e.preventDefault();
                    if (e.target === e.currentTarget) setDrop({ row: r, index: row.length });
                  }}
                  onDrop={handleDrop}
                >
                  {mode === "open" && <span className="din-rail" aria-hidden="true" />}
                  {mode === "open" && <Comb row={row} guards={guards} mod={mod} scale={scale} />}
                  {row.map((d, i) => renderDevice(d, r, i))}
                  {drop && drop.row === r && drop.index === row.length && <span className="drop-marker drop-marker--end" />}
                  {free > 0 &&
                    (readOnly ? (
                      <span className="blanking" style={{ width: free * mod, ["--seam" as string]: seam }} />
                    ) : (
                      <button
                        type="button"
                        className="blanking"
                        aria-label={`Ajouter un appareil en rangée ${r + 1}`}
                        style={{ width: free * mod, ["--seam" as string]: seam }}
                        onClick={() => onAdd?.(r)}
                        onDragOver={(e) => {
                          if (!acceptsDrop(e)) return;
                          e.preventDefault();
                          setDrop({ row: r, index: row.length });
                        }}
                        onDrop={handleDrop}
                      >
                        <span className="blanking-cta">
                          <IconPlus size={14} />
                          {free >= 3 && <span>{free} libres</span>}
                        </span>
                      </button>
                    ))}
                  {over && <span className="overflow-flag">+{used - mpr} module{used - mpr > 1 ? "s" : ""} de trop</span>}
                </div>
                <span className="prow-index" aria-hidden="true">
                  {r + 1}
                </span>
              </div>
            );
          })}
          {mode === "open" && (
            <div className="earth-bar" aria-label="Barrette de terre">
              {Array.from({ length: Math.max(6, Math.round(widest / 1.5)) }, (_, i) => (
                <span key={i} />
              ))}
            </div>
          )}
        </div>
        <div className="coffret-foot" aria-hidden="true">
          <span className="coffret-brand">{panel.enclosure.brand === "Générique" ? "" : panel.enclosure.brand === "Schneider" ? "Schneider Electric" : panel.enclosure.brand.toLowerCase()}</span>
        </div>
      </div>
    </div>
  );
}

/** Peigne d'alimentation horizontal posé sur les bornes hautes des départs protégés par un différentiel. */
function Comb({ row, guards, mod, scale }: { row: Device[]; guards: Map<string, Device | null>; mod: number; scale: number }) {
  const segments: { start: number; end: number }[] = [];
  let x = 0;
  let current: { start: number; end: number } | null = null;
  for (const d of row) {
    const fed = d.kind !== "rcd" && d.kind !== "spd" && d.kind !== "blank" && guards.get(d.id)?.kind === "rcd";
    if (fed) {
      if (!current) current = { start: x, end: x };
      current.end = x + d.modules;
    } else if (current) {
      segments.push(current);
      current = null;
    }
    x += d.modules;
  }
  if (current) segments.push(current);
  return (
    <>
      {segments.map((s, i) => (
        <span key={i} className="comb" style={{ left: s.start * mod + 2, width: (s.end - s.start) * mod - 4, top: 1.6 * scale }} aria-hidden="true" />
      ))}
    </>
  );
}

function Wires({ device, mod, height, unprotected }: { device: Device; mod: number; height: number; unprotected: boolean }) {
  const w = device.modules * mod;
  const h = Math.max(12, height);
  const p = w * 0.28;
  const n = w * 0.72;
  return (
    <svg className="wires" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`M${p} 0 C${p} ${h * 0.5}, ${p - 3} ${h * 0.7}, ${p - 2} ${h}`} stroke="#7a4a26" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d={`M${n} 0 C${n} ${h * 0.5}, ${n + 3} ${h * 0.7}, ${n + 2} ${h}`} stroke="#2a5bd7" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      {unprotected && <circle cx={w / 2} cy={h - 6} r="4.5" fill="#d33a2f" />}
    </svg>
  );
}

function SupplyWires({ mod, modules, height }: { mod: number; modules: number; height: number }) {
  const w = modules * mod;
  const h = Math.max(12, height);
  const p = w * 0.72;
  const n = w * 0.28;
  return (
    <svg className="wires wires--up" width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ top: -h }} aria-hidden="true">
      <path d={`M${p} ${h} C${p} ${h * 0.5}, ${p + 2} ${h * 0.3}, ${p + 1} 0`} stroke="#7a4a26" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d={`M${n} ${h} C${n} ${h * 0.5}, ${n - 2} ${h * 0.3}, ${n - 1} 0`} stroke="#2a5bd7" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
