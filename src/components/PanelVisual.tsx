import { type DragEvent, type ReactNode, useMemo, useState } from "react";
import { findingsForDevice, worstSeverity } from "../domain/analysis";
import { USAGES } from "../domain/norm";
import { deviceBadge, deviceTitle, isCircuitDevice, isHighSensitivity, protectionMap, rowModules } from "../domain/panel";
import type { Device, Finding, Panel } from "../domain/types";

interface Props {
  panel: Panel;
  findings: Finding[];
  selectedId?: string;
  onSelect(id?: string): void;
  onAdd(row: number): void;
  onMove(id: string, row: number, index: number): void;
}

export const GROUP_COLORS = ["var(--g0)", "var(--g1)", "var(--g2)", "var(--g3)", "var(--g4)", "var(--g5)"];

export function rcdColors(panel: Panel): Map<string, string> {
  const map = new Map<string, string>();
  let i = 0;
  for (const row of panel.rows) for (const d of row) if (d.kind === "rcd" || d.kind === "rcbo") map.set(d.id, GROUP_COLORS[i++ % GROUP_COLORS.length]);
  return map;
}

function shortName(d: Device): string {
  if (d.label) return d.label;
  if (d.circuit) return USAGES[d.circuit.usage].label;
  return deviceTitle(d);
}

export function PanelVisual({ panel, findings, selectedId, onSelect, onAdd, onMove }: Props) {
  const guards = useMemo(() => protectionMap(panel), [panel]);
  const colors = useMemo(() => rcdColors(panel), [panel]);
  const [dragId, setDragId] = useState<string>();
  const [drop, setDrop] = useState<{ row: number; index: number }>();

  const rowCount = Math.max(panel.enclosure.rows, panel.rows.length);
  const mpr = panel.enclosure.modulesPerRow;

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer.getData("text/plain");
    if (id && drop) onMove(id, drop.row, drop.index);
    setDragId(undefined);
    setDrop(undefined);
  };

  return (
    <div className="enclosure-scroll">
      <div className="enclosure" onClick={(e) => e.target === e.currentTarget && onSelect(undefined)}>
        <div className="enclosure-head">
          <span>
            {panel.enclosure.brand} · {panel.enclosure.label ?? "Coffret"}
          </span>
          <span className="mono">
            {rowCount} × {mpr} modules
          </span>
        </div>
        {Array.from({ length: rowCount }, (_, r) => {
          const row = panel.rows[r] ?? [];
          const used = rowModules(row);
          const free = mpr - used;
          const over = free < 0;
          return (
            <div className="din-row" key={r}>
              <span className="row-index" aria-hidden="true">
                {r + 1}
              </span>
              <div
                className="rail"
                role="list"
                aria-label={`Rangée ${r + 1}, ${used} modules sur ${mpr}`}
                data-over={over}
                style={{ ["--slots" as string]: Math.max(mpr, used + (over ? 1 : 0)) }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (e.target === e.currentTarget) setDrop({ row: r, index: row.length });
                }}
                onDrop={handleDrop}
              >
                {row.map((d, i) => {
                  const guard = guards.get(d.id);
                  const unprotected = isCircuitDevice(d) && (!guard || !isHighSensitivity(guard));
                  const band = d.kind === "rcd" || d.kind === "rcbo" ? colors.get(d.id) : guard ? colors.get(guard.id) : undefined;
                  const sev = worstSeverity(findingsForDevice(findings, d.id));
                  const showMarker = drop && drop.row === r && drop.index === i && dragId !== d.id;
                  return (
                    <FragmentWithMarker key={d.id} marker={!!showMarker}>
                      <button
                        type="button"
                        role="listitem"
                        className="device"
                        data-kind={d.kind}
                        data-m={d.modules}
                        data-dragging={dragId === d.id}
                        aria-pressed={selectedId === d.id}
                        title={`${deviceTitle(d)}${d.label ? ` — ${d.label}` : ""}`}
                        style={{ ["--m" as string]: d.modules, ["--band" as string]: band }}
                        draggable
                        onDragStart={(e) => {
                          setDragId(d.id);
                          e.dataTransfer.setData("text/plain", d.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDragId(undefined);
                          setDrop(undefined);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const after = e.clientX > rect.left + rect.width / 2;
                          setDrop({ row: r, index: after ? i + 1 : i });
                        }}
                        onClick={() => onSelect(selectedId === d.id ? undefined : d.id)}
                      >
                        <span className="band" data-unprotected={unprotected} />
                        <span className="badge">{deviceBadge(d)}</span>
                        <span className="face">
                          {(d.kind === "rcd" || d.kind === "rcbo") && (
                            <>
                              <span className="rcd-type">
                                {d.sensitivity && d.sensitivity !== 30 ? `${d.sensitivity}mA` : d.rcdType ?? "AC"}
                              </span>
                              <span className="test" />
                            </>
                          )}
                          <span className="toggle" />
                        </span>
                        <span className="name">{shortName(d)}</span>
                        {sev && <span className="status" data-sev={sev} />}
                      </button>
                    </FragmentWithMarker>
                  );
                })}
                {drop && drop.row === r && drop.index === row.length && <span className="drop-marker" />}
                {free > 0 && (
                  <button type="button" className="add-slot" onClick={() => onAdd(r)} aria-label={`Ajouter un appareil en rangée ${r + 1}`}>
                    +
                  </button>
                )}
                {Array.from({ length: Math.max(0, free - 1) }, (_, k) => (
                  <span key={k} className="slot-empty" aria-hidden="true" />
                ))}
                {over && (
                  <button type="button" className="add-slot" onClick={() => onAdd(r)} aria-label={`Ajouter un appareil en rangée ${r + 1}`}>
                    +
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FragmentWithMarker({ marker, children }: { marker: boolean; children: ReactNode }) {
  return (
    <>
      {marker && <span className="drop-marker" />}
      {children}
    </>
  );
}
