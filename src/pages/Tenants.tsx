import { useQuery } from "@tanstack/react-query";
import { Building2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { Tenant } from "@/api/types";
import { DataTable } from "@/components/DataTable";
import { Badge, Card, ConfirmButton, ErrorBox, Field, FormActions, KeyValueEditor, Loading, PageHeader, Spinner, Toggle } from "@/components/ui";
import { useSession } from "@/context/session";
import { fmtDate } from "@/lib/format";
import { useAction } from "@/lib/hooks";

export default function Tenants() {
  const q = useQuery({ queryKey: ["tenants", "list"], queryFn: () => api.tenants.list({ limit: 500 }) });
  return (
    <div>
      <PageHeader
        title="Tenants"
        icon={<Building2 className="h-5 w-5" />}
        subtitle="Organisations sharing this network server"
        actions={<Link to="/tenants/new" className="btn-primary"><Plus className="h-4 w-4" /> Add tenant</Link>}
      />
      <DataTable
        rows={q.data?.result}
        loading={q.isLoading}
        error={q.error}
        rowKey={(t) => t.id}
        rowLink={(t) => `/tenants/${t.id}`}
        searchable
        searchText={(t) => t.name}
        columns={[
          { key: "name", header: "Name", render: (t) => <span className="font-medium">{t.name}</span>, sort: (t) => t.name },
          { key: "gw", header: "Can have gateways", render: (t) => (t.canHaveGateways ? <Badge tone="good">Yes</Badge> : <Badge>No</Badge>) },
          { key: "pgu", header: "Private gateways", render: (t) => [t.privateGatewaysUp && "uplink", t.privateGatewaysDown && "downlink"].filter(Boolean).join(" + ") || "—" },
          { key: "maxgw", header: "Max gateways", render: (t) => t.maxGatewayCount || "∞" },
          { key: "maxdev", header: "Max devices", render: (t) => t.maxDeviceCount || "∞" },
          { key: "created", header: "Created", render: (t) => <span className="text-muted">{fmtDate(t.createdAt)}</span>, sort: (t) => t.createdAt ?? "" },
        ]}
      />
    </div>
  );
}

const emptyTenant: Tenant = { name: "", description: "", canHaveGateways: true, maxGatewayCount: 0, maxDeviceCount: 0, privateGatewaysUp: false, privateGatewaysDown: false, tags: {} };

export function TenantDetail() {
  const { id } = useParams();
  const isNew = id === "new";
  const nav = useNavigate();
  const { setTenantId } = useSession();
  const q = useQuery({ queryKey: ["tenant", id], queryFn: () => api.tenants.get(id!), enabled: !isNew });
  const [t, setT] = useState<Tenant>(emptyTenant);
  useEffect(() => {
    if (q.data) setT({ ...emptyTenant, ...q.data.tenant });
  }, [q.data]);

  const save = useAction((x: Tenant) => (isNew ? api.tenants.create(x) : api.tenants.update(x).then(() => ({ id: x.id! }))), {
    success: isNew ? "Tenant created" : "Tenant updated",
    invalidate: [["tenants"], ["tenant", id]],
    onSuccess: (r) => isNew && nav(`/tenants/${(r as { id: string }).id}`),
  });
  const del = useAction(() => api.tenants.delete(id!), { success: "Tenant deleted", invalidate: [["tenants"]], onSuccess: () => nav("/tenants") });

  if (!isNew && q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={isNew ? "Add tenant" : t.name}
        breadcrumbs={[{ label: "Tenants", to: "/tenants" }, { label: isNew ? "New" : t.name }]}
        subtitle={!isNew && <span className="mono text-xs">{id}</span>}
        actions={
          !isNew && (
            <>
              <button className="btn-secondary" onClick={() => { setTenantId(id!); nav("/"); }}>Open tenant dashboard</button>
              <ConfirmButton className="btn-secondary text-bad" onConfirm={() => del.mutateAsync(undefined)} title="Delete tenant?" message="All applications, devices, gateways and device profiles of this tenant are deleted.">
                <Trash2 className="h-4 w-4" /> Delete
              </ConfirmButton>
            </>
          )
        }
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(t);
        }}
      >
        <Card>
          <div className="grid gap-4">
            <Field label="Name"><input className="input" required value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></Field>
            <Field label="Description"><textarea className="input h-20" value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Max. gateway count" help="0 = unlimited"><input type="number" min={0} className="input" value={t.maxGatewayCount ?? 0} onChange={(e) => setT({ ...t, maxGatewayCount: +e.target.value })} /></Field>
              <Field label="Max. device count" help="0 = unlimited"><input type="number" min={0} className="input" value={t.maxDeviceCount ?? 0} onChange={(e) => setT({ ...t, maxDeviceCount: +e.target.value })} /></Field>
            </div>
            <Toggle checked={!!t.canHaveGateways} onChange={(v) => setT({ ...t, canHaveGateways: v })} label="Tenant can have gateways" help="When enabled, tenant (gateway) admins can add gateways." />
            <Toggle checked={!!t.privateGatewaysUp} onChange={(v) => setT({ ...t, privateGatewaysUp: v })} label="Gateways are private (uplink)" help="Uplinks received by gateways of this tenant can only be used by devices of this tenant." />
            <Toggle checked={!!t.privateGatewaysDown} onChange={(v) => setT({ ...t, privateGatewaysDown: v })} label="Gateways are private (downlink)" help="Other tenants cannot use these gateways for downlinks." />
            <Field label="Tags"><KeyValueEditor value={t.tags ?? {}} onChange={(tags) => setT({ ...t, tags })} /></Field>
          </div>
          <FormActions>
            {!isNew && <span className="text-xs text-muted mr-auto self-center">Updated {fmtDate(q.data?.updatedAt)}</span>}
            <button className="btn-primary" disabled={save.isPending}>{save.isPending && <Spinner />} {isNew ? "Create tenant" : "Save changes"}</button>
          </FormActions>
        </Card>
      </form>
    </div>
  );
}
