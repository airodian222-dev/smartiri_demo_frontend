import clsx from "clsx";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { FeedEvent } from "@/api/types";
import { fmtTime } from "@/lib/format";
import { Badge, JsonView } from "./ui";

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

export function FeedList({ events, compact, onSelect }: { events: FeedEvent[]; compact?: boolean; onSelect?: (e: FeedEvent) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="divide-y divide-line">
      {events.map((e) => (
        <li key={e.id} className="flash-in">
          <button
            className="w-full text-left px-4 py-2 hover:bg-raised/70 flex items-center gap-3"
            onClick={() => (onSelect ? onSelect(e) : setOpen(open === e.id ? null : e.id))}
          >
            <span className="mono text-xs text-muted w-16 shrink-0 tnum">{fmtTime(e.time)}</span>
            <Badge tone={EVENT_TONE[e.type] ?? "neutral"} className="w-14 justify-center">{e.type}</Badge>
            <span className="min-w-0 flex-1">
              <span className="text-sm">
                <Link to={`/devices/${e.devEui}`} className="font-medium hover:underline" onClick={(x) => x.stopPropagation()}>
                  {e.deviceName}
                </Link>
                {!compact && <span className="text-muted"> · {e.applicationName}</span>}
              </span>
              <span className={clsx("block text-xs text-muted truncate", compact ? "" : "mono")}>{e.summary}</span>
            </span>
          </button>
          {open === e.id && (
            <div className="px-4 pb-3">
              <JsonView value={e.body} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
