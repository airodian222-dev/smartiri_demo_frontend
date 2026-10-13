import { useQuery } from "@tanstack/react-query";
import { Gauge, Radio, Settings, Trash2, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { Device, DeviceKeys, DeviceProfile, Metric } from "@/api/types";
import { ChartCard, MetricChart } from "@/components/charts";
import { BatteryBar, deviceState } from "@/components/DeviceTable";
import { deviceKind, SensorChip, sensorMeta } from "@/components/sensors";
import { LogStream } from "@/components/LogStream";
import { TimeRangePicker, useWindow, type RangeKey } from "@/components/TimeRange";
import { Badge, Card, ConfirmButton, Empty, ErrorBox, Field, FormActions, HexInput, KeyValueEditor, KV, Loading, Select, Spinner, Tabs, Toggle } from "@/components/ui";
import { useSession } from "@/context/session";
import { base64ToHex, enumLabel, fmtDate, fmtFreq, timeAgo } from "@/lib/format";
import { useAction, useDeviceEvents } from "@/lib/hooks";

type Tab = "dashboard" | "events" | "config";

export default function DeviceDetail() {
  const { devEui } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");
  const q = useQuery({ queryKey: ["device", devEui], queryFn: () => api.devices.get(devEui!) });
  const dpId = q.data?.device.deviceProfileId;
  const dp = useQuery({ queryKey: ["device-profile", dpId], queryFn: () => api.deviceProfiles.get(dpId!), enabled: !!dpId });
  const appId = q.data?.device.applicationId;
  const app = useQuery({ queryKey: ["application", appId], queryFn: () => api.applications.get(appId!), enabled: !!appId });
  const del = useAction(() => api.devices.delete(devEui!), { success: "Device deleted", invalidate: [["devices"]], onSuccess: () => nav(appId ? `/applications/${appId}` : "/devices") });

  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading />;
  const d = q.data;
  const profile = dp.data?.deviceProfile;
  const st = deviceState(d.lastSeenAt);
  const kind = deviceKind(d.device.tags, profile?.name);

  return (
    <div>
      <nav className="text-xs text-muted mb-3 flex items-center gap-1">
        <Link to="/devices" className="hover:text-ink">Devices</Link> <span className="opacity-60">/</span>
        <Link to={appId ? `/applications/${appId}` : "/applications"} className="hover:text-ink">{app.data?.application.name ?? "…"}</Link> <span className="opacity-60">/</span>
        <span className="text-ink2">{d.device.name}</span>
      </nav>
      <section className="card relative overflow-hidden p-5 sm:p-6 mb-6 animate-rise">
        <div className={`absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gradient-to-br ${kind.gradient} opacity-20 blur-3xl`} />
        <div className="relative flex flex-wrap items-start gap-5">
          <SensorChip gradient={kind.gradient} size="lg">{kind.icon}</SensorChip>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{d.device.name}</h1>
              <Badge tone={st.tone} dot>{st.label}</Badge>
              {d.device.isDisabled && <Badge tone="bad">Disabled</Badge>}
              <Badge tone="brand">{(d.classEnabled ?? "CLASS_A").replace("_", " ")}</Badge>
            </div>
            <div className="text-sm text-muted mt-1 flex flex-wrap gap-x-3">
              <span>{kind.label}</span>
              <span className="mono">{d.device.devEui}</span>
              {profile && <span>{profile.region} · {enumLabel(profile.macVersion)}</span>}
            </div>
            {d.device.description && <p className="text-sm text-ink2 mt-2 max-w-2xl">{d.device.description}</p>}
          </div>
          <ConfirmButton className="btn-secondary text-bad" onConfirm={() => del.mutateAsync(undefined)} title="Delete device?" message="The device, its keys, activation and queue are deleted."><Trash2 className="h-4 w-4" /> Delete</ConfirmButton>
        </div>
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            ["Last seen", d.lastSeenAt ? timeAgo(d.lastSeenAt) : "Never"],
            ["Battery", <BatteryBar level={d.deviceStatus?.batteryLevel} external={d.deviceStatus?.externalPowerSource} />],
            ["Link margin", d.deviceStatus?.margin !== undefined && d.lastSeenAt ? `${d.deviceStatus.margin} dB` : "—"],
            ["Application", app.data?.application.name ?? "…"],
          ].map(([k, v], i) => (
            <div key={i} className="rounded-xl bg-raised/60 border border-line/60 px-3.5 py-2.5">
              <div className="text-[10.5px] uppercase tracking-wider text-muted">{k}</div>
              <div className="text-sm font-semibold mt-1 truncate">{v}</div>
            </div>
          ))}
        </div>
      </section>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "dashboard", label: "Dashboard", icon: <Gauge className="h-4 w-4" /> },
          { key: "events", label: "Live data", icon: <Zap className="h-4 w-4" /> },
          { key: "config", label: "Settings", icon: <Settings className="h-4 w-4" /> },
        ]}
      />
      {tab === "dashboard" && <DeviceDashboard devEui={devEui!} profile={profile} info={d} onTab={setTab} />}
      {tab === "events" && <LogStream id={devEui!} />}
      {tab === "config" && (
        <div className="grid xl:grid-cols-[1.4fr_1fr] gap-5 items-start">
          <DeviceConfig device={d.device} />
          {profile?.supportsOtaa !== false && <DeviceKeysTab devEui={devEui!} profile={profile} />}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Dashboard
function DeviceDashboard({ devEui, profile, info, onTab }: { devEui: string; profile?: DeviceProfile; info: Awaited<ReturnType<typeof api.devices.get>>; onTab: (t: Tab) => void }) {
  const [range, setRange] = useState<RangeKey>("24h");
  const w = useWindow(range);
  const metrics = useQuery({ queryKey: ["device", devEui, "metrics", w], queryFn: () => api.devices.metrics(devEui, w) });
  const link = useQuery({ queryKey: ["device", devEui, "link-metrics", w], queryFn: () => api.devices.linkMetrics(devEui, w) });
  const events = useDeviceEvents(devEui, 50);
  const lastUp = useMemo(() => {
    const it = events.items.find((e) => e.description === "up");
    if (!it) return null;
    try {
      return JSON.parse(it.body) as { time: string; fCnt: number; fPort: number; dr: number; object?: Record<string, unknown>; data?: string; rxInfo?: { gatewayId: string; rssi: number; snr: number }[]; txInfo?: { frequency: number } };
    } catch {
      return null;
    }
  }, [events.items]);
  const st = info.deviceStatus;
  const measurements = profile?.measurements ?? {};
  // Fallback when no live uplink arrived yet: last non-zero value of each measurement metric.
  const fromMetrics = useMemo(() => {
    const o: Record<string, unknown> = {};
    for (const [k, m] of Object.entries(metrics.data?.metrics ?? {})) {
      if (m.kind === "COUNTER") continue;
      const last = [...(m.datasets?.[0]?.data ?? [])].reverse().find((x) => x !== 0);
      if (last !== undefined) o[k] = +last.toFixed(1);
    }
    for (const [k, s] of Object.entries(metrics.data?.states ?? {})) o[k] = s.value;
    return o;
  }, [metrics.data]);
  const values = lastUp?.object && Object.keys(lastUp.object).length ? lastUp.object : Object.keys(fromMetrics).length ? fromMetrics : null;
  const gaugeEntries = Object.entries(metrics.data?.metrics ?? {});
  const states = Object.entries(metrics.data?.states ?? {});
  const unitOf = (name?: string) => name?.match(/\(([^)]+)\)$/)?.[1];

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Device">
          <KV
            cols={1}
            items={[
              ["Device profile", profile ? <Link to={`/device-profiles/${profile.id}`} className="text-brand hover:underline">{profile.name}</Link> : "…"],
              ["Region / MAC", profile ? `${profile.region} · ${enumLabel(profile.macVersion)}` : "…"],
              ["Class", <Badge>{(info.classEnabled ?? "CLASS_A").replace("_", " ")}</Badge>],
              ["Battery", <BatteryBar level={st?.batteryLevel} external={st?.externalPowerSource} />],
              ["Link margin", st?.margin !== undefined && info.lastSeenAt ? `${st.margin} dB` : "—"],
              ["Last seen", fmtDate(info.lastSeenAt)],
            ]}
          />
        </Card>
        <Card
          title="Latest uplink"
          subtitle={lastUp ? `${timeAgo(lastUp.time)} · fCnt ${lastUp.fCnt} · fPort ${lastUp.fPort} · DR${lastUp.dr}` : values ? "Last stored measurements · waiting for the next uplink" : "Live from the device event stream"}
          actions={<button className="btn-ghost btn-sm" onClick={() => onTab("events")}>All events →</button>}
          className="lg:col-span-2"
        >
          {!values ? (
            <Empty title="No uplink received yet" icon={<Radio className="h-5 w-5" />}>New uplinks appear here as they arrive.</Empty>
          ) : (
            <div className="space-y-4">
              {values && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(values).map(([k, v]) => {
                    const sm = sensorMeta(k, measurements[k]?.name);
                    return (
                      <div key={k} className="rounded-2xl border border-line/70 bg-raised/50 p-3.5 flex items-center gap-3">
                        <SensorChip gradient={sm.gradient} size="sm">{sm.icon}</SensorChip>
                        <div className="min-w-0">
                          <div className="text-xs text-muted truncate">{sm.label}</div>
                          <div className="text-xl font-bold tnum leading-tight">
                            {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}
                            {sm.unit && typeof v === "number" && <span className="text-xs text-muted font-medium ml-1">{sm.unit}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {lastUp && <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><span className="text-muted">Raw payload: </span><span className="mono break-all">{base64ToHex(lastUp.data) || "—"}</span></div>
                <div><span className="text-muted">Frequency: </span>{fmtFreq(lastUp.txInfo?.frequency)}</div>
                <div className="sm:col-span-2">
                  <span className="text-muted">Received by: </span>
                  {(lastUp.rxInfo ?? []).map((r) => (
                    <Link key={r.gatewayId} to={`/gateways/${r.gatewayId}`} className="inline-flex items-center gap-1 mr-2 text-xs rounded-md bg-raised border border-line px-1.5 py-0.5 hover:border-brand">
                      <span className="mono">{r.gatewayId}</span> <span className="text-muted">RSSI {r.rssi} · SNR {r.snr}</span>
                    </Link>
                  ))}
                </div>
              </div>}
            </div>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Metrics</h2>
        <TimeRangePicker value={range} onChange={setRange} />
      </div>

      {states.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {states.map(([k, s]) => (
            <div key={k} className="card px-4 py-2.5"><div className="text-xs text-muted">{s.name}</div><div className="font-semibold">{s.value}</div></div>
          ))}
        </div>
      )}

      {metrics.error ? <ErrorBox error={metrics.error} /> : (
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {metrics.isLoading && <Loading />}
          {gaugeEntries.map(([k, m]: [string, Metric]) => (
            <ChartCard key={k} icon={sensorMeta(k).icon} title={m.name || measurements[k]?.name || k} subtitle={m.kind === "COUNTER" ? "per period" : undefined}>
              <MetricChart metric={m} aggregation={w.aggregation} unit={unitOf(m.name)} kind={m.kind === "COUNTER" ? "bar" : "line"} seriesOffset={sensorMeta(k).series} />
            </ChartCard>
          ))}
          {!metrics.isLoading && gaugeEntries.length === 0 && (
            <Card className="lg:col-span-3"><Empty title="No measurements configured">Add measurements in the device profile to chart decoded payload values.</Empty></Card>
          )}
        </div>
      )}

      {link.error ? <ErrorBox error={link.error} /> : (
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <ChartCard title="Received"><MetricChart metric={link.data?.rxPackets} aggregation={w.aggregation} kind="bar" unit="frames" /></ChartCard>
          <ChartCard title="RSSI" subtitle="dBm, best gateway"><MetricChart metric={link.data?.gwRssi} aggregation={w.aggregation} kind="line" unit="dBm" seriesOffset={2} /></ChartCard>
          <ChartCard title="SNR" subtitle="dB, best gateway"><MetricChart metric={link.data?.gwSnr} aggregation={w.aggregation} kind="line" unit="dB" seriesOffset={4} /></ChartCard>
          <ChartCard title="Received / frequency"><MetricChart metric={link.data?.rxPacketsPerFreq} aggregation={w.aggregation} kind="bar" stacked labelFormat={(l) => fmtFreq(+l)} /></ChartCard>
          <ChartCard title="Received / DR"><MetricChart metric={link.data?.rxPacketsPerDr} aggregation={w.aggregation} kind="bar" stacked labelFormat={(l) => `DR${l}`} /></ChartCard>
          <ChartCard title="Errors"><MetricChart metric={link.data?.errors} aggregation={w.aggregation} kind="bar" stacked /></ChartCard>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Configuration
function DeviceConfig({ device }: { device: Device }) {
  const { tenantId } = useSession();
  const [d, setD] = useState<Device>({ tags: {}, variables: {}, joinEui: "", description: "", ...device });
  const profiles = useQuery({ queryKey: ["device-profiles", tenantId], queryFn: () => api.deviceProfiles.list(tenantId!, { limit: 500 }), enabled: !!tenantId });
  const save = useAction((x: Device) => api.devices.update(x), { success: "Device updated", invalidate: [["device", device.devEui], ["devices"]] });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(d); }}>
      <Card title="Device settings">
        <DeviceFields value={d} onChange={setD} profiles={profiles.data?.result ?? []} />
        <FormActions>
          <button className="btn-primary" disabled={save.isPending}>{save.isPending && <Spinner />} Save changes</button>
        </FormActions>
      </Card>
    </form>
  );
}

export function DeviceFields({ value: d, onChange, profiles, isNew }: { value: Device; onChange: (d: Device) => void; profiles: { id: string; name: string }[]; isNew?: boolean }) {
  const set = (p: Partial<Device>) => onChange({ ...d, ...p });
  return (
    <div className="grid gap-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name"><input className="input" required value={d.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Device EUI (EUI64)"><HexInput bytes={8} value={d.devEui} disabled={!isNew} generate={isNew} onChange={(devEui) => set({ devEui })} /></Field>
      </div>
      <Field label="Description"><textarea className="input h-16" value={d.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
      <Field label="Device profile" help="Defines how the device talks LoRaWAN and how its payload is decoded.">
        <Select value={d.deviceProfileId} onChange={(deviceProfileId) => set({ deviceProfileId })} options={[...(d.deviceProfileId ? [] : [{ value: "", label: "Select device profile…" }]), ...profiles.map((p) => ({ value: p.id, label: p.name }))]} />
      </Field>
      <Toggle checked={!d.isDisabled} onChange={(on) => set({ isDisabled: !on })} label="Device enabled" help="Disabled devices are ignored by the network." />
      <Field label="Tags" help="Labels such as floor or room, attached to every reading."><KeyValueEditor value={d.tags ?? {}} onChange={(tags) => set({ tags })} /></Field>
    </div>
  );
}

// ------------------------------------------------------------------ OTAA keys
function DeviceKeysTab({ devEui, profile }: { devEui: string; profile?: DeviceProfile }) {
  const q = useQuery({ queryKey: ["device", devEui, "keys"], queryFn: () => api.devices.getKeys(devEui), retry: false });
  const exists = !!q.data;
  const [k, setK] = useState<DeviceKeys>({ nwkKey: "", appKey: "" });
  useEffect(() => {
    if (q.data) setK({ ...q.data.deviceKeys, nwkKey: q.data.deviceKeys.nwkKey ?? "", appKey: q.data.deviceKeys.appKey ?? "" });
  }, [q.data]);
  const save = useAction((x: DeviceKeys) => (exists ? api.devices.updateKeys(devEui, x) : api.devices.createKeys(devEui, x)), { success: "Join key saved", invalidate: [["device", devEui, "keys"]] });
  const del = useAction(() => api.devices.deleteKeys(devEui), { success: "Join key deleted", invalidate: [["device", devEui, "keys"]], onSuccess: () => setK({ nwkKey: "", appKey: "" }) });
  const lw11 = profile?.macVersion === "LORAWAN_1_1_0";
  if (q.isLoading) return <Loading />;
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(k); }}>
      <Card title="Join key (OTAA)" subtitle="The device uses this key to join the network">
        <div className="grid gap-4">
          <Field label={lw11 ? "Network key (NwkKey)" : "Application key (AppKey)"}>
            <HexInput bytes={16} secret value={k.nwkKey} onChange={(nwkKey) => setK({ ...k, nwkKey })} />
          </Field>
          {lw11 && (
            <Field label="Application key (AppKey)"><HexInput bytes={16} secret value={k.appKey ?? ""} onChange={(appKey) => setK({ ...k, appKey })} /></Field>
          )}
        </div>
        <FormActions>
          {exists && <ConfirmButton className="btn-secondary text-bad mr-auto" title="Delete join key?" onConfirm={() => del.mutateAsync(undefined)}>Delete</ConfirmButton>}
          <button className="btn-primary" disabled={save.isPending || k.nwkKey.length !== 32}>{save.isPending && <Spinner />} {exists ? "Update key" : "Set key"}</button>
        </FormActions>
      </Card>
    </form>
  );
}
