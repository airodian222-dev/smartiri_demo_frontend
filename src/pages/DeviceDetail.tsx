import { useQuery } from "@tanstack/react-query";
import { Activity, Gauge, KeyRound, ListOrdered, Power, Radio, Send, Settings, Trash2, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { Device, DeviceActivation, DeviceKeys, DeviceProfile, Metric } from "@/api/types";
import { ChartCard, MetricChart } from "@/components/charts";
import { BatteryBar, deviceState } from "@/components/DeviceTable";
import { LogStream } from "@/components/LogStream";
import { TimeRangePicker, useWindow, type RangeKey } from "@/components/TimeRange";
import { Badge, Card, ConfirmButton, Empty, ErrorBox, Field, FormActions, HexInput, KeyValueEditor, KV, Loading, PageHeader, Select, Spinner, Tabs, Toggle } from "@/components/ui";
import { useSession } from "@/context/session";
import { base64ToHex, enumLabel, fmtDate, fmtFreq, hexToBase64, timeAgo } from "@/lib/format";
import { useAction, useLogStream } from "@/lib/hooks";

type Tab = "dashboard" | "config" | "keys" | "activation" | "queue" | "events" | "frames";

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

  return (
    <div>
      <PageHeader
        title={d.device.name}
        breadcrumbs={[{ label: "Applications", to: "/applications" }, { label: app.data?.application.name ?? "…", to: appId ? `/applications/${appId}` : undefined }, { label: d.device.name }]}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="mono text-xs">{d.device.devEui}</span>
            <Badge tone={st.tone} dot>{st.label}</Badge>
            {d.device.isDisabled && <Badge tone="bad">Disabled</Badge>}
            {d.lastSeenAt && <span className="text-xs">last seen {timeAgo(d.lastSeenAt)}</span>}
          </span>
        }
        actions={<ConfirmButton className="btn-secondary text-bad" onConfirm={() => del.mutateAsync(undefined)} title="Delete device?" message="The device, its keys, activation and queue are deleted."><Trash2 className="h-4 w-4" /> Delete</ConfirmButton>}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "dashboard", label: "Dashboard", icon: <Gauge className="h-4 w-4" /> },
          { key: "config", label: "Configuration", icon: <Settings className="h-4 w-4" /> },
          ...(profile?.supportsOtaa !== false ? [{ key: "keys" as Tab, label: "OTAA keys", icon: <KeyRound className="h-4 w-4" /> }] : []),
          { key: "activation", label: "Activation", icon: <Power className="h-4 w-4" /> },
          { key: "queue", label: "Queue", icon: <ListOrdered className="h-4 w-4" /> },
          { key: "events", label: "Events", icon: <Zap className="h-4 w-4" /> },
          { key: "frames", label: "LoRaWAN frames", icon: <Activity className="h-4 w-4" /> },
        ]}
      />
      {tab === "dashboard" && <DeviceDashboard devEui={devEui!} profile={profile} info={d} onTab={setTab} />}
      {tab === "config" && <DeviceConfig device={d.device} />}
      {tab === "keys" && <DeviceKeysTab devEui={devEui!} profile={profile} />}
      {tab === "activation" && <ActivationTab devEui={devEui!} profile={profile} />}
      {tab === "queue" && <QueueTab devEui={devEui!} />}
      {tab === "events" && <LogStream kind="deviceEvents" id={devEui!} />}
      {tab === "frames" && <LogStream kind="deviceFrames" id={devEui!} />}
    </div>
  );
}

// ------------------------------------------------------------------ Dashboard
function DeviceDashboard({ devEui, profile, info, onTab }: { devEui: string; profile?: DeviceProfile; info: Awaited<ReturnType<typeof api.devices.get>>; onTab: (t: Tab) => void }) {
  const [range, setRange] = useState<RangeKey>("24h");
  const w = useWindow(range);
  const metrics = useQuery({ queryKey: ["device", devEui, "metrics", w], queryFn: () => api.devices.metrics(devEui, w) });
  const link = useQuery({ queryKey: ["device", devEui, "link-metrics", w], queryFn: () => api.devices.linkMetrics(devEui, w) });
  const events = useLogStream("deviceEvents", devEui, 50);
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
          subtitle={lastUp ? `${timeAgo(lastUp.time)} · fCnt ${lastUp.fCnt} · fPort ${lastUp.fPort} · DR${lastUp.dr}` : "Live from the device event stream"}
          actions={<button className="btn-ghost btn-sm" onClick={() => onTab("events")}>All events →</button>}
          className="lg:col-span-2"
        >
          {!lastUp ? (
            <Empty title="No uplink received yet" icon={<Radio className="h-5 w-5" />}>New uplinks appear here as they arrive.</Empty>
          ) : (
            <div className="space-y-4">
              {lastUp.object && Object.keys(lastUp.object).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(lastUp.object).map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-line bg-raised/50 px-3 py-2.5">
                      <div className="text-xs text-muted truncate">{measurements[k]?.name ?? k}</div>
                      <div className="text-xl font-semibold mt-0.5 tnum">{typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
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
              </div>
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
            <ChartCard key={k} title={m.name || measurements[k]?.name || k} subtitle={m.kind === "COUNTER" ? "per period" : undefined}>
              <MetricChart metric={m} aggregation={w.aggregation} unit={unitOf(m.name)} kind={m.kind === "COUNTER" ? "bar" : "line"} />
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
          <ChartCard title="RSSI" subtitle="dBm, best gateway"><MetricChart metric={link.data?.gwRssi} aggregation={w.aggregation} kind="line" unit="dBm" /></ChartCard>
          <ChartCard title="SNR" subtitle="dB, best gateway"><MetricChart metric={link.data?.gwSnr} aggregation={w.aggregation} kind="line" unit="dB" /></ChartCard>
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
    <form className="max-w-3xl" onSubmit={(e) => { e.preventDefault(); save.mutate(d); }}>
      <Card>
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
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Device profile">
          <Select value={d.deviceProfileId} onChange={(deviceProfileId) => set({ deviceProfileId })} options={[...(d.deviceProfileId ? [] : [{ value: "", label: "Select device profile…" }]), ...profiles.map((p) => ({ value: p.id, label: p.name }))]} />
        </Field>
        <Field label="Join EUI (EUI64)" help="Optional; also known as AppEUI. Set automatically on OTAA join.">
          <HexInput bytes={8} value={d.joinEui ?? ""} onChange={(joinEui) => set({ joinEui })} />
        </Field>
      </div>
      <Toggle checked={!!d.isDisabled} onChange={(isDisabled) => set({ isDisabled })} label="Device is disabled" help="ChirpStack ignores received uplinks and join-requests from disabled devices." />
      <Toggle checked={!!d.skipFcntCheck} onChange={(skipFcntCheck) => set({ skipFcntCheck })} label="Disable frame-counter validation" help="Weakens LoRaWAN security; only use for ABP devices that reset their counters." />
      <Field label="Tags" help="Added to every event published by this device."><KeyValueEditor value={d.tags ?? {}} onChange={(tags) => set({ tags })} /></Field>
      <Field label="Variables" help="Available in the payload codec (e.g. calibration values) and integrations."><KeyValueEditor keyLabel="Variable" value={d.variables ?? {}} onChange={(variables) => set({ variables })} /></Field>
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
  const save = useAction((x: DeviceKeys) => (exists ? api.devices.updateKeys(devEui, x) : api.devices.createKeys(devEui, x)), { success: "Keys saved", invalidate: [["device", devEui, "keys"]] });
  const del = useAction(() => api.devices.deleteKeys(devEui), { success: "Keys deleted", invalidate: [["device", devEui, "keys"]], onSuccess: () => setK({ nwkKey: "", appKey: "" }) });
  const flush = useAction(() => api.devices.flushDevNonces(devEui), { success: "OTAA device nonces flushed" });
  const lw11 = profile?.macVersion === "LORAWAN_1_1_0";
  if (q.isLoading) return <Loading />;
  return (
    <form className="max-w-2xl" onSubmit={(e) => { e.preventDefault(); save.mutate(k); }}>
      <Card title="OTAA keys" subtitle={lw11 ? "LoRaWAN 1.1: NwkKey and AppKey" : "LoRaWAN 1.0.x: only the Application key is used (stored as NwkKey)"}>
        <div className="grid gap-4">
          <Field label={lw11 ? "Network key (NwkKey)" : "Application key (AppKey)"}>
            <HexInput bytes={16} secret value={k.nwkKey} onChange={(nwkKey) => setK({ ...k, nwkKey })} />
          </Field>
          {lw11 && (
            <Field label="Application key (AppKey)"><HexInput bytes={16} secret value={k.appKey ?? ""} onChange={(appKey) => setK({ ...k, appKey })} /></Field>
          )}
        </div>
        <FormActions>
          {exists && (
            <>
              <ConfirmButton className="btn-secondary mr-auto" title="Flush OTAA device nonces?" confirmLabel="Flush" message="Allows the device to re-use previously used DevNonce values when joining." onConfirm={() => flush.mutateAsync(undefined)}>Flush dev-nonces</ConfirmButton>
              <ConfirmButton className="btn-secondary text-bad" title="Delete OTAA keys?" onConfirm={() => del.mutateAsync(undefined)}>Delete keys</ConfirmButton>
            </>
          )}
          <button className="btn-primary" disabled={save.isPending || k.nwkKey.length !== 32}>{save.isPending && <Spinner />} {exists ? "Update keys" : "Set keys"}</button>
        </FormActions>
      </Card>
    </form>
  );
}

// ------------------------------------------------------------------ Activation
function ActivationTab({ devEui, profile }: { devEui: string; profile?: DeviceProfile }) {
  const q = useQuery({ queryKey: ["activation", devEui], queryFn: () => api.devices.getActivation(devEui) });
  const current = q.data?.deviceActivation;
  const blank: DeviceActivation = { devAddr: "", appSKey: "", nwkSEncKey: "", sNwkSIntKey: "", fNwkSIntKey: "", fCntUp: 0, nFCntDown: 0, aFCntDown: 0 };
  const [a, setA] = useState<DeviceActivation>(blank);
  useEffect(() => {
    if (current) setA({ ...blank, ...current, devAddr: current.devAddr ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.devAddr]);
  const lw11 = profile?.macVersion === "LORAWAN_1_1_0";
  const activate = useAction((x: DeviceActivation) => api.devices.activate(devEui, lw11 ? x : { ...x, sNwkSIntKey: x.nwkSEncKey, fNwkSIntKey: x.nwkSEncKey }), { success: "Device (re)activated", invalidate: [["activation", devEui], ["device", devEui]] });
  const deactivate = useAction(() => api.devices.deactivate(devEui), { success: "Device deactivated", invalidate: [["activation", devEui]], onSuccess: () => setA(blank) });
  const readonly = !!profile?.supportsOtaa;
  const set = (p: Partial<DeviceActivation>) => setA({ ...a, ...p });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;

  return (
    <form className="max-w-3xl" onSubmit={(e) => { e.preventDefault(); activate.mutate(a); }}>
      <Card
        title={current ? "Current activation" : "Device has not been activated yet"}
        subtitle={readonly ? "OTAA device: the session is created by the join procedure. Shown read-only." : "ABP device: enter the session keys programmed into the device."}
      >
        {!current && readonly ? (
          <Empty title="Not activated" icon={<Power className="h-5 w-5" />}>The device will be activated once it completes an OTAA join.</Empty>
        ) : (
          <div className="grid gap-4">
            <Field label="Device address (DevAddr)">
              <HexInput bytes={4} value={a.devAddr} disabled={readonly} generate={!readonly} onChange={(devAddr) => set({ devAddr })} onGenerate={async () => (await api.devices.randomDevAddr(devEui)).devAddr} />
            </Field>
            {lw11 ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Network session encryption key (NwkSEncKey)"><HexInput bytes={16} secret disabled={readonly} value={a.nwkSEncKey} onChange={(nwkSEncKey) => set({ nwkSEncKey })} /></Field>
                <Field label="Serving network session integrity key (SNwkSIntKey)"><HexInput bytes={16} secret disabled={readonly} value={a.sNwkSIntKey} onChange={(sNwkSIntKey) => set({ sNwkSIntKey })} /></Field>
                <Field label="Forwarding network session integrity key (FNwkSIntKey)"><HexInput bytes={16} secret disabled={readonly} value={a.fNwkSIntKey} onChange={(fNwkSIntKey) => set({ fNwkSIntKey })} /></Field>
              </div>
            ) : (
              <Field label="Network session key (NwkSKey)"><HexInput bytes={16} secret disabled={readonly} value={a.nwkSEncKey} onChange={(nwkSEncKey) => set({ nwkSEncKey })} /></Field>
            )}
            <Field label="Application session key (AppSKey)"><HexInput bytes={16} secret disabled={readonly} value={a.appSKey} onChange={(appSKey) => set({ appSKey })} /></Field>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Uplink frame-counter"><input type="number" className="input" disabled={readonly} value={a.fCntUp ?? 0} onChange={(e) => set({ fCntUp: +e.target.value })} /></Field>
              <Field label={lw11 ? "Network downlink frame-counter" : "Downlink frame-counter"}><input type="number" className="input" disabled={readonly} value={a.nFCntDown ?? 0} onChange={(e) => set({ nFCntDown: +e.target.value })} /></Field>
              {lw11 && <Field label="Application downlink frame-counter"><input type="number" className="input" disabled={readonly} value={a.aFCntDown ?? 0} onChange={(e) => set({ aFCntDown: +e.target.value })} /></Field>}
            </div>
          </div>
        )}
        <FormActions>
          {current && <ConfirmButton className="btn-secondary text-bad mr-auto" title="Deactivate device?" confirmLabel="Deactivate" message="The device session is removed; an OTAA device must re-join." onConfirm={() => deactivate.mutateAsync(undefined)}>Deactivate</ConfirmButton>}
          {!readonly && <button className="btn-primary" disabled={activate.isPending || a.devAddr.length !== 8}>{activate.isPending && <Spinner />} (Re)activate device</button>}
        </FormActions>
      </Card>
    </form>
  );
}

// ------------------------------------------------------------------ Queue
function QueueTab({ devEui }: { devEui: string }) {
  const q = useQuery({ queryKey: ["queue", devEui], queryFn: () => api.devices.getQueue(devEui), refetchInterval: 4000 });
  const [fPort, setFPort] = useState(10);
  const [confirmed, setConfirmed] = useState(false);
  const [fmt, setFmt] = useState<"hex" | "base64" | "json">("hex");
  const [payload, setPayload] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const enqueue = useAction(
    async () => {
      let data: string | undefined;
      let object: Record<string, unknown> | undefined;
      if (fmt === "hex") {
        if (!/^([0-9a-fA-F]{2})*$/.test(payload)) throw new Error("Payload must be HEX with an even number of characters");
        data = hexToBase64(payload);
      } else if (fmt === "base64") data = payload;
      else object = JSON.parse(payload || "{}");
      return api.devices.enqueue(devEui, { fPort, confirmed, data, object });
    },
    { success: "Downlink enqueued", invalidate: [["queue", devEui]], onSuccess: () => setPayload("") },
  );
  const flush = useAction(() => api.devices.flushQueue(devEui), { success: "Queue flushed", invalidate: [["queue", devEui]] });

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <Card title="Enqueue downlink" subtitle="Class A: sent after the next uplink. Class B/C: scheduled right away." className="lg:col-span-2">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErr(null);
            if (fmt === "json") {
              try { JSON.parse(payload || "{}"); } catch { setErr("Invalid JSON"); return; }
            }
            enqueue.mutate(undefined);
          }}
        >
          <Field label="FPort"><input type="number" min={1} max={223} className="input" value={fPort} onChange={(e) => setFPort(+e.target.value)} /></Field>
          <Toggle checked={confirmed} onChange={setConfirmed} label="Confirmed downlink" help="The device must acknowledge reception." />
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="label mb-0">Payload</span>
              <div className="inline-flex rounded-lg border border-line p-0.5">
                {(["hex", "base64", "json"] as const).map((f) => (
                  <button type="button" key={f} className={fmt === f ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setFmt(f)}>{f.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <textarea className="input mono h-24" placeholder={fmt === "hex" ? "01ff" : fmt === "base64" ? "Af8=" : '{ "cmd": 1 }'} value={payload} onChange={(e) => setPayload(e.target.value.trim())} />
            <p className="text-xs text-muted mt-1">{fmt === "json" ? "Encoded by the device-profile codec (encodeDownlink)." : "Raw FRMPayload bytes."}</p>
          </div>
          {err && <div className="text-sm text-bad">{err}</div>}
          <button className="btn-primary" disabled={enqueue.isPending}>{enqueue.isPending ? <Spinner /> : <Send className="h-4 w-4" />} Enqueue</button>
        </form>
      </Card>
      <div className="lg:col-span-3">
        <Card
          title="Downlink queue"
          bodyClass="pb-1"
          actions={<ConfirmButton className="btn-secondary btn-sm" title="Flush queue?" confirmLabel="Flush" onConfirm={() => flush.mutateAsync(undefined)}>Flush queue</ConfirmButton>}
        >
          {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : !q.data?.result?.length ? (
            <Empty title="Queue is empty" icon={<ListOrdered className="h-5 w-5" />}>Enqueued downlinks appear here until they are sent{" "}(and acknowledged).</Empty>
          ) : (
            <table className="w-full">
              <thead><tr><th className="table-th">ID</th><th className="table-th">FPort</th><th className="table-th">Confirmed</th><th className="table-th">Payload (HEX)</th><th className="table-th">Status</th></tr></thead>
              <tbody>
                {q.data.result.map((i) => (
                  <tr key={i.id}>
                    <td className="table-td mono text-xs text-muted">{i.id?.slice(0, 8)}</td>
                    <td className="table-td">{i.fPort}</td>
                    <td className="table-td">{i.confirmed ? "Yes" : "No"}</td>
                    <td className="table-td mono text-xs break-all">{base64ToHex(i.data) || (i.object ? JSON.stringify(i.object) : "—")}</td>
                    <td className="table-td">{i.isPending ? <Badge tone="warn">Pending ack (fCnt {i.fCntDown})</Badge> : <Badge>Queued</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <p className="text-xs text-muted mt-2">Tip: open the <b>Events</b> tab to watch <span className="mono">txack</span> and <span className="mono">ack</span> events for your downlink.</p>
      </div>
    </div>
  );
}
