import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { DeviceProfile } from "@/api/types";
import { CODEC_RUNTIMES, MAC_VERSIONS, MEASUREMENT_KINDS, REGIONS, REG_PARAMS } from "@/lib/constants";
import { enumLabel } from "@/lib/format";
import { Field, Select, Tabs, Toggle } from "./ui";

type DP = Omit<DeviceProfile, "tenantId" | "id"> & { tenantId?: string; id?: string };
type TabKey = "general" | "codec" | "measurements";

export const DEFAULT_PROFILE: DP = {
  name: "",
  description: "",
  region: "EU868",
  macVersion: "LORAWAN_1_0_3",
  regParamsRevision: "A",
  adrAlgorithmId: "default",
  payloadCodecRuntime: "NONE",
  payloadCodecScript: "",
  flushQueueOnActivate: true,
  uplinkInterval: 3600,
  deviceStatusReqInterval: 1,
  supportsOtaa: true,
  supportsClassB: false,
  supportsClassC: false,
  tags: {},
  measurements: {},
  autoDetectMeasurements: true,
};

const num = (v: string) => (v === "" ? 0 : Number(v));

export function DeviceProfileForm<T extends DP>({ value: v, onChange }: { value: T; onChange: (v: T) => void }) {
  const [tab, setTab] = useState<TabKey>("general");
  const set = (p: Partial<DP>) => onChange({ ...v, ...p });
  const [newKey, setNewKey] = useState("");

  return (
    <div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "general", label: "General" },
          { key: "codec", label: "Payload decoder" },
          { key: "measurements", label: "Measurements" },
        ]}
      />

      {tab === "general" && (
        <div className="grid gap-4">
          <Field label="Name"><input className="input" required value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Description"><textarea className="input h-16" value={v.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Region"><Select value={v.region} onChange={(r) => set({ region: r, regionConfigId: "" })} options={[...REGIONS]} /></Field>
            <Field label="LoRaWAN version"><Select value={v.macVersion} onChange={(m) => set({ macVersion: m })} options={MAC_VERSIONS.map((m) => ({ value: m, label: enumLabel(m) }))} /></Field>
            <Field label="Regional parameters"><Select value={v.regParamsRevision} onChange={(m) => set({ regParamsRevision: m })} options={REG_PARAMS.map((m) => ({ value: m, label: m.replace(/_/g, ".").replace("RP002.", "RP002-") }))} /></Field>
          </div>
          <Field label="Expected uplink interval (seconds)" help="Devices silent for longer than twice this interval are shown as inactive." className="max-w-sm">
            <input type="number" className="input" value={v.uplinkInterval ?? 0} onChange={(e) => set({ uplinkInterval: num(e.target.value) })} />
          </Field>
          <div className="grid sm:grid-cols-3 gap-4 rounded-2xl border border-line/70 bg-raised/30 p-4">
            <Toggle checked={!!v.supportsOtaa} onChange={(x) => set({ supportsOtaa: x })} label="Join with OTAA" help="Over-the-air activation (recommended)." />
            <Toggle checked={!!v.supportsClassB} onChange={(x) => set({ supportsClassB: x })} label="Class B" help="Scheduled receive slots." />
            <Toggle checked={!!v.supportsClassC} onChange={(x) => set({ supportsClassC: x })} label="Class C" help="Always listening, e.g. mains-powered." />
          </div>
        </div>
      )}

      {tab === "codec" && (
        <div className="grid gap-4">
          <Field label="Decoder" help="Turns raw payload bytes into readable values (temperature, humidity…) for the dashboards.">
            <Select value={v.payloadCodecRuntime ?? "NONE"} onChange={(x) => set({ payloadCodecRuntime: x })} options={CODEC_RUNTIMES.map((c) => ({ value: c, label: c === "NONE" ? "None" : c === "JS" ? "JavaScript functions" : "Cayenne LPP" }))} />
          </Field>
          {v.payloadCodecRuntime === "JS" && (
            <Field label="Decoder script" help="Implement decodeUplink(input) and optionally encodeDownlink(input).">
              <textarea spellCheck={false} className="input mono text-xs h-[380px] leading-5" value={v.payloadCodecScript ?? ""} onChange={(e) => set({ payloadCodecScript: e.target.value })} />
            </Field>
          )}
        </div>
      )}

      {tab === "measurements" && (
        <div className="grid gap-4">
          <p className="text-sm text-muted">Measurements are the decoded values that get charted on the dashboards.</p>
          <Toggle checked={!!v.autoDetectMeasurements} onChange={(x) => set({ autoDetectMeasurements: x })} label="Detect new measurements automatically" />
          <div className="space-y-2">
            {Object.entries(v.measurements ?? {}).map(([k, m]) => (
              <div key={k} className="grid grid-cols-[1fr_1fr_150px_auto] gap-2 items-center">
                <input className="input mono" value={k} disabled />
                <input className="input" placeholder="Display name" value={m.name ?? ""} onChange={(e) => set({ measurements: { ...v.measurements, [k]: { ...m, name: e.target.value } } })} />
                <Select value={m.kind ?? "UNKNOWN"} onChange={(kind) => set({ measurements: { ...v.measurements, [k]: { ...m, kind } } })} options={[...MEASUREMENT_KINDS]} />
                <button type="button" className="btn-ghost" onClick={() => { const c = { ...v.measurements }; delete c[k]; set({ measurements: c }); }}><X className="h-4 w-4" /></button>
              </div>
            ))}
            <div className="flex gap-2 max-w-md">
              <input className="input mono" placeholder="value key, e.g. temperature" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
              <button type="button" className="btn-secondary" disabled={!newKey} onClick={() => { set({ measurements: { ...v.measurements, [newKey]: { name: newKey, kind: "GAUGE" } } }); setNewKey(""); }}>
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
