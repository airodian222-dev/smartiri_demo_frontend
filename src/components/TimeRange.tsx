import clsx from "clsx";
import { useMemo } from "react";
import type { Aggregation } from "@/api/types";
import type { MetricsWindow } from "@/api/chirpstack";

export type RangeKey = "1h" | "24h" | "31d" | "1y";
export const RANGES: { key: RangeKey; label: string; agg: Aggregation; ms: number }[] = [
  { key: "1h", label: "1 hour", agg: "MINUTE", ms: 3_600_000 },
  { key: "24h", label: "24 hours", agg: "HOUR", ms: 86_400_000 },
  { key: "31d", label: "31 days", agg: "DAY", ms: 31 * 86_400_000 },
  { key: "1y", label: "1 year", agg: "MONTH", ms: 365 * 86_400_000 },
];

export function useWindow(key: RangeKey, tick = 0): MetricsWindow {
  return useMemo(() => {
    const r = RANGES.find((x) => x.key === key)!;
    const end = new Date();
    // round to the minute so query keys are stable between renders
    end.setSeconds(0, 0);
    return { start: new Date(end.getTime() - r.ms).toISOString(), end: end.toISOString(), aggregation: r.agg };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
}

export function TimeRangePicker({ value, onChange }: { value: RangeKey; onChange: (k: RangeKey) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-line/80 bg-surface/60 backdrop-blur p-1">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={clsx("px-3 py-1.5 text-xs rounded-lg transition-all", value === r.key ? "gradient-brand text-white font-semibold shadow-glow" : "text-ink2 hover:bg-raised hover:text-ink")}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
