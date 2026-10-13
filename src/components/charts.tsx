import clsx from "clsx";
import { useId, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Aggregation, Metric } from "@/api/types";
import { useTheme } from "@/context/theme";
import { Empty } from "./ui";

const cleanId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "");

function fmtTick(iso: string, agg: Aggregation) {
  const d = new Date(iso);
  if (agg === "MONTH") return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  if (agg === "DAY") return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtTooltipLabel(iso: string, agg: Aggregation) {
  const d = new Date(iso);
  if (agg === "MONTH") return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  if (agg === "DAY") return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function metricRows(m?: Metric) {
  if (!m) return [];
  return (m.timestamps ?? []).map((t, i) => {
    const row: Record<string, number | string> = { t };
    (m.datasets ?? []).forEach((ds) => (row[ds.label] = ds.data?.[i] ?? 0));
    return row;
  });
}

export function ChartCard({ title, subtitle, children, actions, className, icon }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <section className={clsx("card px-5 pt-4 pb-4 animate-rise", className)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <div className="h-8 w-8 rounded-xl bg-brand/12 text-brand grid place-items-center shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</div>}
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight truncate">{title}</h3>
            {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function useTooltipStyle() {
  const { colors } = useTheme();
  return {
    contentStyle: { background: colors.surface, border: `1px solid ${colors.line}`, borderRadius: 12, fontSize: 12, color: colors.ink, boxShadow: "0 12px 30px -12px rgba(0,0,0,.5)", padding: "8px 12px" },
    labelStyle: { color: colors.muted, marginBottom: 4, fontSize: 11 },
    itemStyle: { color: colors.ink, padding: 0 },
  };
}

/**
 * Renders a ChirpStack Metric (timestamps + datasets). Gauges render as a gradient area,
 * counters as gradient bars. Multiple datasets stack when `stacked` is set.
 */
export function MetricChart({ metric, aggregation, kind, height = 200, unit, stacked, labelFormat, seriesOffset = 0 }: { metric?: Metric; aggregation: Aggregation; kind?: "line" | "bar"; height?: number; unit?: string; stacked?: boolean; labelFormat?: (label: string) => string; seriesOffset?: number }) {
  const { colors } = useTheme();
  const tt = useTooltipStyle();
  const gid = cleanId(useId());
  const rows = metricRows(metric);
  const sets = (metric?.datasets ?? []).slice(0, 8);
  const isBar = kind ? kind === "bar" : metric?.kind !== "GAUGE";
  const hasData = rows.some((r) => sets.some((s) => Number(r[s.label]) !== 0));
  if (!metric || !hasData) {
    return (
      <div style={{ height }} className="grid place-items-center">
        <Empty title="No data for this period" />
      </div>
    );
  }
  const color = (i: number) => colors.series[(i + seriesOffset) % 8];
  const lf = labelFormat ?? ((l: string) => l);
  const axisProps = { stroke: colors.axis, tick: { fill: colors.axis, fontSize: 11 }, tickLine: false, axisLine: false };
  const tooltip = (
    <Tooltip
      cursor={isBar ? { fill: colors.grid, opacity: 0.6, radius: 6 } : { stroke: colors.axis, strokeDasharray: "4 4" }}
      {...tt}
      labelFormatter={(l) => fmtTooltipLabel(String(l), aggregation)}
      formatter={(v, name) => [`${Number(v).toLocaleString()}${unit ? ` ${unit}` : ""}`, lf(String(name))]}
    />
  );
  const legend = sets.length > 1 ? <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} formatter={(v) => <span style={{ color: colors.ink2 }}>{lf(String(v))}</span>} /> : null;
  const defs = (
    <defs>
      {sets.map((s, i) => (
        <linearGradient key={s.label} id={`${gid}-${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color(i)} stopOpacity={isBar ? 1 : 0.45} />
          <stop offset="100%" stopColor={color(i)} stopOpacity={isBar ? 0.55 : 0} />
        </linearGradient>
      ))}
    </defs>
  );
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {isBar ? (
          <BarChart data={rows} margin={{ top: 6, right: 4, left: -14, bottom: 0 }} barCategoryGap="22%">
            {defs}
            <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 5" />
            <XAxis dataKey="t" {...axisProps} tickFormatter={(v) => fmtTick(v, aggregation)} minTickGap={28} />
            <YAxis {...axisProps} width={48} allowDecimals={false} />
            {tooltip}
            {legend}
            {sets.map((s, i) => (
              <Bar
                key={s.label}
                dataKey={s.label}
                stackId={stacked ? "a" : undefined}
                fill={`url(#${gid}-${i})`}
                stroke={stacked ? colors.surface : undefined}
                strokeWidth={stacked ? 1 : 0}
                radius={stacked ? (i === sets.length - 1 ? [5, 5, 0, 0] : 0) : [5, 5, 0, 0]}
                maxBarSize={26}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        ) : (
          <AreaChart data={rows} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
            {defs}
            <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 5" />
            <XAxis dataKey="t" {...axisProps} tickFormatter={(v) => fmtTick(v, aggregation)} minTickGap={28} />
            <YAxis {...axisProps} width={48} domain={["auto", "auto"]} />
            {tooltip}
            {legend}
            {sets.map((s, i) => (
              <Area
                key={s.label}
                type="monotone"
                dataKey={s.label}
                stroke={color(i)}
                strokeWidth={2.25}
                fill={`url(#${gid}-${i})`}
                dot={false}
                activeDot={{ r: 5, stroke: colors.surface, strokeWidth: 2, fill: color(i) }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** Minimal area sparkline. */
export function Sparkline({ data, color, height = 40, className }: { data: number[]; color: string; height?: number; className?: string }) {
  const gid = cleanId(useId());
  if (data.length < 2) return <div style={{ height }} className={className} />;
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gid})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Circular progress ring with a gradient stroke. `value` is 0..1. */
export function Ring({ value, size = 120, stroke = 10, from, to, track, children }: { value: number; size?: number; stroke?: number; from: string; to: string; track?: string; children?: ReactNode }) {
  const gid = cleanId(useId());
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track ?? "rgba(255,255,255,0.14)"} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          style={{ transition: "stroke-dasharray .8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

const TONES: Record<string, { chip: string; spark: (c: ReturnType<typeof useTheme>["colors"]) => string }> = {
  brand: { chip: "from-indigo-500 to-violet-500", spark: (c) => c.brand },
  cyan: { chip: "from-cyan-500 to-sky-500", spark: (c) => c.brand2 },
  green: { chip: "from-emerald-500 to-teal-500", spark: (c) => c.good },
  amber: { chip: "from-amber-500 to-orange-500", spark: (c) => c.warn },
  pink: { chip: "from-pink-500 to-rose-500", spark: (c) => c.series[3] },
  violet: { chip: "from-violet-500 to-fuchsia-500", spark: (c) => c.violet },
};
export type KpiTone = keyof typeof TONES;

/** KPI tile: gradient icon chip, big value, delta and an optional sparkline / progress. */
export function KpiCard({ label, value, unit, sub, icon, tone = "brand", spark, delta, progress }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; icon: ReactNode; tone?: KpiTone; spark?: number[]; delta?: number | null; progress?: number }) {
  const { colors } = useTheme();
  const t = TONES[tone];
  return (
    <div className="card card-hover p-5 relative overflow-hidden animate-rise">
      <div className={clsx("absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-[0.12] blur-2xl", t.chip)} />
      <div className="flex items-start justify-between gap-3 relative">
        <div className="min-w-0">
          <div className="text-[13px] text-ink2 font-medium">{label}</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tracking-tight tnum">{value}</span>
            {unit && <span className="text-sm text-muted font-medium">{unit}</span>}
          </div>
        </div>
        <div className={clsx("h-11 w-11 rounded-2xl bg-gradient-to-br text-white grid place-items-center shrink-0 shadow-lg [&>svg]:h-5 [&>svg]:w-5", t.chip)}>{icon}</div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs relative">
        {delta !== undefined && delta !== null && Number.isFinite(delta) && (
          <span className={clsx("inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 font-semibold", delta >= 0 ? "bg-good/12 text-good" : "bg-bad/12 text-bad")}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-muted truncate">{sub}</span>}
      </div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-raised overflow-hidden relative">
          <div className={clsx("h-full rounded-full bg-gradient-to-r", t.chip)} style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }} />
        </div>
      )}
      {spark && <Sparkline data={spark} color={t.spark(colors)} height={44} className="mt-2 -mx-1" />}
    </div>
  );
}

/** Horizontal bar list with labels (leaderboards, breakdowns). */
export function BarList({ items, unit, colorFrom = "from-indigo-500", colorTo = "to-cyan-400" }: { items: { label: ReactNode; value: number; hint?: ReactNode; key: string }[]; unit?: string; colorFrom?: string; colorTo?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.key}>
          <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
            <span className="min-w-0 truncate">{it.label}</span>
            <span className="shrink-0 tnum font-semibold">
              {it.value.toLocaleString()}
              {unit && <span className="text-muted font-normal text-xs"> {unit}</span>}
              {it.hint && <span className="text-muted font-normal text-xs ml-1.5">{it.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-raised overflow-hidden">
            <div className={clsx("h-full rounded-full bg-gradient-to-r", colorFrom, colorTo)} style={{ width: `${(it.value / max) * 100}%`, transition: "width .6s ease" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Simple categorical bar chart from {label, value} pairs. */
export function SimpleBars({ data, height = 180, unit, colorIndex = 0 }: { data: { label: string; value: number }[]; height?: number; unit?: string; colorIndex?: number }) {
  const { colors } = useTheme();
  const tt = useTooltipStyle();
  const gid = cleanId(useId());
  if (!data.length || data.every((d) => !d.value)) {
    return (
      <div style={{ height }} className="grid place-items-center">
        <Empty title="No data" />
      </div>
    );
  }
  const c = colors.series[colorIndex];
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.brand2} />
              <stop offset="100%" stopColor={c} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 5" />
          <XAxis dataKey="label" stroke={colors.axis} tick={{ fill: colors.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis stroke={colors.axis} tick={{ fill: colors.axis, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
          <Tooltip cursor={{ fill: colors.grid, opacity: 0.6 }} {...tt} formatter={(v) => [`${v}${unit ? ` ${unit}` : ""}`, "Devices"]} />
          <Bar dataKey="value" fill={`url(#${gid})`} radius={[6, 6, 0, 0]} maxBarSize={34} isAnimationActive={false} label={{ position: "top", fill: colors.ink2, fontSize: 11 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Part-to-whole status meter (segmented bar) with a labelled legend. */
export function StatusMeter({ segments }: { segments: { label: string; value: number; color: string; icon?: ReactNode }[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div>
      <div className="flex h-3 w-full gap-[3px] overflow-hidden rounded-full bg-raised">
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => <div key={s.label} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color, boxShadow: `0 0 12px ${s.color}` }} className="h-full first:rounded-l-full last:rounded-r-full" />)}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {segments.map((s) => (
          <div key={s.label} className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </div>
            <div className="text-xl font-bold tnum mt-0.5">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatTile({ label, value, sub, icon, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: "brand" | "good" | "bad" | "warn" }) {
  const map: Record<string, KpiTone> = { brand: "brand", good: "green", bad: "pink", warn: "amber" };
  return <KpiCard label={label} value={value} sub={sub} icon={icon ?? null} tone={map[tone ?? "brand"]} />;
}
