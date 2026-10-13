import clsx from "clsx";
import { Check, Copy, Eye, EyeOff, LoaderCircle, Shuffle, TriangleAlert, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { randomHex } from "@/lib/format";

export function Card({ title, actions, children, className, bodyClass, subtitle }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={clsx("card", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2.5">
          <div className="min-w-0">
            {title && <h3 className="text-[15px] font-semibold text-ink truncate tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={clsx(bodyClass ?? "px-5 pb-5", !(title || actions) && !bodyClass && "pt-5")}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, breadcrumbs, actions, subtitle, icon }: { title: ReactNode; breadcrumbs?: { label: string; to?: string }[]; actions?: ReactNode; subtitle?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6 animate-rise">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="text-xs text-muted mb-1.5 flex flex-wrap items-center gap-1">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="opacity-60">/</span>}
              {b.to ? (
                <Link to={b.to} className="hover:text-ink hover:underline">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {icon && <div className="h-11 w-11 rounded-2xl gradient-brand text-white grid place-items-center shrink-0 shadow-glow [&>svg]:h-5 [&>svg]:w-5">{icon}</div>}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink truncate tracking-tight">{title}</h1>
            {subtitle && <div className="text-sm text-muted mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

type Tone = "neutral" | "good" | "warn" | "bad" | "brand" | "serious";
const toneClass: Record<Tone, string> = {
  neutral: "bg-raised/80 text-ink2 border-line",
  good: "bg-good/12 text-good border-good/25",
  warn: "bg-warn/15 text-warn border-warn/30",
  serious: "bg-serious/12 text-serious border-serious/30",
  bad: "bg-bad/12 text-bad border-bad/25",
  brand: "bg-brand/12 text-brand border-brand/30",
};
export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap", toneClass[tone], className)}>
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {tone === "good" && <span className="absolute inline-flex h-full w-full rounded-full bg-current animate-ping2" />}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={clsx("animate-spin", className ?? "h-4 w-4")} />;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted text-sm">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorBox({ error, title = "Request failed" }: { error: unknown; title?: string }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="rounded-lg border border-bad/30 bg-bad/5 px-4 py-3 text-sm flex gap-2.5">
      <TriangleAlert className="h-4 w-4 text-bad mt-0.5 shrink-0" />
      <div>
        <div className="font-medium text-bad">{title}</div>
        <div className="text-ink2 mt-0.5 break-words">{msg}</div>
      </div>
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && <div className="h-12 w-12 rounded-2xl bg-brand/10 text-brand grid place-items-center mb-3 ring-1 ring-brand/20">{icon}</div>}
      <div className="font-medium text-ink">{title}</div>
      {children && <div className="text-sm text-muted mt-1 max-w-md">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, help, error, children, className }: { label: ReactNode; help?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {error ? <p className="text-xs text-bad mt-1">{error}</p> : help ? <p className="text-xs text-muted mt-1">{help}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, help, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; help?: ReactNode; disabled?: boolean }) {
  return (
    <label className={clsx("flex items-start gap-3 cursor-pointer select-none", disabled && "opacity-60 cursor-not-allowed")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "gradient-brand shadow-glow" : "bg-line")}
      >
        <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </button>
      <span>
        <span className="text-sm text-ink">{label}</span>
        {help && <span className="block text-xs text-muted mt-0.5">{help}</span>}
      </span>
    </label>
  );
}

export function Select({ value, onChange, options, className, disabled }: { value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; className?: string; disabled?: boolean }) {
  return (
    <select className={clsx("input", className)} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title="Copy"
      className={clsx("btn-ghost btn-sm", className)}
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => undefined);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? <Check className="h-3.5 w-3.5 text-good" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** HEX key / EUI input with show/hide, generate and copy (like ChirpStack's AesKeyInput / EuiInput). */
export function HexInput({ value, onChange, bytes, secret, disabled, placeholder, generate = true, onGenerate }: { value: string; onChange: (v: string) => void; bytes: number; secret?: boolean; disabled?: boolean; placeholder?: string; generate?: boolean; onGenerate?: () => Promise<string> | string }) {
  const [show, setShow] = useState(!secret);
  const [msb, setMsb] = useState(true);
  const display = msb ? value : (value.match(/../g) ?? []).reverse().join("");
  return (
    <div className="flex items-stretch rounded-xl border border-line bg-raised/50 focus-within:ring-4 focus-within:ring-brand/20 focus-within:border-brand/70">
      <input
        className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm mono focus:outline-none"
        type={show ? "text" : "password"}
        value={display}
        placeholder={placeholder ?? "0".repeat(bytes * 2)}
        maxLength={bytes * 2}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
          onChange(msb ? v : (v.match(/../g) ?? []).reverse().join(""));
        }}
      />
      <div className="flex items-center border-l border-line px-1">
        <button type="button" className="btn-ghost btn-sm mono" title="Byte order" onClick={() => setMsb(!msb)}>
          {msb ? "MSB" : "LSB"}
        </button>
        {secret && (
          <button type="button" className="btn-ghost btn-sm" title={show ? "Hide" : "Show"} onClick={() => setShow(!show)}>
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        {generate && !disabled && (
          <button
            type="button"
            className="btn-ghost btn-sm"
            title="Generate random"
            onClick={async () => {
              const v = onGenerate ? await onGenerate() : randomHex(bytes);
              onChange(v);
              setShow(true);
            }}
          >
            <Shuffle className="h-3.5 w-3.5" />
          </button>
        )}
        <CopyButton text={display} />
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx("relative card bg-surface w-full shadow-2xl my-8 animate-rise", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-semibold text-base tracking-tight">{title}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-line bg-raised/40 rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmButton({ onConfirm, children, title = "Are you sure?", message, className, confirmLabel = "Delete" }: { onConfirm: () => unknown | Promise<unknown>; children: ReactNode; title?: string; message?: ReactNode; className?: string; confirmLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className={className ?? "btn-secondary"} onClick={() => setOpen(true)}>
        {children}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && <Spinner />} {confirmLabel}
            </button>
          </>
        }
      >
        <div className="text-sm text-ink2">{message ?? "This action cannot be undone."}</div>
      </Modal>
    </>
  );
}

export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: ReactNode; icon?: ReactNode }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="mb-6 overflow-x-auto">
      <div className="inline-flex gap-1 rounded-2xl border border-line/80 bg-surface/60 backdrop-blur p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={clsx(
              "flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl whitespace-nowrap transition-all [&>svg]:h-4 [&>svg]:w-4",
              value === t.key ? "gradient-brand text-white font-medium shadow-glow" : "text-ink2 hover:text-ink hover:bg-raised",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function KV({ items, cols = 2 }: { items: [ReactNode, ReactNode][]; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={clsx("grid gap-x-6 gap-y-3", cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="text-sm text-ink mt-0.5 break-words">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Key/value editor used for tags, variables and HTTP headers. */
export function KeyValueEditor({ value, onChange, keyLabel = "Key", valueLabel = "Value", disabled }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void; keyLabel?: string; valueLabel?: string; disabled?: boolean }) {
  const [rows, setRows] = useState<[string, string][]>(() => Object.entries(value ?? {}));
  useEffect(() => {
    setRows(Object.entries(value ?? {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)]);
  const push = (r: [string, string][]) => {
    setRows(r);
    const o: Record<string, string> = {};
    r.forEach(([k, v]) => k && (o[k] = v));
    onChange(o);
  };
  return (
    <div className="space-y-2">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex gap-2">
          <input className="input" placeholder={keyLabel} value={k} disabled={disabled} onChange={(e) => push(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))} />
          <input className="input" placeholder={valueLabel} value={v} disabled={disabled} onChange={(e) => push(rows.map((r, j) => (j === i ? [r[0], e.target.value] : r)))} />
          {!disabled && (
            <button type="button" className="btn-ghost" onClick={() => push(rows.filter((_, j) => j !== i))}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" className="btn-secondary btn-sm" onClick={() => setRows([...rows, ["", ""]])}>
          + Add {keyLabel.toLowerCase()}
        </button>
      )}
    </div>
  );
}

export function StatusDot({ state }: { state?: "ONLINE" | "OFFLINE" | "NEVER_SEEN" | string }) {
  if (state === "ONLINE") return <Badge tone="good" dot>Online</Badge>;
  if (state === "OFFLINE") return <Badge tone="bad" dot>Offline</Badge>;
  return <Badge dot>Never seen</Badge>;
}

export function JsonView({ value, className }: { value: unknown; className?: string }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div className={clsx("relative group", className)}>
      <pre className="mono text-xs bg-page/70 border border-line rounded-xl p-4 overflow-auto max-h-[420px] whitespace-pre text-ink2 leading-5">{text}</pre>
      <CopyButton text={text} className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 bg-surface" />
    </div>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2 pt-5 mt-4 border-t border-line">{children}</div>;
}
