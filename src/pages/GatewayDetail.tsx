import { useQuery } from "@tanstack/react-query";
import { Activity, FileKey, Gauge, Settings, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { Gateway, GatewayCertificate } from "@/api/types";
import { ChartCard, MetricChart } from "@/components/charts";
import { GatewayForm } from "@/components/GatewayForm";
import { PointsMap } from "@/components/GatewayMap";
import { LogStream } from "@/components/LogStream";
import { TimeRangePicker, useWindow, type RangeKey } from "@/components/TimeRange";
import { Card, ConfirmButton, CopyButton, ErrorBox, FormActions, KV, Loading, PageHeader, Spinner, StatusDot, Tabs } from "@/components/ui";
import { useTheme } from "@/context/theme";
import { fmtDate, fmtFreq, timeAgo } from "@/lib/format";
import { useAction } from "@/lib/hooks";

type Tab = "dashboard" | "config" | "cert" | "frames";

export default function GatewayDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [range, setRange] = useState<RangeKey>("24h");
  const w = useWindow(range);
  const q = useQuery({ queryKey: ["gateway", id], queryFn: () => api.gateways.get(id!) });
  const metrics = useQuery({ queryKey: ["gateway", id, "metrics", w], queryFn: () => api.gateways.metrics(id!, w), enabled: tab === "dashboard" });
  const [g, setG] = useState<Gateway | null>(null);
  const [cert, setCert] = useState<GatewayCertificate | null>(null);
  useEffect(() => {
    if (q.data) setG({ statsInterval: 30, tags: {}, ...q.data.gateway });
  }, [q.data]);

  const save = useAction((x: Gateway) => api.gateways.update(x), { success: "Gateway updated", invalidate: [["gateway", id], ["gateways"]] });
  const del = useAction(() => api.gateways.delete(id!), { success: "Gateway deleted", invalidate: [["gateways"]], onSuccess: () => nav("/gateways") });
  const gen = useAction(() => api.gateways.generateCertificate(id!), { success: "Certificate generated", onSuccess: setCert });

  if (q.isLoading || !g) return q.error ? <ErrorBox error={q.error} /> : <Loading />;
  const data = q.data!;
  const state = !data.lastSeenAt ? "NEVER_SEEN" : Date.now() - new Date(data.lastSeenAt).getTime() < ((g.statsInterval || 30) * 2 + 60) * 1000 ? "ONLINE" : "OFFLINE";
  const m = metrics.data;
  const freqLabel = (l: string) => (/^\d+$/.test(l) ? fmtFreq(+l) : l);

  return (
    <div>
      <PageHeader
        title={g.name}
        breadcrumbs={[{ label: "Gateways", to: "/gateways" }, { label: g.name }]}
        subtitle={<span className="flex items-center gap-2"><span className="mono text-xs">{g.gatewayId}</span><StatusDot state={state} />{data.lastSeenAt && <span className="text-xs">last seen {timeAgo(data.lastSeenAt)}</span>}</span>}
        actions={<ConfirmButton className="btn-secondary text-bad" onConfirm={() => del.mutateAsync(undefined)} title="Delete gateway?"><Trash2 className="h-4 w-4" /> Delete</ConfirmButton>}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "dashboard", label: "Dashboard", icon: <Gauge className="h-4 w-4" /> },
          { key: "config", label: "Configuration", icon: <Settings className="h-4 w-4" /> },
          { key: "cert", label: "TLS certificate", icon: <FileKey className="h-4 w-4" /> },
          { key: "frames", label: "LoRaWAN frames", icon: <Activity className="h-4 w-4" /> },
        ]}
      />

      {tab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <Card title="Details" className="lg:col-span-1">
              <KV
                cols={1}
                items={[
                  ["Gateway ID", <span className="mono">{g.gatewayId}</span>],
                  ["Description", g.description || "—"],
                  ["Region", data.gateway.metadata?.region_config_id ?? "—"],
                  ["Location", g.location?.latitude ? `${g.location.latitude.toFixed(5)}, ${g.location.longitude?.toFixed(5)} (${g.location.altitude ?? 0} m, ${g.location.source ?? "CONFIG"})` : "—"],
                  ["Created", fmtDate(data.createdAt)],
                  ["Last seen", fmtDate(data.lastSeenAt)],
                ]}
              />
            </Card>
            <Card title="Location" className="lg:col-span-2" bodyClass="p-2 pt-0">
              {g.location?.latitude ? (
                <PointsMap points={[{ id: g.gatewayId, lat: g.location.latitude, lng: g.location.longitude ?? 0, label: g.name, color: state === "ONLINE" ? colors.good : state === "OFFLINE" ? colors.bad : colors.axis }]} height={260} />
              ) : (
                <div className="text-sm text-muted p-4">No location configured.</div>
              )}
            </Card>
          </div>
          <div className="flex justify-end"><TimeRangePicker value={range} onChange={setRange} /></div>
          {metrics.error ? <ErrorBox error={metrics.error} /> : metrics.isLoading ? <Loading /> : (
            <div className="grid lg:grid-cols-2 gap-4">
              <ChartCard title="Received"><MetricChart metric={m?.rxPackets} aggregation={w.aggregation} kind="bar" unit="frames" /></ChartCard>
              <ChartCard title="Transmitted"><MetricChart metric={m?.txPackets} aggregation={w.aggregation} kind="bar" unit="frames" /></ChartCard>
              <ChartCard title="Received / frequency"><MetricChart metric={m?.rxPacketsPerFreq} aggregation={w.aggregation} kind="bar" stacked labelFormat={freqLabel} /></ChartCard>
              <ChartCard title="Transmitted / frequency"><MetricChart metric={m?.txPacketsPerFreq} aggregation={w.aggregation} kind="bar" stacked labelFormat={freqLabel} /></ChartCard>
              <ChartCard title="Received / DR"><MetricChart metric={m?.rxPacketsPerDr} aggregation={w.aggregation} kind="bar" stacked labelFormat={(l) => `DR${l}`} /></ChartCard>
              <ChartCard title="Transmitted / DR"><MetricChart metric={m?.txPacketsPerDr} aggregation={w.aggregation} kind="bar" stacked labelFormat={(l) => `DR${l}`} /></ChartCard>
              <ChartCard title="TX packets / status" className="lg:col-span-2"><MetricChart metric={m?.txPacketsPerStatus} aggregation={w.aggregation} kind="bar" stacked /></ChartCard>
            </div>
          )}
        </div>
      )}

      {tab === "config" && (
        <form className="max-w-3xl" onSubmit={(e) => { e.preventDefault(); save.mutate(g); }}>
          <Card>
            <GatewayForm value={g} onChange={setG} />
            <FormActions>
              <button className="btn-primary" disabled={save.isPending}>{save.isPending && <Spinner />} Save changes</button>
            </FormActions>
          </Card>
        </form>
      )}

      {tab === "cert" && (
        <Card title="Gateway client certificate" subtitle="Used by the ChirpStack MQTT Forwarder / Gateway Bridge to authenticate with mutual TLS." className="max-w-3xl">
          {!cert ? (
            <div className="space-y-3">
              <p className="text-sm text-ink2">Generating a certificate returns the CA certificate, client certificate and private key. The private key is only shown once.</p>
              <button className="btn-primary" disabled={gen.isPending} onClick={() => gen.mutate(undefined)}>{gen.isPending && <Spinner />} Generate certificate</button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm">Expires: <b>{fmtDate(cert.expiresAt)}</b></p>
              {([["CA certificate", cert.caCert], ["TLS certificate", cert.tlsCert], ["TLS key", cert.tlsKey]] as const).map(([l, v]) => (
                <div key={l}>
                  <div className="flex items-center justify-between"><span className="label">{l}</span><CopyButton text={v} /></div>
                  <textarea readOnly className="input mono text-xs h-32" value={v} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "frames" && <LogStream kind="gatewayFrames" id={g.gatewayId} />}
    </div>
  );
}
