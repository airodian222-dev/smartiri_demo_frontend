import type { DeviceListItem } from "@/api/types";
import { batteryLabel, timeAgo } from "@/lib/format";
import type { Column } from "./DataTable";
import { Badge } from "./ui";

export function deviceState(lastSeenAt?: string): { label: string; tone: "good" | "bad" | "neutral" } {
  if (!lastSeenAt) return { label: "Never seen", tone: "neutral" };
  if (Date.now() - new Date(lastSeenAt).getTime() < 86_400_000) return { label: "Active", tone: "good" };
  return { label: "Inactive", tone: "bad" };
}

export function BatteryBar({ level, external }: { level?: number; external?: boolean }) {
  if (external) return <span className="text-xs text-muted">External</span>;
  if (level === undefined || level < 0) return <span className="text-muted">—</span>;
  const color = level < 25 ? "rgb(var(--bad))" : level < 45 ? "rgb(var(--warn))" : "rgb(var(--good))";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-10 rounded-full bg-raised border border-line overflow-hidden">
        <span className="block h-full" style={{ width: `${Math.min(100, level)}%`, background: color }} />
      </span>
      <span className="text-xs tnum">{batteryLabel(level)}</span>
    </span>
  );
}

export function deviceColumns<R extends DeviceListItem>(extra: Column<R>[] = []): Column<R>[] {
  return [
    { key: "state", header: "Status", render: (d) => { const s = deviceState(d.lastSeenAt); return <Badge tone={s.tone} dot>{s.label}</Badge>; }, sort: (d) => d.lastSeenAt ?? "" },
    { key: "name", header: "Name", render: (d) => <span className="font-medium">{d.name}</span>, sort: (d) => d.name },
    { key: "eui", header: "DevEUI", render: (d) => <span className="mono">{d.devEui}</span> },
    ...extra,
    { key: "profile", header: "Device profile", render: (d) => <span className="text-ink2 text-xs">{d.deviceProfileName}</span>, sort: (d) => d.deviceProfileName },
    { key: "batt", header: "Battery", render: (d) => <BatteryBar level={d.deviceStatus?.batteryLevel} external={d.deviceStatus?.externalPowerSource} />, sort: (d) => (d.deviceStatus?.externalPowerSource ? 101 : d.deviceStatus?.batteryLevel ?? -1) },
    { key: "margin", header: "Margin", render: (d) => (d.deviceStatus?.margin !== undefined && d.lastSeenAt ? `${d.deviceStatus.margin} dB` : "—"), sort: (d) => d.deviceStatus?.margin ?? -99 },
    { key: "seen", header: "Last seen", render: (d) => <span className="text-ink2">{timeAgo(d.lastSeenAt)}</span>, sort: (d) => d.lastSeenAt ?? "" },
  ];
}
