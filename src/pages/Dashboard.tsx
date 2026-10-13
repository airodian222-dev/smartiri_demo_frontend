import { useQueries, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Activity, ArrowDownToLine, ArrowUpFromLine, BatteryMedium, BatteryLow, Cpu, Plus, RadioTower, RadioReceiver, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import * as api from "@/api/chirpstack";
import { devicesSummary, gatewaysSummary } from "@/api/internal";
import type { Metric } from "@/api/types";
import { BarList, ChartCard, KpiCard, MetricChart, Ring, SimpleBars, Sparkline } from "@/components/charts";
import { FeedList } from "@/components/Feed";
import { gatewayPoints, PointsMap } from "@/components/GatewayMap";
import { SensorChip, sensorMeta } from "@/components/sensors";
import { TimeRangePicker, useWindow, type RangeKey } from "@/components/TimeRange";
import { Card, Empty, Loading } from "@/components/ui";
import { useSession } from "@/context/session";
import { useTheme } from "@/context/theme";
import { isDemo } from "@/lib/config";
import { batteryLabel, timeAgo } from "@/lib/format";
import { useFeed, useTenantDevices } from "@/lib/hooks";

function sumMetrics(ms: (Metric | undefined)[], label: string): Metric | undefined {
  const first = ms.find((m) => m?.timestamps?.length);
  if (!first) return undefined;
  const data = first.timestamps.map((_, i) => ms.reduce((a, m) => a + (m?.datasets?.[0]?.data?.[i] ?? 0), 0));
  return { name: label, timestamps: first.timestamps, datasets: [{ label, data }], kind: "ABSOLUTE" };
}

/** % change of the second half of a series vs. the first half. */
function halfDelta(data?: number[]): number | null {
  if (!data || data.length < 4) return null;
  const h = Math.floor(data.length / 2);
  const a = data.slice(0, h).reduce((x, y) => x + y, 0);
  const b = data.slice(h).reduce((x, y) => x + y, 0);
  return a ? ((b - a) / a) * 100 : null;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const SENSOR_ORDER = ["temperature", "humidity", "co2", "power", "energy", "voltage", "pm25", "pm10", "noise", "moisture", "soilTemp", "ec", "speed", "battery"];

export default function Dashboard() {
  const { tenantId, tenant } = useSession();
  const { colors } = useTheme();
  const [range, setRange] = useState<RangeKey>("24h");
  const w = useWindow(range);
  const day = useWindow("24h");

  const devSum = useQuery({ queryKey: ["summary", "devices", tenantId], queryFn: () => devicesSummary(tenantId!), enabled: !!tenantId, retry: false });
  const gwSum = useQuery({ queryKey: ["summary", "gateways", tenantId], queryFn: () => gatewaysSummary(tenantId!), enabled: !!tenantId, retry: false });
  const gws = useQuery({ queryKey: ["gateways", tenantId], queryFn: () => api.gateways.list(tenantId!, { limit: 500 }), enabled: !!tenantId });
  const devs = useTenantDevices(tenantId);
  const allFeed = useFeed(200);
  const feed = useMemo(() => allFeed.filter((e) => e.tenantId === tenantId), [allFeed, tenantId]);

  const gwList = gws.data?.result ?? [];
  const deviceList = devs.data ?? [];

  // ---------------- traffic (gateway metrics)
  const metricsQ = useQueries({
    queries: gwList.map((g) => ({ queryKey: ["gateway", g.gatewayId, "metrics", w], queryFn: () => api.gateways.metrics(g.gatewayId, w) })),
  });
  const rx = sumMetrics(metricsQ.map((q) => q.data?.rxPackets), "Uplinks");
  const tx = sumMetrics(metricsQ.map((q) => q.data?.txPackets), "Downlinks");
  const traffic: Metric | undefined = rx && tx ? { name: "traffic", timestamps: rx.timestamps, datasets: [rx.datasets[0], tx.datasets[0]], kind: "ABSOLUTE" } : rx;
  const rxData = rx?.datasets[0].data ?? [];
  const txData = tx?.datasets[0].data ?? [];
  const totalRx = rxData.reduce((a, b) => a + b, 0);
  const totalTx = txData.reduce((a, b) => a + b, 0);
  const gwRank = gwList
    .map((g, i) => ({ g, v: (metricsQ[i]?.data?.rxPackets?.datasets?.[0]?.data ?? []).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.v - a.v);

  // ---------------- sensor snapshot (device measurement metrics, aggregated)
  const sampled = deviceList.filter((d) => d.lastSeenAt).slice(0, 30);
  const devMetrics = useQueries({
    queries: sampled.map((d) => ({ queryKey: ["device", d.devEui, "metrics", day], queryFn: () => api.devices.metrics(d.devEui, day), staleTime: 60_000 })),
  });
  const sensors = useMemo(() => {
    const acc = new Map<string, { name?: string; kind?: string; series: number[][]; latest: number[] }>();
    devMetrics.forEach((q) => {
      for (const [k, m] of Object.entries(q.data?.metrics ?? {})) {
        if (k === "latitude" || k === "longitude") continue;
        const data = m.datasets?.[0]?.data ?? [];
        if (!data.some((x) => x)) continue;
        const e = acc.get(k) ?? { name: m.name, kind: m.kind, series: [], latest: [] };
        e.series.push(data);
        const last = [...data].reverse().find((x) => x !== 0);
        if (last !== undefined) e.latest.push(last);
        acc.set(k, e);
      }
    });
    return [...acc.entries()]
      .map(([key, e]) => {
        const counter = e.kind === "COUNTER";
        const len = Math.max(...e.series.map((s) => s.length));
        const trend = Array.from({ length: len }, (_, i) => {
          const vals = e.series.map((s) => s[i]).filter((x) => x);
          if (!vals.length) return 0;
          const sum = vals.reduce((a, b) => a + b, 0);
          return counter ? sum : sum / vals.length;
        });
        const value = counter ? trend.reduce((a, b) => a + b, 0) : e.latest.reduce((a, b) => a + b, 0) / Math.max(1, e.latest.length);
        const nz = trend.filter((x) => x);
        return { key, name: e.name, value, trend: nz, min: Math.min(...nz), max: Math.max(...nz), devices: e.series.length, counter };
      })
      .sort((a, b) => (SENSOR_ORDER.indexOf(a.key) + 99) % 99 - ((SENSOR_ORDER.indexOf(b.key) + 99) % 99))
      .slice(0, 8);
  }, [devMetrics]);

  // ---------------- health
  const derivedDev = useMemo(() => {
    let active = 0, inactive = 0, never = 0;
    for (const d of deviceList) {
      if (!d.lastSeenAt) never++;
      else if (Date.now() - new Date(d.lastSeenAt).getTime() < 86_400_000) active++;
      else inactive++;
    }
    return { activeCount: active, inactiveCount: inactive, neverSeenCount: never, drCount: {} as Record<string, number> };
  }, [deviceList]);
  const ds = devSum.data ?? derivedDev;
  const gs = gwSum.data ?? {
    onlineCount: gwList.filter((g) => g.state === "ONLINE").length,
    offlineCount: gwList.filter((g) => g.state === "OFFLINE").length,
    neverSeenCount: gwList.filter((g) => !g.state || g.state === "NEVER_SEEN").length,
  };
  const totalDevices = ds.activeCount + ds.inactiveCount + ds.neverSeenCount;
  const totalGws = gs.onlineCount + gs.offlineCount + gs.neverSeenCount;
  const devRatio = totalDevices ? ds.activeCount / totalDevices : 0;
  const gwRatio = totalGws ? gs.onlineCount / totalGws : 0;
  const margins = deviceList.filter((d) => d.lastSeenAt && d.deviceStatus?.margin !== undefined).map((d) => d.deviceStatus!.margin!);
  const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
  const linkRatio = Math.min(1, avgMargin / 15);
  const health = Math.round(devRatio * 50 + gwRatio * 30 + linkRatio * 20);
  const batteries = deviceList.filter((d) => d.deviceStatus && !d.deviceStatus.externalPowerSource && (d.deviceStatus.batteryLevel ?? -1) >= 0).map((d) => d.deviceStatus!.batteryLevel!);
  const avgBattery = batteries.length ? batteries.reduce((a, b) => a + b, 0) / batteries.length : 0;
  const lowBattery = batteries.filter((b) => b < 45).length;
  const drData = Object.entries(ds.drCount ?? {}).map(([k, v]) => ({ label: `DR${k}`, value: v })).sort((a, b) => a.label.localeCompare(b.label));

  // ---------------- live rate (demo feed): events per 15 s over the last 5 min
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const rate = useMemo(() => {
    const buckets = Array.from({ length: 20 }, () => 0);
    for (const e of feed) {
      const age = now - new Date(e.time).getTime();
      const i = 19 - Math.floor(age / 15_000);
      if (i >= 0 && i < 20) buckets[i]++;
    }
    return buckets;
  }, [feed, now]);
  const perMin = rate.slice(-4).reduce((a, b) => a + b, 0);
  const lastEvent = feed[0];

  // ---------------- per-application breakdown
  const byApp = useMemo(() => {
    const m = new Map<string, { name: string; total: number; active: number }>();
    for (const d of deviceList) {
      const e = m.get(d.applicationId) ?? { name: d.applicationName, total: 0, active: 0 };
      e.total++;
      if (d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 86_400_000) e.active++;
      m.set(d.applicationId, e);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [deviceList]);

  const attention = deviceList
    .map((d) => {
      const issues: { label: string; tone: "bad" | "warn" | "neutral"; icon: ReactNode }[] = [];
      const st = d.deviceStatus;
      if (!d.lastSeenAt) issues.push({ label: "Never seen", tone: "neutral", icon: <Cpu /> });
      else if (Date.now() - new Date(d.lastSeenAt).getTime() > 86_400_000) issues.push({ label: `Silent ${timeAgo(d.lastSeenAt)}`, tone: "bad", icon: <TriangleAlert /> });
      if (st && !st.externalPowerSource && st.batteryLevel !== undefined && st.batteryLevel >= 0 && st.batteryLevel < 45) issues.push({ label: `Battery ${batteryLabel(st.batteryLevel)}`, tone: "warn", icon: <BatteryLow /> });
      if (st?.margin !== undefined && st.margin < 6 && d.lastSeenAt) issues.push({ label: `Weak link ${st.margin} dB`, tone: "warn", icon: <RadioReceiver /> });
      return { d, issues };
    })
    .filter((x) => x.issues.length)
    .slice(0, 6);

  const trackerPoints = useMemo(() => {
    const latest = new Map<string, { lat: number; lng: number; name: string; time: string }>();
    for (const e of feed) {
      const o = (e.body as { object?: Record<string, number> }).object;
      if (o?.latitude && !latest.has(e.devEui)) latest.set(e.devEui, { lat: o.latitude, lng: o.longitude, name: e.deviceName, time: e.time });
    }
    return [...latest.entries()].map(([id, p]) => ({ id, lat: p.lat, lng: p.lng, label: p.name, sub: `Tracker · ${timeAgo(p.time)}`, link: `/devices/${id}`, color: colors.brand2, radius: 6 }));
  }, [feed, colors]);

  if (!tenantId) return <Loading />;
  const healthLabel = health >= 85 ? "Excellent" : health >= 70 ? "Good" : health >= 50 ? "Degraded" : "Critical";

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------ HERO */}
      <section className="relative overflow-hidden rounded-3xl gradient-brand text-white shadow-[0_30px_80px_-30px_rgba(99,102,241,0.8)] animate-rise">
        <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_10%,rgba(255,255,255,0.25),transparent_60%),radial-gradient(50%_70%_at_0%_100%,rgba(6,182,212,0.45),transparent_60%)]" />
        <svg className="absolute right-0 top-0 h-full w-2/3 opacity-[0.12]" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden>
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={i} cx="330" cy="40" r={20 + i * 26} fill="none" stroke="white" strokeWidth="1" />
          ))}
        </svg>
        <div className="relative grid lg:grid-cols-[1.25fr_1fr] gap-8 p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 animate-ping2" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                  </span>
                  LIVE {isDemo() ? `· ${perMin} events/min` : ""}
                </span>
                <span className="rounded-full glass px-3 py-1 text-xs">{range === "24h" ? "Last 24 hours" : `Range: ${range}`}</span>
              </div>
              <p className="mt-5 text-white/75 text-sm">{greeting()}, Admin</p>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1">{tenant?.name ?? "Overview"}</h1>
              <p className="mt-3 text-white/85 max-w-xl">
                <b>{ds.activeCount}</b> of {totalDevices} devices reporting · <b>{gs.onlineCount}</b> of {totalGws} gateways online
                {lastEvent && <> · last uplink from <b>{lastEvent.deviceName}</b> {timeAgo(lastEvent.time)}</>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/devices" className="btn bg-white text-indigo-700 hover:bg-white/90 shadow-lg"><Cpu className="h-4 w-4" /> Device fleet</Link>
              <Link to="/events" className="btn glass text-white hover:bg-white/20"><Activity className="h-4 w-4" /> Live stream</Link>
              <Link to="/applications" className="btn glass text-white hover:bg-white/20"><Plus className="h-4 w-4" /> Add device</Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 lg:justify-end">
            <Ring value={health / 100} size={168} stroke={14} from="#ffffff" to="#67e8f9" track="rgba(255,255,255,0.18)">
              <div>
                <div className="text-[44px] leading-none font-extrabold tnum">{health}</div>
                <div className="text-[11px] uppercase tracking-widest text-white/70 mt-1">Health</div>
                <div className="text-xs font-semibold mt-0.5 text-cyan-100">{healthLabel}</div>
              </div>
            </Ring>
            <div className="grid grid-cols-3 sm:grid-cols-1 gap-3 w-full sm:w-auto">
              {[
                { l: "Devices online", v: devRatio, t: `${ds.activeCount}/${totalDevices}` },
                { l: "Gateways online", v: gwRatio, t: `${gs.onlineCount}/${totalGws}` },
                { l: "Link quality", v: linkRatio, t: `${avgMargin.toFixed(0)} dB` },
              ].map((x) => (
                <div key={x.l} className="flex items-center gap-3 rounded-2xl glass px-3 py-2">
                  <Ring value={x.v} size={42} stroke={5} from="#ffffff" to="#a5f3fc" track="rgba(255,255,255,0.2)">
                    <span className="text-[10px] font-bold">{Math.round(x.v * 100)}</span>
                  </Ring>
                  <div className="min-w-0">
                    <div className="text-[11px] text-white/70 truncate">{x.l}</div>
                    <div className="text-sm font-bold tnum">{x.t}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {isDemo() && (
          <div className="relative flex items-end gap-1 h-10 px-6 sm:px-8 pb-4" title="Events per 15 seconds, last 5 minutes">
            {rate.map((v, i) => (
              <div key={i} className="flex-1 rounded-t-md bg-white/35" style={{ height: `${Math.max(8, (v / Math.max(1, ...rate)) * 100)}%`, opacity: 0.35 + (i / rate.length) * 0.65 }} />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------ KPIs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">Network pulse</h2>
        <TimeRangePicker value={range} onChange={setRange} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <KpiCard label="Uplinks received" value={totalRx.toLocaleString()} icon={<ArrowUpFromLine />} tone="brand" spark={rxData} delta={halfDelta(rxData)} sub="vs. first half of range" />
        <KpiCard label="Downlinks sent" value={totalTx.toLocaleString()} icon={<ArrowDownToLine />} tone="amber" spark={txData} delta={halfDelta(txData)} sub="vs. first half of range" />
        <KpiCard label="Active devices" value={ds.activeCount} unit={`/ ${totalDevices}`} icon={<Cpu />} tone="green" progress={devRatio} sub={`${ds.inactiveCount} inactive · ${ds.neverSeenCount} never seen`} />
        <KpiCard label="Fleet battery" value={avgBattery ? avgBattery.toFixed(0) : "—"} unit="% avg" icon={<BatteryMedium />} tone="cyan" progress={avgBattery / 100} sub={lowBattery ? `${lowBattery} device${lowBattery > 1 ? "s" : ""} below 45%` : "All batteries healthy"} />
      </div>

      {/* ------------------------------------------------ SENSOR SNAPSHOT */}
      <div>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand" /> Sensor snapshot</h2>
            <p className="text-xs text-muted">Latest decoded values across your fleet, with the 24-hour trend</p>
          </div>
          <Link to="/devices" className="btn-ghost btn-sm">All devices →</Link>
        </div>
        {devMetrics.some((q) => q.isLoading) && !sensors.length ? (
          <Card><Loading label="Collecting measurements…" /></Card>
        ) : !sensors.length ? (
          <Card><Empty title="No measurements yet">Configure measurements in a device profile to see live sensor values here.</Empty></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {sensors.map((s) => {
              const m = sensorMeta(s.key, s.name);
              return (
                <div key={s.key} className="card card-hover p-4 overflow-hidden relative animate-rise">
                  <div className="flex items-center gap-3">
                    <SensorChip gradient={m.gradient}>{m.icon}</SensorChip>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{m.label}</div>
                      <div className="text-[11px] text-muted">{s.counter ? "total, 24 h" : "fleet average"} · {s.devices} device{s.devices > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-[28px] font-bold tracking-tight tnum">{s.value.toLocaleString(undefined, { maximumFractionDigits: s.value < 100 ? 1 : 0 })}</span>
                    {m.unit && <span className="text-sm text-muted font-medium">{m.unit}</span>}
                  </div>
                  <Sparkline data={s.trend} color={colors.series[m.series]} height={46} className="-mx-1 mt-1" />
                  {!s.counter && Number.isFinite(s.min) && (
                    <div className="flex justify-between text-[11px] text-muted mt-1 tnum">
                      <span>min {s.min.toFixed(1)}</span>
                      <span>max {s.max.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------ TRAFFIC + GATEWAY LEADERBOARD */}
      <div className="grid xl:grid-cols-3 gap-5">
        <ChartCard className="xl:col-span-2" icon={<Activity />} title="Network traffic" subtitle="LoRaWAN frames through this workspace's gateways">
          {metricsQ.some((q) => q.isLoading) && !traffic ? <Loading /> : <MetricChart metric={traffic} aggregation={w.aggregation} kind="line" height={300} unit="frames" />}
        </ChartCard>
        <ChartCard icon={<RadioTower />} title="Top gateways" subtitle="Uplinks received in the selected range" actions={<Link to="/gateways" className="btn-ghost btn-sm">All →</Link>}>
          {gwRank.length === 0 ? (
            <Empty title="No gateways" />
          ) : (
            <BarList
              items={gwRank.slice(0, 6).map(({ g, v }) => ({
                key: g.gatewayId,
                value: v,
                label: (
                  <Link to={`/gateways/${g.gatewayId}`} className="flex items-center gap-2 hover:text-brand">
                    <span className={clsx("h-2 w-2 rounded-full shrink-0", g.state === "ONLINE" ? "bg-good shadow-[0_0_8px_rgb(var(--good))]" : g.state === "OFFLINE" ? "bg-bad" : "bg-muted")} />
                    <span className="truncate font-medium">{g.name}</span>
                  </Link>
                ),
              }))}
            />
          )}
        </ChartCard>
      </div>

      {/* ------------------------------------------------ MAP + LIVE FEED */}
      <div className="grid xl:grid-cols-2 gap-5">
        <Card title="Coverage map" subtitle={trackerPoints.length ? "Gateways and live tracker positions" : "Gateways by status"} bodyClass="p-2 pt-0">
          <PointsMap points={gatewayPoints(gwList, colors)} extra={trackerPoints} height={380} />
        </Card>
        <Card
          title={<span className="flex items-center gap-2">{isDemo() ? "Live activity" : "Recently active devices"} {isDemo() && <span className="h-2 w-2 rounded-full bg-good shadow-[0_0_10px_rgb(var(--good))] animate-pulse" />}</span>}
          subtitle={isDemo() ? "Uplinks, joins, downlinks and alerts as they happen" : "Open a device to stream its events live"}
          actions={<Link to="/events" className="btn-ghost btn-sm">Open stream →</Link>}
          bodyClass="px-1 pb-2"
        >
          {isDemo() ? (
            feed.length ? <div className="max-h-[380px] overflow-y-auto"><FeedList events={feed.slice(0, 25)} compact /></div> : <Loading label="Waiting for events…" />
          ) : (
            <ul className="px-3">
              {[...deviceList]
                .filter((d) => d.lastSeenAt)
                .sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""))
                .slice(0, 10)
                .map((d) => (
                  <li key={d.devEui} className="py-2.5 flex items-center justify-between text-sm border-b border-line/60 last:border-0">
                    <Link to={`/devices/${d.devEui}`} className="font-semibold hover:text-brand">{d.name}</Link>
                    <span className="text-muted text-xs">{d.applicationName} · {timeAgo(d.lastSeenAt)}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------ BREAKDOWNS */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Applications" subtitle="Devices per application (active in last 24 h)">
          {byApp.length ? (
            <BarList
              colorFrom="from-violet-500"
              colorTo="to-pink-500"
              items={byApp.map(([id, a]) => ({ key: id, value: a.total, hint: `${a.active} active`, label: <Link to={`/applications/${id}`} className="font-medium hover:text-brand">{a.name}</Link> }))}
            />
          ) : (
            <Empty title="No applications" />
          )}
        </Card>
        <Card title="Data-rate mix" subtitle="Last uplink data-rate per device · higher = faster, shorter airtime" bodyClass="px-3 pb-3">
          <SimpleBars data={drData} height={210} />
        </Card>
        <Card title="Needs attention" subtitle="Silent, low battery or weak radio link" bodyClass="px-3 pb-3">
          {devs.isLoading ? (
            <Loading />
          ) : attention.length === 0 ? (
            <Empty title="All devices healthy" icon={<Sparkles className="h-5 w-5" />} />
          ) : (
            <ul className="space-y-2">
              {attention.map(({ d, issues }) => (
                <li key={d.devEui}>
                  <Link to={`/devices/${d.devEui}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-raised/70 transition">
                    <span className={clsx("h-9 w-9 rounded-xl grid place-items-center shrink-0 [&>svg]:h-4 [&>svg]:w-4", issues[0].tone === "bad" ? "bg-bad/15 text-bad" : issues[0].tone === "warn" ? "bg-warn/15 text-warn" : "bg-raised text-muted")}>{issues[0].icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-semibold block truncate">{d.name}</span>
                      <span className="text-xs text-muted truncate block">{issues.map((i) => i.label).join(" · ")}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
