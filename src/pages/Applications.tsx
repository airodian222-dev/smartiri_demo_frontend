import { useQuery } from "@tanstack/react-query";
import { AppWindow, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { Application } from "@/api/types";
import { DataTable } from "@/components/DataTable";
import { Field, KeyValueEditor, Modal, PageHeader, Spinner } from "@/components/ui";
import { useSession } from "@/context/session";
import { fmtDate } from "@/lib/format";
import { useAction, useTenantDevices } from "@/lib/hooks";

export default function Applications() {
  const { tenantId } = useSession();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["applications", tenantId], queryFn: () => api.applications.list(tenantId!, { limit: 500 }), enabled: !!tenantId });
  const devs = useTenantDevices(tenantId);
  const [open, setOpen] = useState(false);
  const [app, setApp] = useState<Application>({ name: "", description: "", tenantId: "", tags: {} });
  const create = useAction((a: Application) => api.applications.create({ ...a, tenantId: tenantId! }), {
    success: "Application created",
    invalidate: [["applications"]],
    onSuccess: (r) => nav(`/applications/${r.id}`),
  });
  const count = (id: string) => devs.data?.filter((d) => d.applicationId === id).length;
  const active = (id: string) => devs.data?.filter((d) => d.applicationId === id && d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 86_400_000).length;

  return (
    <div>
      <PageHeader
        title="Applications"
        icon={<AppWindow className="h-5 w-5" />}
        subtitle="Group devices with the same purpose, and forward their data to integrations"
        actions={<button className="btn-primary" onClick={() => { setApp({ name: "", description: "", tenantId: tenantId!, tags: {} }); setOpen(true); }}><Plus className="h-4 w-4" /> Add application</button>}
      />
      <DataTable
        rows={q.data?.result}
        loading={q.isLoading}
        error={q.error}
        rowKey={(a) => a.id}
        rowLink={(a) => `/applications/${a.id}`}
        searchable
        searchText={(a) => a.name}
        columns={[
          { key: "name", header: "Name", render: (a) => <span className="font-medium">{a.name}</span>, sort: (a) => a.name },
          { key: "desc", header: "Description", render: (a) => <span className="text-ink2 line-clamp-1">{a.description || "—"}</span> },
          { key: "devs", header: "Devices", render: (a) => (count(a.id) === undefined ? "…" : `${count(a.id)} (${active(a.id)} active)`) },
          { key: "created", header: "Created", render: (a) => <span className="text-muted">{fmtDate(a.createdAt)}</span>, sort: (a) => a.createdAt ?? "" },
        ]}
      />
      <Modal open={open} onClose={() => setOpen(false)} title="Add application" footer={<><button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={!app.name || create.isPending} onClick={() => create.mutate(app)}>{create.isPending && <Spinner />} Create</button></>}>
        <div className="space-y-4">
          <Field label="Name"><input className="input" autoFocus value={app.name} onChange={(e) => setApp({ ...app, name: e.target.value })} /></Field>
          <Field label="Description"><textarea className="input h-20" value={app.description} onChange={(e) => setApp({ ...app, description: e.target.value })} /></Field>
          <Field label="Tags"><KeyValueEditor value={app.tags ?? {}} onChange={(tags) => setApp({ ...app, tags })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
