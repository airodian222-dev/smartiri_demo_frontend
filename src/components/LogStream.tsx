import clsx from "clsx";
import { ArrowDownToLine, ArrowUpFromLine, Download, Pause, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import type { StreamKind } from "@/api/internal";
import { isDemo } from "@/lib/config";
import { fmtTime } from "@/lib/format";
import { useLogStream } from "@/lib/hooks";
import { EVENT_TONE } from "./Feed";
import { Badge, Empty, ErrorBox, JsonView } from "./ui";

function isDownlink(desc: string) {
  return /Down|JoinAccept|txack/.test(desc);
}

export function LogStream({ kind, id, emptyHint }: { kind: StreamKind; id: string; emptyHint?: string }) {
  const { items, error, paused, setPaused, clear } = useLogStream(kind, id);
  const [open, setOpen] = useState<string | null>(null);
  const frames = kind !== "deviceEvents";

  const download = () => {
    const blob = new Blob([JSON.stringify(items.map((i) => ({ ...i, body: JSON.parse(i.body || "{}") })), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${kind}-${id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-line">
        <span className="flex items-center gap-2 text-sm">
          <span className={clsx("h-2 w-2 rounded-full", paused ? "bg-muted" : error ? "bg-bad" : "bg-good animate-pulse")} />
          {paused ? "Paused" : error ? "Disconnected" : "Streaming live"}
        </span>
        <span className="text-xs text-muted">{items.length} {frames ? "frames" : "events"}</span>
        <div className="flex-1" />
        <button className="btn-secondary btn-sm" onClick={() => setPaused(!paused)}>{paused ? <><Play className="h-3.5 w-3.5" /> Resume</> : <><Pause className="h-3.5 w-3.5" /> Pause</>}</button>
        <button className="btn-secondary btn-sm" disabled={!items.length} onClick={download}><Download className="h-3.5 w-3.5" /> Download</button>
        <button className="btn-secondary btn-sm" disabled={!items.length} onClick={clear}><Trash2 className="h-3.5 w-3.5" /> Clear</button>
      </div>
      {error && (
        <div className="p-3">
          <ErrorBox title="Stream error" error={error} />
        </div>
      )}
      {items.length === 0 ? (
        <Empty title={paused ? "Stream paused" : "Waiting for data…"}>{emptyHint ?? (isDemo() ? "New items appear here as the simulator generates traffic." : "Items appear when ChirpStack receives or sends traffic.")}</Empty>
      ) : (
        <ul className="divide-y divide-line max-h-[640px] overflow-y-auto">
          {items.map((it) => {
            const down = isDownlink(it.description);
            return (
              <li key={it.id} className="flash-in">
                <button className="w-full text-left px-4 py-2 hover:bg-raised/70 flex items-center gap-3" onClick={() => setOpen(open === it.id ? null : it.id)}>
                  <span className="mono text-xs text-muted w-16 shrink-0 tnum">{fmtTime(it.time)}</span>
                  {frames ? (
                    <span className="shrink-0" style={{ color: down ? "var(--series-2)" : "rgb(var(--brand))" }} title={down ? "Downlink" : "Uplink"}>
                      {down ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                    </span>
                  ) : null}
                  <Badge tone={frames ? (down ? "serious" : "brand") : EVENT_TONE[it.description] ?? "neutral"} className={clsx(frames ? "min-w-[150px]" : "w-16", "justify-center")}>
                    {it.description}
                  </Badge>
                  <span className="flex flex-wrap gap-1.5 min-w-0">
                    {Object.entries(it.properties).map(([k, v]) => (
                      <span key={k} className="text-xs rounded-md bg-raised border border-line px-1.5 py-0.5">
                        <span className="text-muted">{k}:</span> <span className="mono">{v}</span>
                      </span>
                    ))}
                  </span>
                </button>
                {open === it.id && (
                  <div className="px-4 pb-3">
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
