import { useQuery } from "@tanstack/react-query";
import { List, Map, Plus, RadioTower } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { Gateway } from "@/api/types";
import { DataTable } from "@/components/DataTable";
import { GatewayForm } from "@/components/GatewayForm";
import { gatewayPoints, PointsMap } from "@/components/GatewayMap";
import { Card, FormActions, PageHeader, Spinner, StatusDot } from "@/components/ui";
import { useSession } from "@/context/session";
import { useTheme } from "@/context/theme";
import { timeAgo } from "@/lib/format";
import { useAction } from "@/lib/hooks";

export default function Gateways() {
  const { tenantId } = useSession();
  const { colors } = useTheme();
  const [view, setView] = useState<"list" | "map">("list");
  const q = useQuery({ queryKey: ["gateways", tenantId], queryFn: () => api.gateways.list(tenantId!, { limit: 500 }), enabled: !!tenantId });
  return (
    <div>
      <PageHeader
        title="Gateways"
        icon={<RadioTower className="h-5 w-5" />}
        subtitle="LoRaWAN gateways forwarding traffic for this tenant"
        actions={
          <>
            <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
              <button className={view === "list" ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setView("list")}><List className="h-3.5 w-3.5" /> List</button>
              <button className={view === "map" ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setView("map")}><Map className="h-3.5 w-3.5" /> Map</button>
            </div>
            <Link to="/gateways/new" className="btn-primary"><Plus className="h-4 w-4" /> Add gateway</Link>
          </>
        }
      />
      {view === "map" ? (
        <Card bodyClass="p-2">
          <PointsMap points={gatewayPoints(q.data?.result ?? [], colors)} height="70vh" />
        </Card>
      ) : (
        <DataTable
          rows={q.data?.result}
          loading={q.isLoading}
          error={q.error}
          rowKey={(g) => g.gatewayId}
          rowLink={(g) => `/gateways/${g.gatewayId}`}
          searchable
          searchText={(g) => `${g.name} ${g.gatewayId}`}
          emptyTitle="No gateways"
          emptyHint="Add a gateway so devices of this tenant can be heard."
          columns={[
            { key: "state", header: "Status", render: (g) => <StatusDot state={g.state} />, sort: (g) => g.state ?? "" },
            { key: "name", header: "Name", render: (g) => <span className="font-medium">{g.name}</span>, sort: (g) => g.name },
            { key: "id", header: "Gateway ID", render: (g) => <span className="mono">{g.gatewayId}</span> },
            { key: "region", header: "Region", render: (g) => <span className="mono text-xs">{g.properties?.region_config_id ?? "—"}</span> },
            { key: "loc", header: "Location", render: (g) => (g.location?.latitude ? <span className="mono text-xs text-muted">{g.location.latitude.toFixed(4)}, {g.location.longitude?.toFixed(4)}</span> : "—") },
            { key: "seen", header: "Last seen", render: (g) => timeAgo(g.lastSeenAt), sort: (g) => g.lastSeenAt ?? "" },
          ]}
        />
      )}
    </div>
  );
}

export function GatewayCreate() {
  const { tenantId } = useSession();
  const nav = useNavigate();
  const [g, setG] = useState<Gateway>({ gatewayId: "", name: "", description: "", tenantId: tenantId ?? "", statsInterval: 30, tags: {}, location: {} });
  const save = useAction((x: Gateway) => api.gateways.create({ ...x, tenantId: tenantId! }), {
    success: "Gateway created",
    invalidate: [["gateways"]],
    onSuccess: (_, x) => nav(`/gateways/${x.gatewayId}`),
  });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add gateway" breadcrumbs={[{ label: "Gateways", to: "/gateways" }, { label: "New" }]} />
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(g); }}>
        <Card>
          <GatewayForm value={g} onChange={setG} isNew />
          <FormActions>
            <button className="btn-primary" disabled={save.isPending || g.gatewayId.length !== 16}>{save.isPending && <Spinner />} Create gateway</button>
          </FormActions>
        </Card>
      </form>
    </div>
  );
}
