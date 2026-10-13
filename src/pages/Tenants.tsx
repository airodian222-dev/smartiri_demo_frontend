import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, Cpu, Pencil, Plus, RadioTower, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { Tenant } from "@/api/types";
import { devicesSummary, gatewaysSummary } from "@/api/internal";
import { Ring } from "@/components/charts";
import { useTheme } from "@/context/theme";
import { Card, ConfirmButton, ErrorBox, Field, FormActions, Loading, PageHeader, Spinner, Toggle } from "@/components/ui";
import { useSession } from "@/context/session";
import { fmtDate } from "@/lib/format";
import { useAction } from "@/lib/hooks";

export default function Tenants() {
  const q = useQuery({ queryKey: ["tenants", "list"], queryFn: () => api.tenants.list({ limit: 500 }) });
  const list = q.data?.result ?? [];
  const devs = useQueries({ queries: list.map((t) => ({ queryKey: ["summary", "devices", t.id], queryFn: () => devicesSummary(t.id), retry: false })) });
  const gws = useQueries({ queries: list.map((t) => ({ queryKey: ["summary", "gateways", t.id], queryFn: () => gatewaysSummary(t.id), retry: false })) });
  const users = useQueries({ queries: list.map((t) => ({ queryKey: ["tenant-users", t.id], queryFn: () => api.tenants.listUsers(t.id, { limit: 1 }) })) });
  const { colors } = useTheme();
  const { setTenantId } = useSession();
  const nav = useNavigate();
  const grads = ["from-cyan-400 to-indigo-500", "from-pink-500 to-violet-500", "from-amber-400 to-rose-500", "from-emerald-400 to-teal-600"];
  return (
    <div>
      <PageHeader
        title="Workspaces"
        icon={<Building2 className="h-5 w-5" />}
        subtitle="Separate organisations or sites, each with their own devices, gateways and team"
        actions={<Link to="/tenants/new" className="btn-primary"><Plus className="h-4 w-4" /> New workspace</Link>}
      />
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {list.map((t, i) => {
            const d = devs[i]?.data;
            const g = gws[i]?.data;
            const total = d ? d.activeCount + d.inactiveCount + d.neverSeenCount : 0;
            const gTotal = g ? g.onlineCount + g.offlineCount + g.neverSeenCount : 0;
            const initials = t.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
            return (
              <div key={t.id} className="card card-hover p-5 relative overflow-hidden animate-rise">
                <div className={`absolute -right-14 -top-14 h-40 w-40 rounded-full bg-gradient-to-br ${grads[i % grads.length]} opacity-[0.16] blur-2xl`} />
                <div className="flex items-start gap-3 relative">
                  <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${grads[i % grads.length]} grid place-items-center text-white font-bold shadow-lg`}>{initials}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-lg leading-tight truncate">{t.name}</div>
                    <div className="text-xs text-muted mt-0.5">Created {fmtDate(t.createdAt)}</div>
                  </div>
                  <Link to={`/tenants/${t.id}`} className="btn-ghost btn-sm" title="Edit workspace"><Pencil className="h-3.5 w-3.5" /></Link>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-5 relative">
                  <div className="flex items-center gap-3">
                    <Ring value={total ? (d?.activeCount ?? 0) / total : 0} size={54} stroke={6} from={colors.good} to={colors.brand2} track={colors.line}>
                      <Cpu className="h-4 w-4 text-ink2" />
                    </Ring>
                    <div>
                      <div className="text-xl font-bold tnum">{d ? total : "—"}</div>
                      <div className="text-xs text-muted">devices · {d?.activeCount ?? 0} active</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Ring value={gTotal ? (g?.onlineCount ?? 0) / gTotal : 0} size={54} stroke={6} from={colors.brand} to={colors.brand2} track={colors.line}>
                      <RadioTower className="h-4 w-4 text-ink2" />
                    </Ring>
                    <div>
                      <div className="text-xl font-bold tnum">{g ? gTotal : "—"}</div>
                      <div className="text-xs text-muted">gateways · {g?.onlineCount ?? 0} online</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-line/70 relative">
                  <span className="text-xs text-muted flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {users[i]?.data?.totalCount ?? "…"} team members</span>
                  <button className="btn-primary btn-sm" onClick={() => { setTenantId(t.id); nav("/"); }}>Open <ArrowRight className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
    success: isNew ? "Workspace created" : "Workspace updated",
    invalidate: [["tenants"], ["tenant", id]],
    onSuccess: (r) => isNew && nav(`/tenants/${(r as { id: string }).id}`),
  });
  const del = useAction(() => api.tenants.delete(id!), { success: "Workspace deleted", invalidate: [["tenants"]], onSuccess: () => nav("/tenants") });

  if (!isNew && q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={isNew ? "New workspace" : t.name}
        breadcrumbs={[{ label: "Workspaces", to: "/tenants" }, { label: isNew ? "New" : t.name }]}
        subtitle={!isNew && <span className="mono text-xs">{id}</span>}
        actions={
          !isNew && (
            <>
              <button className="btn-secondary" onClick={() => { setTenantId(id!); nav("/"); }}>Open workspace</button>
              <ConfirmButton className="btn-secondary text-bad" onConfirm={() => del.mutateAsync(undefined)} title="Delete workspace?" message="All applications, devices, gateways and device profiles in this workspace are deleted.">
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
            <Toggle checked={!!t.canHaveGateways} onChange={(v) => setT({ ...t, canHaveGateways: v })} label="Workspace can have gateways" help="Allow this workspace to register its own gateways." />
          </div>
          <FormActions>
            {!isNew && <span className="text-xs text-muted mr-auto self-center">Updated {fmtDate(q.data?.updatedAt)}</span>}
            <button className="btn-primary" disabled={save.isPending}>{save.isPending && <Spinner />} {isNew ? "Create workspace" : "Save changes"}</button>
          </FormActions>
        </Card>
      </form>
    </div>
  );
}
