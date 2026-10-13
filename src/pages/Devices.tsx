import { useQuery } from "@tanstack/react-query";
import { Cpu, LayoutGrid, List, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "@/api/chirpstack";
import { DataTable } from "@/components/DataTable";
import { DeviceCard } from "@/components/DeviceCard";
import { deviceColumns, deviceState } from "@/components/DeviceTable";
import { Empty, Loading, Modal, PageHeader, Select } from "@/components/ui";
import { useSession } from "@/context/session";
import { useTenantDevices, type TenantDevice } from "@/lib/hooks";

export default function Devices() {
  const { tenantId } = useSession();
  const nav = useNavigate();
  const q = useTenantDevices(tenantId);
  const apps = useQuery({ queryKey: ["applications", tenantId], queryFn: () => api.applications.list(tenantId!, { limit: 500 }), enabled: !!tenantId });
  const [appFilter, setAppFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [pick, setPick] = useState(false);
  const [newApp, setNewApp] = useState("");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");
  const rows = (q.data ?? []).filter(
    (d) =>
      (!appFilter || d.applicationId === appFilter) &&
      (!stateFilter || deviceState(d.lastSeenAt).label === stateFilter) &&
      (!search || `${d.name} ${d.devEui} ${d.applicationName}`.toLowerCase().includes(search.toLowerCase())),
  );
  const counts = { all: q.data?.length ?? 0, Active: 0, Inactive: 0, "Never seen": 0 } as Record<string, number>;
  (q.data ?? []).forEach((d) => counts[deviceState(d.lastSeenAt).label]++);
  const filters = (
    <>
      <Select className="py-1.5 w-auto" value={appFilter} onChange={setAppFilter} options={[{ value: "", label: "All applications" }, ...(apps.data?.result ?? []).map((a) => ({ value: a.id, label: a.name }))]} />
      <div className="inline-flex rounded-xl border border-line bg-surface/60 p-0.5">
        <button className={view === "grid" ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setView("grid")}><LayoutGrid className="h-3.5 w-3.5" /></button>
        <button className={view === "table" ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setView("table")}><List className="h-3.5 w-3.5" /></button>
      </div>
    </>
  );

  return (
    <div>
      <PageHeader
        title="Devices"
        icon={<Cpu className="h-5 w-5" />}
        subtitle={`${counts.all} end-devices across this workspace's applications`}
        actions={<button className="btn-primary" onClick={() => { setNewApp(apps.data?.result[0]?.id ?? ""); setPick(true); }}><Plus className="h-4 w-4" /> Add device</button>}
      />
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(["", "Active", "Inactive", "Never seen"] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStateFilter(s)}
            className={`rounded-xl px-3.5 py-1.5 text-sm border transition ${stateFilter === s ? "gradient-brand text-white border-transparent shadow-glow" : "border-line bg-surface/60 text-ink2 hover:text-ink"}`}
          >
            {s || "All"} <span className="ml-1 opacity-70 tnum">{s ? counts[s] : counts.all}</span>
          </button>
        ))}
        <div className="flex-1" />
        {view === "grid" && (
          <div className="relative">
            <Search className="h-4 w-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input className="input pl-9 py-1.5 w-56" placeholder="Filter devices…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}
        {filters}
      </div>
      {view === "grid" ? (
        q.isLoading ? <Loading /> : rows.length === 0 ? <Empty title="No devices match" /> : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {rows.map((d) => <DeviceCard key={d.devEui} d={d} />)}
          </div>
        )
      ) : (
      <DataTable<TenantDevice>
        rows={q.data ? rows : undefined}
        loading={q.isLoading}
        error={q.error}
        rowKey={(d) => d.devEui}
        rowLink={(d) => `/devices/${d.devEui}`}
        searchable
        searchText={(d) => `${d.name} ${d.devEui} ${d.applicationName} ${d.deviceProfileName}`}
        pageSize={20}

        columns={deviceColumns<TenantDevice>([
          { key: "app", header: "Application", render: (d) => <Link to={`/applications/${d.applicationId}`} className="text-ink2 hover:text-brand hover:underline">{d.applicationName}</Link>, sort: (d) => d.applicationName },
        ])}
      />
      )}
      <Modal open={pick} onClose={() => setPick(false)} title="Add device" footer={<><button className="btn-secondary" onClick={() => setPick(false)}>Cancel</button><button className="btn-primary" disabled={!newApp} onClick={() => nav(`/applications/${newApp}/devices/new`)}>Continue</button></>}>
        <p className="text-sm text-ink2 mb-3">Devices belong to an application. Choose where to add it:</p>
        <Select value={newApp} onChange={setNewApp} options={(apps.data?.result ?? []).map((a) => ({ value: a.id, label: a.name }))} />
      </Modal>
    </div>
  );
}
