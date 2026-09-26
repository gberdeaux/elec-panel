/**
 * Étiquettes de tableau façon « porte-étiquette » : pictogramme, filet de couleur, texte.
 * Dessinées en millimètres pour être imprimées à l'échelle réelle.
 */
import { USAGES } from "../domain/norm";
import { deviceTitle, repereMap } from "../domain/panel";
import { DEFAULT_LABEL_SETTINGS, type Device, type LabelSettings, type Panel } from "../domain/types";
import { pictoNode } from "./icons";

const FONT = "Arial, Helvetica, sans-serif";

export function labelIconFor(d: Device): string {
  if (d.labelIcon) return d.labelIcon;
  if (d.circuit) return d.circuit.usage;
  if (d.kind === "rcd" || d.kind === "rcbo") return "rcd";
  if (d.kind === "spd") return "spd";
  if (d.kind === "teleruptor") return "teleruptor";
  if (d.kind === "contactor" || d.kind === "timer") return "contactor";
  if (d.kind === "blank") return "reserve";
  return "autre";
}

export function labelTextFor(d: Device): string {
  if (d.label) return d.label;
  if (d.circuit) return `${USAGES[d.circuit.usage].label}${d.circuit.rooms ? ` ${d.circuit.rooms}` : ""}`;
  if (d.kind === "rcd") return "Différentiel";
  if (d.kind === "blank") return "";
  return deviceTitle(d);
}

/** Découpe un texte en lignes pour une largeur donnée (approximation de la chasse d'Arial). */
export function wrapText(text: string, widthMm: number, fontMm: number, maxLines: number): string[] {
  const perLine = Math.max(3, Math.floor(widthMm / (fontMm * 0.54)));
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (let word of words) {
    while (word.length > perLine) {
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(word.slice(0, perLine - 1) + "-");
      word = word.slice(perLine - 1);
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length > perLine) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].slice(0, Math.max(1, perLine - 1)) + "…";
    return kept;
  }
  return lines;
}

/** Choisit la plus grande taille de texte qui tient dans la case. */
function fitText(text: string, widthMm: number, heightMm: number, maxFont: number) {
  for (let font = maxFont; font >= 1.5; font -= 0.1) {
    const maxLines = Math.max(1, Math.floor(heightMm / (font * 1.15)));
    const lines = wrapText(text, widthMm, font, 99);
    if (lines.length <= maxLines) return { font, lines };
  }
  const font = 1.5;
  return { font, lines: wrapText(text, widthMm, font, Math.max(1, Math.floor(heightMm / (font * 1.15)))) };
}

interface StripProps {
  row: Device[];
  modules: number;
  settings: LabelSettings;
  moduleMm: number;
  reperes: Map<string, string>;
  /** Largeur affichée en pixels (sinon en millimètres réels). */
  pxWidth?: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** Position de départ (en modules) quand la bande est découpée. */
  fromModule?: number;
}

export function LabelStrip({ row, modules, settings, moduleMm, reperes, pxWidth, selectedId, onSelect, fromModule = 0 }: StripProps) {
  const H = settings.heightMm;
  const W = modules * moduleMm;
  const lineY = H * 0.46;
  const cells: { d?: Device; start: number; span: number }[] = [];
  let x = 0;
  for (const d of row) {
    cells.push({ d, start: x, span: d.modules });
    x += d.modules;
  }
  for (; x < fromModule + modules; x++) cells.push({ start: x, span: 1 });
  const visible = cells.filter((c) => c.start + c.span > fromModule && c.start < fromModule + modules);
  const size = pxWidth ? { width: pxWidth, height: (pxWidth * H) / W } : { width: `${W}mm`, height: `${H}mm` };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...size} xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }} role={onSelect ? undefined : "img"}>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      {settings.lineColor !== "none" && <rect x="0" y={lineY - 0.3} width={W} height="0.6" fill={settings.lineColor} />}
      {visible.map((c, i) => {
        const cx = (c.start - fromModule) * moduleMm;
        const cw = c.span * moduleMm;
        const d = c.d;
        const icon = d ? labelIconFor(d) : undefined;
        const text = d ? labelTextFor(d) : "";
        const iconSize = Math.min(lineY - 3.2, cw - 3, 9);
        const textZone = H - lineY - 2;
        const { font, lines } = fitText(text, cw - 1.4, textZone, H >= 28 ? 2.5 : 2.1);
        const selected = !!d && d.id === selectedId;
        const blank = !d || d.kind === "blank";
        return (
          <g
            key={d?.id ?? `empty-${c.start}-${i}`}
            onClick={d && onSelect ? () => onSelect(d.id) : undefined}
            style={{ cursor: d && onSelect ? "pointer" : undefined }}
          >
            <rect x={cx} y="0" width={cw} height={H} fill={selected ? "#e5efff" : "transparent"} />
            {selected && <rect x={cx + 0.3} y="0.3" width={cw - 0.6} height={H - 0.6} fill="none" stroke="#1f6feb" strokeWidth="0.6" />}
            {cx > 0 && <path d={`M${cx} 0 V${H}`} stroke="#b9bcc2" strokeWidth="0.2" />}
            {!blank && settings.showIcons && icon && iconSize > 2 && (
              <svg x={cx + (cw - iconSize) / 2} y={(lineY - iconSize) / 2} width={iconSize} height={iconSize} viewBox="0 0 12 12" fill="none" stroke="#1b1d21" strokeWidth={0.85} strokeLinecap="round" strokeLinejoin="round">
                {pictoNode(icon)}
              </svg>
            )}
            {!blank && settings.showRefs && d && reperes.get(d.id) && (
              <text x={cx + 0.8} y="2.4" fontSize="1.8" fontFamily={FONT} fontWeight="700" fill="#7a7d82">
                {reperes.get(d.id)}
              </text>
            )}
            {!blank &&
              lines.map((l, k) => (
                <text
                  key={k}
                  x={cx + cw / 2}
                  y={lineY + 1.6 + font * (k + 0.9) * 1.1}
                  fontSize={font}
                  fontFamily={FONT}
                  fill="#1b1d21"
                  textAnchor="middle"
                >
                  {l}
                </text>
              ))}
          </g>
        );
      })}
      <rect x="0.1" y="0.1" width={W - 0.2} height={H - 0.2} fill="none" stroke="#9ea2a8" strokeWidth="0.2" />
    </svg>
  );
}

/** Découpe les rangées en bandes qui tiennent dans la largeur imprimable. */
export function stripsFor(panel: Panel, settings: LabelSettings, maxWidthMm = 270) {
  const perStrip = Math.max(1, Math.floor(maxWidthMm / settings.moduleMm));
  const out: { row: number; from: number; modules: number }[] = [];
  panel.rows.forEach((_, r) => {
    const total = panel.enclosure.modulesPerRow;
    for (let from = 0; from < total; from += perStrip) out.push({ row: r, from, modules: Math.min(perStrip, total - from) });
  });
  return out;
}

/** Planche complète à imprimer (A4 paysage, échelle 1:1). */
export function LabelSheet({ panel, settings = DEFAULT_LABEL_SETTINGS }: { panel: Panel; settings?: LabelSettings }) {
  const reperes = repereMap(panel);
  const strips = stripsFor(panel, settings);
  const gap = 6;
  const width = Math.max(...strips.map((s) => s.modules * settings.moduleMm)) + 10;
  const height = 14 + strips.length * (settings.heightMm + gap) + 8;
  let y = 14;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={`${width}mm`} height={`${height}mm`} viewBox={`0 0 ${width} ${height}`}>
      <rect width={width} height={height} fill="#fff" />
      <text x="5" y="6" fontSize="3.2" fontFamily={FONT} fontWeight="700" fill="#1b1d21">
        {panel.name}
      </text>
      <text x="5" y="10" fontSize="2.2" fontFamily={FONT} fill="#6b7078">
        {`Étiquettes ${settings.heightMm} mm · module ${String(settings.moduleMm).replace(".", ",")} mm · imprimer à 100 % (échelle réelle), puis découper le long du cadre`}
      </text>
      {strips.map((s, i) => {
        const top = y;
        y += settings.heightMm + gap;
        return (
          <g key={i} transform={`translate(5 ${top})`}>
            <text x="0" y="-1.2" fontSize="2" fontFamily={FONT} fill="#6b7078">
              {`Rangée ${s.row + 1}${s.from > 0 || s.modules < panel.enclosure.modulesPerRow ? ` · modules ${s.from + 1} à ${s.from + s.modules}` : ""}`}
            </text>
            <LabelStrip row={panel.rows[s.row] ?? []} modules={s.modules} fromModule={s.from} settings={settings} moduleMm={settings.moduleMm} reperes={reperes} pxWidth={s.modules * settings.moduleMm} />
          </g>
        );
      })}
    </svg>
  );
}
