import { useQueries, useQuery } from "@tanstack/react-query";
import { Building2, Cpu, Gauge, RadioTower, Users } from "lucide-react";
import * as api from "@/api/chirpstack";
import { devicesSummary, gatewaysSummary } from "@/api/internal";
import { SimpleBars, StatTile, StatusMeter } from "@/components/charts";
import { DataTable } from "@/components/DataTable";
import { gatewayPoints, PointsMap } from "@/components/GatewayMap";
import { Badge, Card, ErrorBox, PageHeader } from "@/components/ui";
import { useSession } from "@/context/session";
import { useTheme } from "@/context/theme";

export default function NetworkDashboard() {
  const { tenants, setTenantId } = useSession();
  const { colors } = useTheme();
  const devSum = useQuery({ queryKey: ["summary", "devices", "all"], queryFn: () => devicesSummary(), retry: false });
  const gwSum = useQuery({ queryKey: ["summary", "gateways", "all"], queryFn: () => gatewaysSummary(), retry: false });
  const users = useQuery({ queryKey: ["users"], queryFn: () => api.users.list({ limit: 1 }) });
  const gws = useQueries({ queries: tenants.map((t) => ({ queryKey: ["gateways", t.id], queryFn: () => api.gateways.list(t.id, { limit: 500 }) })) });
  const perTenant = useQueries({ queries: tenants.map((t) => ({ queryKey: ["summary", "devices", t.id], queryFn: () => devicesSummary(t.id), retry: false })) });
  const allGws = gws.flatMap((q) => q.data?.result ?? []);
  const ds = devSum.data;
  const gs = gwSum.data;
  const drData = Object.entries(ds?.drCount ?? {}).map(([k, v]) => ({ label: `DR${k}`, value: v })).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div>
      <PageHeader title="Network server" icon={<Gauge className="h-5 w-5" />} subtitle="Global view across all tenants" />
      {(devSum.error || gwSum.error) ? (
        <div className="mb-4">
          <ErrorBox title="Summaries unavailable" error={devSum.error ?? gwSum.error} />
        </div>
      ) : null}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <StatTile label="Tenants" value={tenants.length} icon={<Building2 className="h-5 w-5" />} />
        <StatTile label="Users" value={users.data?.totalCount ?? "…"} icon={<Users className="h-5 w-5" />} />
        <StatTile label="Devices" value={ds ? ds.activeCount + ds.inactiveCount + ds.neverSeenCount : "…"} sub={ds && `${ds.activeCount} active`} icon={<Cpu className="h-5 w-5" />} />
        <StatTile label="Gateways" value={gs ? gs.onlineCount + gs.offlineCount + gs.neverSeenCount : allGws.length} sub={gs && `${gs.onlineCount} online`} icon={<RadioTower className="h-5 w-5" />} tone="good" />
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Devices">
          <StatusMeter segments={[
            { label: "Active", value: ds?.activeCount ?? 0, color: colors.good },
            { label: "Inactive", value: ds?.inactiveCount ?? 0, color: colors.bad },
            { label: "Never seen", value: ds?.neverSeenCount ?? 0, color: colors.axis },
          ]} />
        </Card>
        <Card title="Gateways">
          <StatusMeter segments={[
            { label: "Online", value: gs?.onlineCount ?? 0, color: colors.good },
            { label: "Offline", value: gs?.offlineCount ?? 0, color: colors.bad },
            { label: "Never seen", value: gs?.neverSeenCount ?? 0, color: colors.axis },
          ]} />
        </Card>
        <Card title="Data-rate usage" bodyClass="px-2 pb-2">
          <SimpleBars data={drData} height={120} />
        </Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="All gateways" bodyClass="p-2 pt-0">
          <PointsMap points={gatewayPoints(allGws, colors)} height={340} />
        </Card>
        <div>
          <DataTable
            rows={tenants}
            rowKey={(t) => t.id}
            rowLink={(t) => {
              setTenantId(t.id);
              return "/";
            }}
            columns={[
              { key: "name", header: "Tenant", render: (t) => <span className="font-medium">{t.name}</span> },
              { key: "gw", header: "Gateways", render: (t) => gws[tenants.indexOf(t)]?.data?.totalCount ?? "…" },
              {
                key: "dev",
                header: "Devices",
                render: (t) => {
                  const s = perTenant[tenants.indexOf(t)]?.data;
                  return s ? `${s.activeCount + s.inactiveCount + s.neverSeenCount} (${s.activeCount} active)` : "…";
                },
              },
              { key: "gwok", header: "Can have gateways", render: (t) => (t.canHaveGateways ? <Badge tone="good">Yes</Badge> : <Badge>No</Badge>) },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
