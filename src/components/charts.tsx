import clsx from "clsx";
import { useId, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Aggregation, Metric } from "@/api/types";
import { useTheme } from "@/context/theme";
import { Empty } from "./ui";

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

export function ChartCard({ title, subtitle, children, actions, className }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={clsx("card px-4 pt-3.5 pb-3", className)}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/**
 * Renders a ChirpStack Metric (timestamps + datasets). Gauges render as a line/area,
 * counters as bars. Multiple datasets stack when `stacked` is set.
 */
export function MetricChart({ metric, aggregation, kind, height = 200, unit, stacked, labelFormat }: { metric?: Metric; aggregation: Aggregation; kind?: "line" | "bar"; height?: number; unit?: string; stacked?: boolean; labelFormat?: (label: string) => string }) {
  const { colors } = useTheme();
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
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
  const lf = labelFormat ?? ((l: string) => l);
  const axisProps = {
    stroke: colors.axis,
    tick: { fill: colors.axis, fontSize: 11 },
    tickLine: false,
    axisLine: { stroke: colors.grid },
  };
  const tooltip = (
    <Tooltip
      cursor={isBar ? { fill: colors.grid, opacity: 0.5 } : { stroke: colors.axis, strokeDasharray: "3 3" }}
      contentStyle={{ background: colors.surface, border: `1px solid ${colors.line}`, borderRadius: 8, fontSize: 12, color: colors.ink }}
      labelStyle={{ color: colors.ink2, marginBottom: 4 }}
      labelFormatter={(l) => fmtTooltipLabel(String(l), aggregation)}
      formatter={(v, name) => [`${Number(v).toLocaleString()}${unit ? ` ${unit}` : ""}`, lf(String(name))]}
    />
  );
  const legend = sets.length > 1 ? <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: colors.ink2 }} formatter={(v) => <span style={{ color: colors.ink2 }}>{lf(String(v))}</span>} /> : null;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {isBar ? (
          <BarChart data={rows} margin={{ top: 6, right: 6, left: -12, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis dataKey="t" {...axisProps} tickFormatter={(v) => fmtTick(v, aggregation)} minTickGap={24} />
            <YAxis {...axisProps} width={48} allowDecimals={false} />
            {tooltip}
            {legend}
            {sets.map((s, i) => (
              <Bar
                key={s.label}
                dataKey={s.label}
                stackId={stacked ? "a" : undefined}
                fill={colors.series[i % 8]}
                stroke={colors.surface}
                strokeWidth={stacked ? 1 : 0}
                radius={stacked ? (i === sets.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        ) : (
          <AreaChart data={rows} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
            <defs>
              {sets.map((s, i) => (
                <linearGradient key={s.label} id={`g${gid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.series[i % 8]} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={colors.series[i % 8]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis dataKey="t" {...axisProps} tickFormatter={(v) => fmtTick(v, aggregation)} minTickGap={24} />
            <YAxis {...axisProps} width={48} domain={["auto", "auto"]} />
            {tooltip}
            {legend}
            {sets.map((s, i) => (
              <Area
                key={s.label}
                type="monotone"
                dataKey={s.label}
                stroke={colors.series[i % 8]}
                strokeWidth={2}
                fill={`url(#g${gid}-${i})`}
                dot={false}
                activeDot={{ r: 4, stroke: colors.surface, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** Simple categorical bar chart from {label, value} pairs. */
export function SimpleBars({ data, height = 180, unit, colorIndex = 0 }: { data: { label: string; value: number }[]; height?: number; unit?: string; colorIndex?: number }) {
  const { colors } = useTheme();
  if (!data.length || data.every((d) => !d.value)) {
    return (
      <div style={{ height }} className="grid place-items-center">
        <Empty title="No data" />
      </div>
    );
  }
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 6, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis dataKey="label" stroke={colors.axis} tick={{ fill: colors.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: colors.grid }} />
          <YAxis stroke={colors.axis} tick={{ fill: colors.axis, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
          <Tooltip
            cursor={{ fill: colors.grid, opacity: 0.5 }}
            contentStyle={{ background: colors.surface, border: `1px solid ${colors.line}`, borderRadius: 8, fontSize: 12, color: colors.ink }}
            formatter={(v) => [`${v}${unit ? ` ${unit}` : ""}`, "Count"]}
          />
          <Bar dataKey="value" fill={colors.series[colorIndex]} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} label={{ position: "top", fill: colors.ink2, fontSize: 11 }} />
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
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-raised">
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => <div key={s.label} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} className="h-full first:rounded-l-full last:rounded-r-full" />)}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {segments.map((s) => (
          <div key={s.label} className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </div>
            <div className="text-lg font-semibold tnum mt-0.5">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatTile({ label, value, sub, icon, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: "brand" | "good" | "bad" | "warn" }) {
  const toneCls = tone === "good" ? "bg-good/10 text-good" : tone === "bad" ? "bg-bad/10 text-bad" : tone === "warn" ? "bg-warn/15 text-ink" : "bg-brand/10 text-brand";
  return (
    <div className="card px-4 py-3.5 flex items-start gap-3">
      {icon && <div className={clsx("h-9 w-9 rounded-lg grid place-items-center shrink-0", toneCls)}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-xs text-muted">{label}</div>
        <div className="text-2xl font-semibold leading-tight mt-0.5">{value}</div>
        {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
