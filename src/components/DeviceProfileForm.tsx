import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import * as api from "@/api/chirpstack";
import { listRegions } from "@/api/internal";
import type { DeviceProfile } from "@/api/types";
import { CODEC_RUNTIMES, MAC_VERSIONS, MEASUREMENT_KINDS, REGIONS, REG_PARAMS } from "@/lib/constants";
import { enumLabel } from "@/lib/format";
import { Field, KeyValueEditor, Select, Tabs, Toggle } from "./ui";

type DP = Omit<DeviceProfile, "tenantId" | "id"> & { tenantId?: string; id?: string; vendor?: string; firmware?: string };

type TabKey = "general" | "join" | "classb" | "classc" | "codec" | "measurements" | "tags";

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
  classBTimeout: 0,
  classBPingSlotPeriodicity: 0,
  classBPingSlotDr: 0,
  classBPingSlotFreq: 0,
  classCTimeout: 0,
  abpRx1Delay: 0,
  abpRx1DrOffset: 0,
  abpRx2Dr: 0,
  abpRx2Freq: 0,
  tags: {},
  measurements: {},
  autoDetectMeasurements: true,
  allowRoaming: false,
};

const num = (v: string) => (v === "" ? 0 : Number(v));

export function DeviceProfileForm<T extends DP>({ value: v, onChange, template }: { value: T; onChange: (v: T) => void; template?: boolean }) {
  const [tab, setTab] = useState<TabKey>("general");
  const adr = useQuery({ queryKey: ["adr-algorithms"], queryFn: api.deviceProfiles.adrAlgorithms });
  const regions = useQuery({ queryKey: ["regions"], queryFn: listRegions, retry: false });
  const set = (p: Partial<DP>) => onChange({ ...v, ...p });
  const regionConfigs = (regions.data ?? []).filter((r) => r.region === v.region);
  const [newKey, setNewKey] = useState("");

  return (
    <div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "general", label: "General" },
          { key: "join", label: "Join (OTAA / ABP)" },
          { key: "classb", label: "Class-B" },
          { key: "classc", label: "Class-C" },
          { key: "codec", label: "Codec" },
          { key: "measurements", label: "Measurements" },
          { key: "tags", label: "Tags" },
        ]}
      />

      {tab === "general" && (
        <div className="grid gap-4">
          {template && (
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Template ID" help="e.g. vendor-model-region"><input className="input mono" required disabled={!!v.id && !v.id.startsWith("__new")} value={v.id?.startsWith("__new") ? "" : v.id ?? ""} onChange={(e) => set({ id: e.target.value })} /></Field>
              <Field label="Vendor"><input className="input" required value={v.vendor ?? ""} onChange={(e) => set({ vendor: e.target.value })} /></Field>
              <Field label="Firmware version"><input className="input" required value={v.firmware ?? ""} onChange={(e) => set({ firmware: e.target.value })} /></Field>
            </div>
          )}
          <Field label="Name"><input className="input" required value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Description"><textarea className="input h-16" value={v.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Region"><Select value={v.region} onChange={(r) => set({ region: r, regionConfigId: "" })} options={[...REGIONS]} /></Field>
            {!template && (
              <Field label="Region configuration" help="Leave empty to use any enabled configuration.">
                <Select value={v.regionConfigId ?? ""} onChange={(r) => set({ regionConfigId: r })} options={[{ value: "", label: "Any" }, ...regionConfigs.map((r) => ({ value: r.id, label: r.description || r.id }))]} />
              </Field>
            )}
            <Field label="ADR algorithm"><Select value={v.adrAlgorithmId ?? "default"} onChange={(a) => set({ adrAlgorithmId: a })} options={(adr.data?.result ?? [{ id: "default", name: "Default ADR algorithm" }]).map((a) => ({ value: a.id, label: a.name }))} /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="MAC version" help="LoRaWAN version supported by the device."><Select value={v.macVersion} onChange={(m) => set({ macVersion: m })} options={MAC_VERSIONS.map((m) => ({ value: m, label: enumLabel(m) }))} /></Field>
            <Field label="Regional parameters revision"><Select value={v.regParamsRevision} onChange={(m) => set({ regParamsRevision: m })} options={REG_PARAMS.map((m) => ({ value: m, label: m.replace(/_/g, ".").replace("RP002.", "RP002-") }))} /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Expected uplink interval (secs)" help="Used to decide if a device is active or inactive."><input type="number" className="input" value={v.uplinkInterval ?? 0} onChange={(e) => set({ uplinkInterval: num(e.target.value) })} /></Field>
            <Field label="Device-status request frequency (req/day)" help="0 = disabled."><input type="number" className="input" value={v.deviceStatusReqInterval ?? 0} onChange={(e) => set({ deviceStatusReqInterval: num(e.target.value) })} /></Field>
          </div>
          <Toggle checked={!!v.flushQueueOnActivate} onChange={(x) => set({ flushQueueOnActivate: x })} label="Flush queue on activate" help="Flush the device queue on (re)activation." />
          {!template && <Toggle checked={!!v.allowRoaming} onChange={(x) => set({ allowRoaming: x })} label="Allow roaming" help="Allow the device to use passive-roaming partners." />}
        </div>
      )}

      {tab === "join" && (
        <div className="grid gap-4">
          <Toggle checked={!!v.supportsOtaa} onChange={(x) => set({ supportsOtaa: x })} label="Device supports OTAA" help="Over-the-air activation using the join procedure. Disable for ABP devices." />
          {!v.supportsOtaa && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="RX1 delay (secs)"><input type="number" className="input" value={v.abpRx1Delay ?? 0} onChange={(e) => set({ abpRx1Delay: num(e.target.value) })} /></Field>
              <Field label="RX1 data-rate offset"><input type="number" className="input" value={v.abpRx1DrOffset ?? 0} onChange={(e) => set({ abpRx1DrOffset: num(e.target.value) })} /></Field>
              <Field label="RX2 data-rate"><input type="number" className="input" value={v.abpRx2Dr ?? 0} onChange={(e) => set({ abpRx2Dr: num(e.target.value) })} /></Field>
              <Field label="RX2 frequency (Hz)"><input type="number" className="input" value={v.abpRx2Freq ?? 0} onChange={(e) => set({ abpRx2Freq: num(e.target.value) })} /></Field>
            </div>
          )}
        </div>
      )}

      {tab === "classb" && (
        <div className="grid gap-4">
          <Toggle checked={!!v.supportsClassB} onChange={(x) => set({ supportsClassB: x })} label="Device supports Class-B" help="Scheduled receive windows synchronised by gateway beacons." />
          {v.supportsClassB && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Class-B confirmed downlink timeout (secs)"><input type="number" className="input" value={v.classBTimeout ?? 0} onChange={(e) => set({ classBTimeout: num(e.target.value) })} /></Field>
              <Field label="Ping-slot periodicity">
                <Select value={String(v.classBPingSlotPeriodicity ?? 0)} onChange={(x) => set({ classBPingSlotPeriodicity: +x })} options={[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ value: String(i), label: `Every ${2 ** i} sec` }))} />
              </Field>
              <Field label="Ping-slot data-rate"><input type="number" className="input" value={v.classBPingSlotDr ?? 0} onChange={(e) => set({ classBPingSlotDr: num(e.target.value) })} /></Field>
              <Field label="Ping-slot frequency (Hz)" help="0 = default / hopping"><input type="number" className="input" value={v.classBPingSlotFreq ?? 0} onChange={(e) => set({ classBPingSlotFreq: num(e.target.value) })} /></Field>
            </div>
          )}
        </div>
      )}

      {tab === "classc" && (
        <div className="grid gap-4">
          <Toggle checked={!!v.supportsClassC} onChange={(x) => set({ supportsClassC: x })} label="Device supports Class-C" help="Continuously listening; downlinks are sent immediately." />
          {v.supportsClassC && (
            <Field label="Class-C confirmed downlink timeout (secs)" className="max-w-sm"><input type="number" className="input" value={v.classCTimeout ?? 0} onChange={(e) => set({ classCTimeout: num(e.target.value) })} /></Field>
          )}
        </div>
      )}

      {tab === "codec" && (
        <div className="grid gap-4">
          <Field label="Payload codec">
            <Select value={v.payloadCodecRuntime ?? "NONE"} onChange={(x) => set({ payloadCodecRuntime: x })} options={CODEC_RUNTIMES.map((c) => ({ value: c, label: c === "NONE" ? "None" : c === "JS" ? "JavaScript functions" : "Cayenne LPP" }))} />
          </Field>
          {v.payloadCodecRuntime === "JS" && (
            <Field label="Codec functions" help="Must implement decodeUplink(input) and optionally encodeDownlink(input).">
              <textarea spellCheck={false} className="input mono text-xs h-[380px] leading-5" value={v.payloadCodecScript ?? ""} onChange={(e) => set({ payloadCodecScript: e.target.value })} />
            </Field>
          )}
        </div>
      )}

      {tab === "measurements" && (
        <div className="grid gap-4">
          <p className="text-sm text-muted">Measurements expose decoded payload values as device metrics (charts on the device dashboard).</p>
          <Toggle checked={!!v.autoDetectMeasurements} onChange={(x) => set({ autoDetectMeasurements: x })} label="Automatically detect measurement keys" help="New keys in decoded payloads are added automatically." />
          <div className="space-y-2">
            {Object.entries(v.measurements ?? {}).map(([k, m]) => (
              <div key={k} className="grid grid-cols-[1fr_1fr_160px_auto] gap-2 items-center">
                <input className="input mono" value={k} disabled />
                <input className="input" placeholder="Name" value={m.name ?? ""} onChange={(e) => set({ measurements: { ...v.measurements, [k]: { ...m, name: e.target.value } } })} />
                <Select value={m.kind ?? "UNKNOWN"} onChange={(kind) => set({ measurements: { ...v.measurements, [k]: { ...m, kind } } })} options={[...MEASUREMENT_KINDS]} />
                <button type="button" className="btn-ghost" onClick={() => { const c = { ...v.measurements }; delete c[k]; set({ measurements: c }); }}><X className="h-4 w-4" /></button>
              </div>
            ))}
            <div className="flex gap-2 max-w-md">
              <input className="input mono" placeholder="object key, e.g. temperature" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
              <button type="button" className="btn-secondary" disabled={!newKey} onClick={() => { set({ measurements: { ...v.measurements, [newKey]: { name: newKey, kind: "GAUGE" } } }); setNewKey(""); }}>
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "tags" && (
        <Field label="Tags" help="Tags are added to every event of devices using this profile.">
          <KeyValueEditor value={v.tags ?? {}} onChange={(tags) => set({ tags })} />
        </Field>
      )}
    </div>
  );
}
