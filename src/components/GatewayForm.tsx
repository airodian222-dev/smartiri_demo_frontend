import type { Gateway } from "@/api/types";
import { Field, HexInput, KeyValueEditor } from "./ui";

export function GatewayForm({ value: g, onChange, isNew }: { value: Gateway; onChange: (g: Gateway) => void; isNew?: boolean }) {
  const set = (p: Partial<Gateway>) => onChange({ ...g, ...p });
  const loc = g.location ?? {};
  return (
    <div className="grid gap-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name"><input className="input" required value={g.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Gateway ID (EUI64)">
          <HexInput bytes={8} value={g.gatewayId} disabled={!isNew} generate={isNew} onChange={(gatewayId) => set({ gatewayId })} />
        </Field>
      </div>
      <Field label="Description"><textarea className="input h-16" value={g.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
      <Field label="Stats interval (secs)" help="Expected interval between gateway statistics; used to determine online/offline state." className="max-w-xs">
        <input type="number" className="input" value={g.statsInterval ?? 30} onChange={(e) => set({ statsInterval: +e.target.value })} />
      </Field>
      <div>
        <div className="label">Location</div>
        <div className="grid sm:grid-cols-3 gap-4">
          <input className="input" type="number" step="any" placeholder="Latitude" value={loc.latitude ?? ""} onChange={(e) => set({ location: { ...loc, latitude: +e.target.value, source: "CONFIG" } })} />
          <input className="input" type="number" step="any" placeholder="Longitude" value={loc.longitude ?? ""} onChange={(e) => set({ location: { ...loc, longitude: +e.target.value, source: "CONFIG" } })} />
          <input className="input" type="number" step="any" placeholder="Altitude (m)" value={loc.altitude ?? ""} onChange={(e) => set({ location: { ...loc, altitude: +e.target.value, source: "CONFIG" } })} />
        </div>
        <p className="text-xs text-muted mt-1">If the gateway reports a GPS location, it overrides this value.</p>
      </div>
      <Field label="Tags" help="Tags are attached to uplink rxInfo of this gateway.">
        <KeyValueEditor value={g.tags ?? {}} onChange={(tags) => set({ tags })} />
      </Field>
    </div>
  );
}
