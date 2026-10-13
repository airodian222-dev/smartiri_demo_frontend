import clsx from "clsx";
import { Download, Pause, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { isDemo } from "@/lib/config";
import { fmtTime } from "@/lib/format";
import { useDeviceEvents } from "@/lib/hooks";
import { EVENT_STYLE, EventIcon } from "./Feed";
import { sensorMeta } from "./sensors";
import { Empty, ErrorBox, JsonView } from "./ui";

function chipsFor(description: string, body: string): [string, string][] {
  try {
    const b = JSON.parse(body);
    if (description === "up" && b.object) {
      return Object.entries(b.object as Record<string, unknown>)
        .filter(([k]) => k !== "latitude" && k !== "longitude")
        .map(([k, v]) => {
          const m = sensorMeta(k);
          const val = typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1)) : typeof v === "boolean" ? (v ? "yes" : "no") : String(v);
          return [m.label, `${val}${m.unit ? ` ${m.unit}` : ""}`];
        });
    }
  } catch {
    /* fall through */
  }
  return [];
}

/** Live event stream of one device (uplinks with decoded values, joins, status, downlink acks, alerts). */
export function LogStream({ id, emptyHint }: { id: string; emptyHint?: string }) {
  const { items, error, paused, setPaused, clear } = useDeviceEvents(id);
  const [open, setOpen] = useState<string | null>(null);

  const download = () => {
    const blob = new Blob([JSON.stringify(items.map((i) => ({ ...i, body: JSON.parse(i.body || "{}") })), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `events-${id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="card overflow-hidden animate-rise">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-line">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className={clsx("h-2 w-2 rounded-full", paused ? "bg-muted" : error ? "bg-bad" : "bg-good shadow-[0_0_10px_rgb(var(--good))] animate-pulse")} />
          {paused ? "Paused" : error ? "Disconnected" : "Streaming live"}
        </span>
        <span className="text-xs text-muted">{items.length} events</span>
        <div className="flex-1" />
        <button className="btn-secondary btn-sm" onClick={() => setPaused(!paused)}>{paused ? <><Play className="h-3.5 w-3.5" /> Resume</> : <><Pause className="h-3.5 w-3.5" /> Pause</>}</button>
        <button className="btn-secondary btn-sm" disabled={!items.length} onClick={download}><Download className="h-3.5 w-3.5" /> Export</button>
        <button className="btn-secondary btn-sm" disabled={!items.length} onClick={clear}><Trash2 className="h-3.5 w-3.5" /> Clear</button>
      </div>
      {error && (
        <div className="p-3">
          <ErrorBox title="Stream error" error={error} />
        </div>
      )}
      {items.length === 0 ? (
        <Empty title={paused ? "Stream paused" : "Waiting for data…"}>{emptyHint ?? (isDemo() ? "New readings appear here as the device reports." : "Readings appear when the device sends data.")}</Empty>
      ) : (
        <ul className="max-h-[640px] overflow-y-auto p-1.5">
          {items.map((it) => {
            const chips = chipsFor(it.description, it.body);
            const props = Object.entries(it.properties);
            return (
              <li key={it.id} className="flash-in">
                <button className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-raised/60 flex items-center gap-3" onClick={() => setOpen(open === it.id ? null : it.id)}>
                  <EventIcon type={it.description} />
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-semibold">{EVENT_STYLE[it.description]?.label ?? it.description}</span>
                    <span className="flex flex-wrap gap-1.5 mt-1">
                      {(chips.length ? chips : props).map(([k, v]) => (
                        <span key={k} className="chip">
                          <span className="text-muted">{k}</span> <span className="font-semibold tnum">{v}</span>
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="mono text-[11px] text-muted tnum shrink-0">{fmtTime(it.time)}</span>
                </button>
                {open === it.id && (
                  <div className="px-3 pb-3">
                    <JsonView value={it.body} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
