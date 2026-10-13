import clsx from "clsx";
import { Clock, Signal } from "lucide-react";
import { Link } from "react-router-dom";
import { timeAgo } from "@/lib/format";
import type { TenantDevice } from "@/lib/hooks";
import { BatteryBar, deviceState } from "./DeviceTable";
import { deviceKind, SensorChip } from "./sensors";

export function DeviceCard({ d }: { d: TenantDevice }) {
  const st = deviceState(d.lastSeenAt);
  const k = deviceKind(d.tags, d.deviceProfileName);
  const ring = st.tone === "good" ? "bg-good shadow-[0_0_10px_rgb(var(--good))]" : st.tone === "bad" ? "bg-bad shadow-[0_0_10px_rgb(var(--bad))]" : "bg-muted";
  const margin = d.deviceStatus?.margin;
  const bars = margin === undefined || !d.lastSeenAt ? 0 : margin >= 15 ? 4 : margin >= 10 ? 3 : margin >= 5 ? 2 : 1;
  return (
    <Link to={`/devices/${d.devEui}`} className="card card-hover p-4 block relative overflow-hidden group animate-rise">
      <div className={clsx("absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-[0.14] blur-2xl transition-opacity group-hover:opacity-30", k.gradient)} />
      <div className="flex items-start gap-3 relative">
        <SensorChip gradient={k.gradient}>{k.icon}</SensorChip>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{d.name}</div>
          <div className="text-xs text-muted truncate">{k.label} · {d.applicationName}</div>
        </div>
        <span className="relative flex h-2.5 w-2.5 mt-1.5" title={st.label}>
          {st.tone === "good" && <span className="absolute inline-flex h-full w-full rounded-full bg-good animate-ping2" />}
          <span className={clsx("relative inline-flex h-2.5 w-2.5 rounded-full", ring)} />
        </span>
      </div>
      <div className="mt-4 mono text-[11px] text-muted truncate relative">{d.devEui}</div>
      <div className="mt-3 grid grid-cols-3 gap-2 relative">
        <div className="rounded-xl bg-raised/60 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted">Battery</div>
          <div className="mt-1"><BatteryBar level={d.deviceStatus?.batteryLevel} external={d.deviceStatus?.externalPowerSource} /></div>
        </div>
        <div className="rounded-xl bg-raised/60 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted flex items-center gap-1"><Signal className="h-3 w-3" /> Link</div>
          <div className="mt-1 flex items-end gap-0.5 h-4">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={clsx("w-1.5 rounded-sm", i <= bars ? "bg-gradient-to-t from-indigo-500 to-cyan-400" : "bg-line")} style={{ height: `${i * 25}%` }} />
            ))}
            <span className="text-[11px] text-ink2 ml-1.5 tnum">{bars ? `${margin} dB` : "—"}</span>
          </div>
        </div>
        <div className="rounded-xl bg-raised/60 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted flex items-center gap-1"><Clock className="h-3 w-3" /> Seen</div>
          <div className="mt-1 text-xs font-medium truncate">{timeAgo(d.lastSeenAt)}</div>
        </div>
      </div>
    </Link>
  );
}
