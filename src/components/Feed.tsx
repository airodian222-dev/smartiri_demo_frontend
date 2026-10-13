import clsx from "clsx";
import { ArrowDownToLine, ArrowUpFromLine, BatteryMedium, CheckCheck, LogIn, MapPin, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { FeedEvent } from "@/api/types";
import { fmtTime } from "@/lib/format";
import { sensorMeta } from "./sensors";
import { JsonView } from "./ui";

export const EVENT_TONE: Record<string, "brand" | "good" | "warn" | "bad" | "neutral" | "serious"> = {
  up: "brand",
  join: "good",
  status: "neutral",
  ack: "good",
  txack: "serious",
  log: "warn",
  location: "neutral",
  integration: "neutral",
};

export const EVENT_STYLE: Record<string, { icon: ReactNode; cls: string; label: string }> = {
  up: { icon: <ArrowUpFromLine />, cls: "from-indigo-500 to-violet-500", label: "Uplink" },
  join: { icon: <LogIn />, cls: "from-emerald-500 to-teal-500", label: "Join" },
  status: { icon: <BatteryMedium />, cls: "from-sky-500 to-cyan-500", label: "Status" },
  ack: { icon: <CheckCheck />, cls: "from-emerald-500 to-lime-500", label: "Ack" },
  txack: { icon: <ArrowDownToLine />, cls: "from-amber-500 to-orange-500", label: "Downlink" },
  log: { icon: <TriangleAlert />, cls: "from-rose-500 to-pink-500", label: "Alert" },
  location: { icon: <MapPin />, cls: "from-blue-500 to-indigo-500", label: "Location" },
};

function fmtVal(v: unknown) {
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
  return String(v);
}

export function EventIcon({ type, size = "md" }: { type: string; size?: "sm" | "md" }) {
  const st = EVENT_STYLE[type] ?? EVENT_STYLE.up;
  return (
    <span className={clsx("rounded-xl bg-gradient-to-br text-white grid place-items-center shrink-0 shadow-md", st.cls, size === "sm" ? "h-7 w-7 [&>svg]:h-3.5 [&>svg]:w-3.5" : "h-9 w-9 [&>svg]:h-4 [&>svg]:w-4")}>
      {st.icon}
    </span>
  );
}

export function FeedList({ events, compact, onSelect, selectedId }: { events: FeedEvent[]; compact?: boolean; onSelect?: (e: FeedEvent) => void; selectedId?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="relative">
      {events.map((e) => {
        const obj = (e.body as { object?: Record<string, unknown> }).object;
        const chips = e.type === "up" && obj ? Object.entries(obj).filter(([k]) => k !== "latitude" && k !== "longitude").slice(0, compact ? 2 : 4) : [];
        return (
          <li key={e.id} className="flash-in">
            <button
              className={clsx("w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors rounded-xl", selectedId === e.id ? "bg-brand/10 ring-1 ring-brand/30" : "hover:bg-raised/60")}
              onClick={() => (onSelect ? onSelect(e) : setOpen(open === e.id ? null : e.id))}
            >
              <EventIcon type={e.type} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm">
                  <Link to={`/devices/${e.devEui}`} className="font-semibold hover:text-brand truncate" onClick={(x) => x.stopPropagation()}>
                    {e.deviceName}
                  </Link>
                  {!compact && <span className="text-muted text-xs truncate hidden sm:inline">{e.applicationName}</span>}
                </span>
                {chips.length ? (
                  <span className="flex flex-wrap gap-1.5 mt-1">
                    {chips.map(([k, v]) => {
                      const m = sensorMeta(k);
                      return (
                        <span key={k} className="chip">
                          <span className="text-muted">{m.label}</span>
                          <span className="font-semibold tnum">{fmtVal(v)}</span>
                          {m.unit && <span className="text-muted">{m.unit}</span>}
                        </span>
                      );
                    })}
                  </span>
                ) : (
                  <span className="block text-xs text-muted truncate mt-0.5">{e.summary}</span>
                )}
              </span>
              <span className="text-right shrink-0">
                <span className="block text-[11px] font-medium text-ink2">{EVENT_STYLE[e.type]?.label ?? e.type}</span>
                <span className="block mono text-[11px] text-muted tnum">{fmtTime(e.time)}</span>
              </span>
            </button>
            {open === e.id && (
              <div className="px-4 pb-3">
                <JsonView value={e.body} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
