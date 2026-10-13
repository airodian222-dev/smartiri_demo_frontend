import { useQuery } from "@tanstack/react-query";
import { Gauge, RadioTower, Settings, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { Gateway } from "@/api/types";
import { ChartCard, MetricChart } from "@/components/charts";
import { GatewayForm } from "@/components/GatewayForm";
import { PointsMap } from "@/components/GatewayMap";
import { SensorChip } from "@/components/sensors";
import { TimeRangePicker, useWindow, type RangeKey } from "@/components/TimeRange";
import { Card, ConfirmButton, ErrorBox, FormActions, KV, Loading, Spinner, StatusDot, Tabs } from "@/components/ui";
import { useTheme } from "@/context/theme";
import { fmtDate, fmtFreq, timeAgo } from "@/lib/format";
import { useAction } from "@/lib/hooks";

type Tab = "dashboard" | "config";

export default function GatewayDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [range, setRange] = useState<RangeKey>("24h");
  const w = useWindow(range);
  const q = useQuery({ queryKey: ["gateway", id], queryFn: () => api.gateways.get(id!) });
  const metrics = useQuery({ queryKey: ["gateway", id, "metrics", w], queryFn: () => api.gateways.metrics(id!, w) });
  const [g, setG] = useState<Gateway | null>(null);
  useEffect(() => {
    if (q.data) setG({ statsInterval: 30, tags: {}, ...q.data.gateway });
  }, [q.data]);

  const save = useAction((x: Gateway) => api.gateways.update(x), { success: "Gateway updated", invalidate: [["gateway", id], ["gateways"]] });
  const del = useAction(() => api.gateways.delete(id!), { success: "Gateway deleted", invalidate: [["gateways"]], onSuccess: () => nav("/gateways") });

  if (q.isLoading || !g) return q.error ? <ErrorBox error={q.error} /> : <Loading />;
  const data = q.data!;
  const state = !data.lastSeenAt ? "NEVER_SEEN" : Date.now() - new Date(data.lastSeenAt).getTime() < ((g.statsInterval || 30) * 2 + 60) * 1000 ? "ONLINE" : "OFFLINE";
  const m = metrics.data;
  const freqLabel = (l: string) => (/^\d+$/.test(l) ? fmtFreq(+l) : l);

  return (
    <div>
      <nav className="text-xs text-muted mb-3 flex items-center gap-1">
        <Link to="/gateways" className="hover:text-ink">Gateways</Link> <span className="opacity-60">/</span> <span className="text-ink2">{g.name}</span>
      </nav>
      <section className="card relative overflow-hidden p-5 sm:p-6 mb-6 animate-rise">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 opacity-20 blur-3xl" />
        <div className="relative flex flex-wrap items-start gap-5">
          <SensorChip gradient="from-cyan-500 to-indigo-500" size="lg"><RadioTower /></SensorChip>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{g.name}</h1>
              <StatusDot state={state} />
            </div>
            <div className="text-sm text-muted mt-1 flex flex-wrap gap-x-3">
              <span className="mono">{g.gatewayId}</span>
              <span>{data.gateway.metadata?.region_config_id ?? "region n/a"}</span>
            </div>
            {g.description && <p className="text-sm text-ink2 mt-2">{g.description}</p>}
          </div>
          <ConfirmButton className="btn-secondary text-bad" onConfirm={() => del.mutateAsync(undefined)} title="Delete gateway?"><Trash2 className="h-4 w-4" /> Delete</ConfirmButton>
        </div>
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            ["Last seen", data.lastSeenAt ? timeAgo(data.lastSeenAt) : "Never"],
            [`Uplinks (${range})`, (m?.rxPackets?.datasets?.[0]?.data ?? []).reduce((a, b) => a + b, 0).toLocaleString()],
            [`Downlinks (${range})`, (m?.txPackets?.datasets?.[0]?.data ?? []).reduce((a, b) => a + b, 0).toLocaleString()],
            ["Location", g.location?.latitude ? `${g.location.latitude.toFixed(4)}, ${g.location.longitude?.toFixed(4)}` : "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-raised/60 border border-line/60 px-3.5 py-2.5">
              <div className="text-[10.5px] uppercase tracking-wider text-muted">{k}</div>
              <div className="text-sm font-semibold mt-1 truncate tnum">{v}</div>
            </div>
          ))}
        </div>
      </section>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "dashboard", label: "Dashboard", icon: <Gauge className="h-4 w-4" /> },
          { key: "config", label: "Settings", icon: <Settings className="h-4 w-4" /> },
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
              <ChartCard title="Transmitted"><MetricChart metric={m?.txPackets} aggregation={w.aggregation} kind="bar" unit="frames" seriesOffset={1} /></ChartCard>
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

    </div>
  );
}
