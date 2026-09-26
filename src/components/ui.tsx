import { type ReactNode, useEffect, useMemo } from "react";
import { SEVERITY_LABEL, analyzePanel } from "../domain/analysis";
import type { Finding, House, Panel, Severity } from "../domain/types";

export function useFindings(panel: Panel | undefined, house: House): Finding[] {
  return useMemo(() => (panel ? analyzePanel(panel, house) : []), [panel, house]);
}

export function SeverityChip({ severity, children }: { severity: Severity | "ok"; children?: ReactNode }) {
  return (
    <span className="chip" data-sev={severity}>
      {children ?? (severity === "ok" ? "Conforme" : SEVERITY_LABEL[severity])}
    </span>
  );
}

export function FindingCard({
  finding,
  onLocate,
  onAsk,
  open,
}: {
  finding: Finding;
  onLocate?: () => void;
  onAsk?: () => void;
  open?: boolean;
}) {
  return (
    <article className="finding" data-sev={finding.severity}>
      <div className="row">
        <SeverityChip severity={finding.severity} />
        <h4 style={{ flex: 1, minWidth: 180 }}>{finding.title}</h4>
      </div>
      <p className="muted" style={{ fontSize: "0.88rem" }}>
        {finding.detail}
      </p>
      <details open={open}>
        <summary>Ce que dit la norme</summary>
        <div className="norm-box">
          <span className="ref">{finding.normRef}</span>
          {finding.norm}
        </div>
      </details>
      <p className="fix">
        <b>Mise en conformité :</b> {finding.fix}
      </p>
      {(onLocate || onAsk) && (
        <div className="row">
          {onLocate && (
            <button type="button" className="btn small" onClick={onLocate}>
              Voir sur le tableau
            </button>
          )}
          {onAsk && (
            <button type="button" className="btn small ghost" onClick={onAsk}>
              Demander à l'assistant
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row">
          <h3 style={{ flex: 1 }}>{title}</h3>
          <button type="button" className="btn ghost icon" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        {children}
        {footer && <div className="row" style={{ justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </div>
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

/** Rendu Markdown minimal et sûr (titres, listes, gras, italique, code). */
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
    else if (tok.startsWith("`")) parts.push(<code key={k} className="mono">{tok.slice(1, -1)}</code>);
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
