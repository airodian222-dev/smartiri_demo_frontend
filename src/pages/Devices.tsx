import { useQuery } from "@tanstack/react-query";
import { Cpu, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "@/api/chirpstack";
import { DataTable } from "@/components/DataTable";
import { deviceColumns, deviceState } from "@/components/DeviceTable";
import { Modal, PageHeader, Select } from "@/components/ui";
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
  const rows = (q.data ?? []).filter((d) => (!appFilter || d.applicationId === appFilter) && (!stateFilter || deviceState(d.lastSeenAt).label === stateFilter));

  return (
    <div>
      <PageHeader
        title="Devices"
        icon={<Cpu className="h-5 w-5" />}
        subtitle="All end-devices across this tenant's applications"
        actions={<button className="btn-primary" onClick={() => { setNewApp(apps.data?.result[0]?.id ?? ""); setPick(true); }}><Plus className="h-4 w-4" /> Add device</button>}
      />
      <DataTable<TenantDevice>
        rows={q.data ? rows : undefined}
        loading={q.isLoading}
        error={q.error}
        rowKey={(d) => d.devEui}
        rowLink={(d) => `/devices/${d.devEui}`}
        searchable
        searchText={(d) => `${d.name} ${d.devEui} ${d.applicationName} ${d.deviceProfileName}`}
        pageSize={20}
        toolbar={
          <>
            <Select className="py-1.5 w-auto" value={appFilter} onChange={setAppFilter} options={[{ value: "", label: "All applications" }, ...(apps.data?.result ?? []).map((a) => ({ value: a.id, label: a.name }))]} />
            <Select className="py-1.5 w-auto" value={stateFilter} onChange={setStateFilter} options={[{ value: "", label: "Any status" }, "Active", "Inactive", "Never seen"]} />
          </>
        }
        columns={deviceColumns<TenantDevice>([
          { key: "app", header: "Application", render: (d) => <Link to={`/applications/${d.applicationId}`} className="text-ink2 hover:text-brand hover:underline">{d.applicationName}</Link>, sort: (d) => d.applicationName },
        ])}
      />
      <Modal open={pick} onClose={() => setPick(false)} title="Add device" footer={<><button className="btn-secondary" onClick={() => setPick(false)}>Cancel</button><button className="btn-primary" disabled={!newApp} onClick={() => nav(`/applications/${newApp}/devices/new`)}>Continue</button></>}>
        <p className="text-sm text-ink2 mb-3">Devices belong to an application. Choose where to add it:</p>
        <Select value={newApp} onChange={setNewApp} options={(apps.data?.result ?? []).map((a) => ({ value: a.id, label: a.name }))} />
      </Modal>
    </div>
  );
}
