import { useQueries, useQuery } from "@tanstack/react-query";
import { Activity, AppWindow, BatteryLow, Cpu, RadioTower, SignalLow, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/api/chirpstack";
import { devicesSummary, gatewaysSummary } from "@/api/internal";
import type { Metric } from "@/api/types";
import { ChartCard, MetricChart, SimpleBars, StatTile, StatusMeter } from "@/components/charts";
import { FeedList } from "@/components/Feed";
import { gatewayPoints, PointsMap } from "@/components/GatewayMap";
import { TimeRangePicker, useWindow, type RangeKey } from "@/components/TimeRange";
import { Badge, Card, Empty, Loading, PageHeader } from "@/components/ui";
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

export default function Dashboard() {
  const { tenantId, tenant } = useSession();
  const { colors } = useTheme();
  const [range, setRange] = useState<RangeKey>("24h");
  const w = useWindow(range);

  const devSum = useQuery({ queryKey: ["summary", "devices", tenantId], queryFn: () => devicesSummary(tenantId!), enabled: !!tenantId, retry: false });
  const gwSum = useQuery({ queryKey: ["summary", "gateways", tenantId], queryFn: () => gatewaysSummary(tenantId!), enabled: !!tenantId, retry: false });
  const gws = useQuery({ queryKey: ["gateways", tenantId], queryFn: () => api.gateways.list(tenantId!, { limit: 500 }), enabled: !!tenantId });
  const apps = useQuery({ queryKey: ["applications", tenantId], queryFn: () => api.applications.list(tenantId!, { limit: 500 }), enabled: !!tenantId });
  const devs = useTenantDevices(tenantId);
  const allFeed = useFeed(120);
  const feed = useMemo(() => allFeed.filter((e) => e.tenantId === tenantId), [allFeed, tenantId]);

  const gwList = gws.data?.result ?? [];
  const metricsQ = useQueries({
    queries: gwList.map((g) => ({ queryKey: ["gateway", g.gatewayId, "metrics", w], queryFn: () => api.gateways.metrics(g.gatewayId, w) })),
  });
  const rx = sumMetrics(metricsQ.map((q) => q.data?.rxPackets), "Received");
  const tx = sumMetrics(metricsQ.map((q) => q.data?.txPackets), "Transmitted");
  const traffic: Metric | undefined = rx && tx ? { name: "traffic", timestamps: rx.timestamps, datasets: [rx.datasets[0], tx.datasets[0]], kind: "ABSOLUTE" } : rx;
  const totalRx = rx?.datasets[0].data.reduce((a, b) => a + b, 0) ?? 0;

  // Live mode fallback: derive summaries from lists when gRPC-web summaries are unavailable.
  const deviceList = devs.data ?? [];
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
  const drData = Object.entries(ds.drCount ?? {})
    .map(([k, v]) => ({ label: `DR${k}`, value: v }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const attention = deviceList
    .map((d) => {
      const issues: { label: string; tone: "bad" | "warn" | "neutral" }[] = [];
      const st = d.deviceStatus;
      if (!d.lastSeenAt) issues.push({ label: "Never seen", tone: "neutral" });
      else if (Date.now() - new Date(d.lastSeenAt).getTime() > 86_400_000) issues.push({ label: `Silent ${timeAgo(d.lastSeenAt)}`, tone: "bad" });
      if (st && !st.externalPowerSource && st.batteryLevel !== undefined && st.batteryLevel >= 0 && st.batteryLevel < 45) issues.push({ label: `Battery ${batteryLabel(st.batteryLevel)}`, tone: "warn" });
      if (st?.margin !== undefined && st.margin < 6 && d.lastSeenAt) issues.push({ label: `Margin ${st.margin} dB`, tone: "warn" });
      return { d, issues };
    })
    .filter((x) => x.issues.length)
    .slice(0, 8);

  const trackers = deviceList.filter((d) => d.tags?.sensor === "tracker");
  const trackerPoints = useMemo(() => {
    const latest = new Map<string, { lat: number; lng: number }>();
    for (const e of feed) {
      const o = (e.body as { object?: Record<string, number> }).object;
      if (o?.latitude && !latest.has(e.devEui)) latest.set(e.devEui, { lat: o.latitude, lng: o.longitude });
    }
    return trackers
      .filter((t) => latest.has(t.devEui))
      .map((t) => ({ id: t.devEui, ...latest.get(t.devEui)!, label: t.name, sub: `Tracker · ${timeAgo(t.lastSeenAt)}`, link: `/devices/${t.devEui}`, color: colors.series[1], radius: 5 }));
  }, [feed, trackers, colors]);

  if (!tenantId) return <Loading />;

  return (
    <div>
      <PageHeader
        title={tenant?.name ?? "Dashboard"}
        subtitle="Tenant overview — devices, gateways and live network activity"
        actions={<TimeRangePicker value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <StatTile label="Devices" value={totalDevices} sub={`${ds.activeCount} active · ${ds.inactiveCount} inactive`} icon={<Cpu className="h-5 w-5" />} />
        <StatTile label="Gateways" value={gwList.length} sub={`${gs.onlineCount} online · ${gs.offlineCount} offline`} icon={<RadioTower className="h-5 w-5" />} tone={gs.offlineCount ? "warn" : "good"} />
        <StatTile label="Applications" value={apps.data?.totalCount ?? apps.data?.result.length ?? "…"} sub="with integrations & multicast" icon={<AppWindow className="h-5 w-5" />} />
        <StatTile label={`Uplinks received (${range})`} value={totalRx.toLocaleString()} sub="sum across all gateways" icon={<Activity className="h-5 w-5" />} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Device status" subtitle="Active = seen within 2× uplink interval">
          <StatusMeter
            segments={[
              { label: "Active", value: ds.activeCount, color: colors.good },
              { label: "Inactive", value: ds.inactiveCount, color: colors.bad },
              { label: "Never seen", value: ds.neverSeenCount, color: colors.axis },
            ]}
          />
        </Card>
        <Card title="Gateway status" subtitle="Online = stats received within 2× stats interval">
          <StatusMeter
            segments={[
              { label: "Online", value: gs.onlineCount, color: colors.good },
              { label: "Offline", value: gs.offlineCount, color: colors.bad },
              { label: "Never seen", value: gs.neverSeenCount, color: colors.axis },
            ]}
          />
        </Card>
        <Card title="Device data-rate usage" subtitle="Last uplink DR per device" bodyClass="px-2 pb-2">
          <SimpleBars data={drData} height={120} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-5 gap-4 mb-4">
        <ChartCard className="lg:col-span-3" title="Network traffic" subtitle="LoRaWAN frames received / transmitted by this tenant's gateways">
          {metricsQ.some((q) => q.isLoading) && !traffic ? <Loading /> : <MetricChart metric={traffic} aggregation={w.aggregation} kind="bar" height={260} unit="frames" />}
        </ChartCard>
        <Card className="lg:col-span-2" title="Gateway map" subtitle={trackerPoints.length ? "Gateways (status colour) and live tracker positions" : "Gateways coloured by status"} bodyClass="p-2 pt-0">
          <PointsMap points={gatewayPoints(gwList, colors)} extra={trackerPoints} height={270} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Card
          className="lg:col-span-3"
          title={isDemo() ? "Live event feed" : "Recently active devices"}
          subtitle={isDemo() ? "Uplinks, joins, acks and status reports as they arrive" : "Open a device to stream its live events"}
          actions={isDemo() ? <Link to="/events" className="btn-ghost btn-sm">Open full feed →</Link> : undefined}
          bodyClass="pb-1"
        >
          {isDemo() ? (
            feed.length ? <div className="max-h-[360px] overflow-y-auto -mx-0"><FeedList events={feed.slice(0, 30)} /></div> : <Loading label="Waiting for events…" />
          ) : (
            <ul className="divide-y divide-line">
              {[...deviceList]
                .filter((d) => d.lastSeenAt)
                .sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""))
                .slice(0, 10)
                .map((d) => (
                  <li key={d.devEui} className="px-4 py-2 flex items-center justify-between text-sm">
                    <Link to={`/devices/${d.devEui}`} className="font-medium hover:underline">{d.name}</Link>
                    <span className="text-muted text-xs">{d.applicationName} · {timeAgo(d.lastSeenAt)}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-2" title="Needs attention" subtitle="Silent, low battery or weak link margin" bodyClass="pb-1">
          {devs.isLoading ? (
            <Loading />
          ) : attention.length === 0 ? (
            <Empty title="All devices healthy" />
          ) : (
            <ul className="divide-y divide-line">
              {attention.map(({ d, issues }) => (
                <li key={d.devEui} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-muted">
                    {issues.some((i) => i.label.startsWith("Battery")) ? <BatteryLow className="h-4 w-4" /> : issues.some((i) => i.label.startsWith("Margin")) ? <SignalLow className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link to={`/devices/${d.devEui}`} className="text-sm font-medium hover:underline block truncate">{d.name}</Link>
                    <span className="text-xs text-muted">{d.applicationName}</span>
                  </span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {issues.map((i) => (
                      <Badge key={i.label} tone={i.tone}>{i.label}</Badge>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
