import { type ReactNode, useEffect, useMemo } from "react";
import { create } from "zustand";
import { SEVERITY_LABEL, analyzePanel } from "../domain/analysis";
import type { Finding, House, Panel, Severity } from "../domain/types";
import { IconBook, IconCheck, IconChevronRight, IconClose, IconWand } from "./icons";

export function useFindings(panel: Panel | undefined, house: House): Finding[] {
  return useMemo(() => (panel ? analyzePanel(panel, house) : []), [panel, house]);
}

/** Score indicatif sur 100 : chaque constat retire des points selon sa gravité. */
export function complianceScore(findings: Finding[]): number {
  const penalty = findings.reduce(
    (s, f) => s + (f.severity === "danger" ? 14 : f.severity === "nonconforme" ? 6 : f.severity === "avertissement" ? 2 : 0),
    0,
  );
  return Math.max(0, 100 - penalty);
}

export type Tone = Severity | "ok" | "brand" | "neutral";

export function Badge({ tone = "neutral", children, plain }: { tone?: Tone; children: ReactNode; plain?: boolean }) {
  return (
    <span className={`badge${plain ? " plain" : ""}`} data-tone={tone}>
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge tone={severity}>{SEVERITY_LABEL[severity]}</Badge>;
}

export function FindingCard({
  finding,
  onLocate,
  onAsk,
  onFix,
  fixLabel,
  open,
  reference,
}: {
  finding: Finding;
  onLocate?: () => void;
  onAsk?: () => void;
  onFix?: () => void;
  fixLabel?: string;
  open?: boolean;
  reference?: string;
}) {
  return (
    <article className="finding" data-sev={finding.severity}>
      <div className="finding-body">
        <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
          <div className="finding-title" style={{ flex: 1 }}>
            {reference && <span className="mono" style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--muted)", marginRight: 6 }}>{reference}</span>}
            {finding.title}
          </div>
          <SeverityBadge severity={finding.severity} />
        </div>
        <p className="finding-detail">{finding.detail}</p>
        <div className="finding-fix">
          <IconCheck size={16} />
          <span>{finding.fix}</span>
        </div>
        <details open={open}>
          <summary>
            <IconChevronRight size={14} /> Ce que dit la norme
          </summary>
          <div className="finding-norm">
            <span className="ref">
              <IconBook size={13} /> {finding.normRef}
            </span>
            {finding.norm}
          </div>
        </details>
        {(onLocate || onAsk || onFix) && (
          <div className="row" style={{ marginTop: 2 }}>
            {onFix && (
              <button type="button" className="btn btn-sm btn-primary" onClick={onFix}>
                <IconWand size={14} /> {fixLabel ?? "Corriger"}
              </button>
            )}
            {onLocate && (
              <button type="button" className="btn btn-sm" onClick={onLocate}>
                Voir
              </button>
            )}
            {onAsk && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={onAsk}>
                Expliquer
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function Stepper({ id, value, onChange, min = 0, max = 99 }: { id: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="stepper" role="group" aria-labelledby={`${id}-label`}>
      <button type="button" aria-label="Moins" onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <output id={id} aria-live="polite">
        {value}
      </output>
      <button type="button" aria-label="Plus" onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  );
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  label,
  recommended,
  text,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
  label: string;
  recommended?: T;
  text?: boolean;
}) {
  return (
    <div className={`chips${text ? " text" : ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={value === o.value} data-recommended={recommended === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${size === "sm" ? " modal-sm" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{title}</h2>
            {subtitle && <p className="sub">{subtitle}</p>}
          </div>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Fermer">
            <IconClose size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, full }: { label: string; hint?: ReactNode; children: ReactNode; full?: boolean }) {
  return (
    <label className={`field${full ? " full" : ""}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Switch({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="switch" htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <b>{label}</b>
        {hint && <span>{hint}</span>}
      </span>
    </label>
  );
}

export function NumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  className = "input",
}: {
  id?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      id={id}
      className={className}
      type="number"
      inputMode="decimal"
      value={value ?? ""}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange(undefined);
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

export function ScoreRing({ value, size = 120, label = "/ 100" }: { value: number; size?: number; label?: string }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const color = value >= 90 ? "var(--ok)" : value >= 60 ? "var(--warn)" : "var(--danger)";
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="9" />
        {value > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} />}
      </svg>
      <div className="score-value" style={{ fontSize: size < 100 ? "1.25rem" : undefined }}>
        {value}
        <small>{label}</small>
      </div>
    </div>
  );
}

/* ---------- Notifications ---------- */
interface ToastState {
  toasts: { id: number; text: string }[];
  push(text: string): void;
}
let toastId = 0;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (text) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
}));
export const toast = (text: string) => useToasts.getState().push(text);

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <IconCheck size={16} />
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ---------- Markdown minimal et sûr ---------- */
export function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return <div className="md">{blocks}</div>;
}

function inline(text: string, key: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (tok.startsWith("**")) parts.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) parts.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const [, label, href] = tok.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
      parts.push(
        <a key={k} href={href} target="_blank" rel="noreferrer">
          {label}
        </a>,
      );
    } else parts.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index! + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function parseMarkdown(text: string): ReactNode[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(<p key={`p${out.length}`}>{inline(para.join(" "), `p${out.length}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it, `l${out.length}-${i}`)}</li>);
    out.push(list.ordered ? <ol key={`o${out.length}`}>{items}</ol> : <ul key={`u${out.length}`}>{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (heading) {
      flushPara();
      flushList();
      out.push(<h4 key={`h${out.length}`}>{inline(heading[1], `h${out.length}`)}</h4>);
    } else if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
    } else if (list && /^\s{2,}/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return out;
}

export const euro = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 });
