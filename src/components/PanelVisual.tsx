import React, { type CSSProperties, type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { findingsForDevice, worstSeverity } from "../domain/analysis";
import { USAGES } from "../domain/norm";
import { deviceTitle, isCircuitDevice, isHighSensitivity, protectionMap, rowModules } from "../domain/panel";
import type { Device, Finding, Panel } from "../domain/types";
import { DEVICE_H, DeviceArt, MODULE_MM, NOSE_H } from "./DeviceArt";
import { IconPlus, Picto } from "./icons";

export type PanelViewMode = "front" | "open";

interface Props {
  panel: Panel;
  findings: Finding[];
  selectedId?: string;
  mode: PanelViewMode;
  onSelect(id?: string): void;
  onAdd(row: number): void;
  onMove(id: string, row: number, index: number): void;
}

export const GROUP_COLORS = ["#3b6cf6", "#0e9f9f", "#9b51e0", "#e0891a", "#3f9b3a", "#d6457f"];

export function rcdColors(panel: Panel): Map<string, string> {
  const map = new Map<string, string>();
  let i = 0;
  for (const row of panel.rows) for (const d of row) if (d.kind === "rcd" || d.kind === "rcbo") map.set(d.id, GROUP_COLORS[i++ % GROUP_COLORS.length]);
  return map;
}

/** Échelle (px/mm) ajustée à la largeur disponible, pour que le coffret tienne sans défilement. */
function useFitScale(widestModules: number): [React.RefObject<HTMLDivElement | null>, number] {
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
  // Marges : scène, coffret, plastron et numéros de rangée.
  const chrome = 170;
  const scale = (width - chrome) / (widestModules * MODULE_MM);
  return [ref, Math.max(1.25, Math.min(2.3, scale))];
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

export function PanelVisual({ panel, findings, selectedId, mode, onSelect, onAdd, onMove }: Props) {
  const guards = useMemo(() => protectionMap(panel), [panel]);
  const colors = useMemo(() => rcdColors(panel), [panel]);
  const [dragId, setDragId] = useState<string>();
  const [drop, setDrop] = useState<{ row: number; index: number }>();

  const rowCount = Math.max(panel.enclosure.rows, panel.rows.length);
  const mpr = panel.enclosure.modulesPerRow;
  const widest = Math.max(mpr, ...panel.rows.map(rowModules));
  const [stageRef, scale] = useFitScale(widest);
  const mod = MODULE_MM * scale;
  const style = { "--mod": `${mod}px`, "--row-w": `${widest * mod}px`, "--nose-h": `${NOSE_H * scale}px`, "--dev-h": `${DEVICE_H * scale}px` } as CSSProperties;

  const endDrag = () => {
    setDragId(undefined);
    setDrop(undefined);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer.getData("text/plain");
    if (id && drop) onMove(id, drop.row, drop.index);
    endDrag();
  };

  const renderDevice = (d: Device, r: number, i: number) => {
    const guard = guards.get(d.id);
    const unprotected = isCircuitDevice(d) && (!guard || !isHighSensitivity(guard));
    const sev = worstSeverity(findingsForDevice(findings, d.id));
    const count = findingsForDevice(findings, d.id).filter((f) => f.severity !== "conseil").length;
    const marker = drop && drop.row === r && drop.index === i && dragId !== d.id;
    return (
      <div key={d.id} className="dev-slot" style={{ width: d.modules * mod }}>
        {marker && <span className="drop-marker" />}
        <button
          type="button"
          className="dev"
          aria-pressed={selectedId === d.id}
          aria-label={`${deviceTitle(d)} — ${labelText(d)}${unprotected ? ", sans protection 30 mA" : ""}`}
          data-dragging={dragId === d.id}
          draggable
          onDragStart={(e) => {
            setDragId(d.id);
            e.dataTransfer.setData("text/plain", d.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={endDrag}
          onDragOver={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            setDrop({ row: r, index: e.clientX > rect.left + rect.width / 2 ? i + 1 : i });
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(selectedId === d.id ? undefined : d.id);
          }}
        >
          <DeviceArt device={d} view={mode === "front" ? "front" : "full"} scale={scale} />
          {sev && sev !== "conseil" && (
            <span className="dev-badge" data-sev={sev}>
              {count}
            </span>
          )}
        </button>
        {mode === "open" && isCircuitDevice(d) && <Wires device={d} mod={mod} unprotected={unprotected} />}
        {mode === "open" && d.kind === "rcd" && <SupplyWires mod={mod} modules={d.modules} />}
      </div>
    );
  };

  return (
    <div className="panel-stage" ref={stageRef} onClick={() => onSelect(undefined)}>
      <div className={`coffret coffret--${mode}`} style={style} onClick={(e) => e.stopPropagation()}>
        <div className="coffret-knockouts" aria-hidden="true">
          {Array.from({ length: Math.max(3, Math.round(widest / 3)) }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        <div className="plastron">
          {Array.from({ length: rowCount }, (_, r) => {
            const row = panel.rows[r] ?? [];
            const used = rowModules(row);
            const free = Math.max(0, mpr - used);
            const over = used > mpr;
            return (
              <div className="prow" key={r} data-over={over}>
                {mode === "front" && (
                  <div className="label-holder" aria-hidden="true">
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
                          title={labelText(d)}
                        >
                          <Picto kind={pictoFor(d)} size={11} />
                          <span className="label-text">{labelText(d)}</span>
                        </span>
                      );
                    })}
                    {Array.from({ length: free }, (_, k) => (
                      <span key={`f${k}`} className="label-cell label-cell--empty" style={{ width: mod }} />
                    ))}
                  </div>
                )}
                <div
                  className="cutout"
                  role="list"
                  aria-label={`Rangée ${r + 1} : ${used} modules occupés sur ${mpr}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (e.target === e.currentTarget) setDrop({ row: r, index: row.length });
                  }}
                  onDrop={handleDrop}
                >
                  {mode === "open" && <span className="din-rail" aria-hidden="true" />}
                  {mode === "open" && <Comb row={row} guards={guards} mod={mod} scale={scale} />}
                  {row.map((d, i) => renderDevice(d, r, i))}
                  {drop && drop.row === r && drop.index === row.length && <span className="drop-marker drop-marker--end" />}
                  {Array.from({ length: free }, (_, k) =>
                    mode === "front" ? (
                      <button
                        key={k}
                        type="button"
                        className="obturateur"
                        style={{ width: mod }}
                        aria-label={`Ajouter un appareil en rangée ${r + 1}`}
                        onClick={() => onAdd(r)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDrop({ row: r, index: row.length });
                        }}
                        onDrop={handleDrop}
                      >
                        <IconPlus size={14} />
                      </button>
                    ) : k === 0 ? (
                      <button key={k} type="button" className="ghost-slot" style={{ width: mod }} aria-label={`Ajouter un appareil en rangée ${r + 1}`} onClick={() => onAdd(r)}>
                        <IconPlus size={14} />
                      </button>
                    ) : null,
                  )}
                  {over && (
                    <button type="button" className="ghost-slot ghost-slot--over" style={{ width: mod }} aria-label={`Ajouter un appareil en rangée ${r + 1}`} onClick={() => onAdd(r)}>
                      <IconPlus size={14} />
                    </button>
                  )}
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
          <span className="coffret-brand">{panel.enclosure.brand === "Générique" ? "" : panel.enclosure.brand.toLowerCase()}</span>
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

function Wires({ device, mod, unprotected }: { device: Device; mod: number; unprotected: boolean }) {
  const w = device.modules * mod;
  const h = 44;
  const p = w * 0.27;
  const n = w * 0.73;
  return (
    <svg className="wires" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`M${p} 0 C${p} ${h * 0.5}, ${p - 3} ${h * 0.7}, ${p - 2} ${h}`} stroke="#7a4a26" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d={`M${n} 0 C${n} ${h * 0.5}, ${n + 3} ${h * 0.7}, ${n + 2} ${h}`} stroke="#2a5bd7" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      {unprotected && <circle cx={w / 2} cy={h - 8} r="5" fill="#d33a2f" />}
    </svg>
  );
}

function SupplyWires({ mod, modules }: { mod: number; modules: number }) {
  const w = modules * mod;
  const h = 26;
  const p = w * 0.73;
  const n = w * 0.27;
  return (
    <svg className="wires wires--up" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`M${p} ${h} C${p} ${h * 0.5}, ${p + 2} ${h * 0.3}, ${p + 1} 0`} stroke="#7a4a26" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d={`M${n} ${h} C${n} ${h * 0.5}, ${n - 2} ${h * 0.3}, ${n - 1} 0`} stroke="#2a5bd7" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
