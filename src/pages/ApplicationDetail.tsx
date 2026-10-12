import { useQuery } from "@tanstack/react-query";
import { Cable, Cpu, Plus, Radio, Settings, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { Application } from "@/api/types";
import { DataTable } from "@/components/DataTable";
import { deviceColumns } from "@/components/DeviceTable";
import { Integrations } from "@/components/Integrations";
import { Badge, Card, ConfirmButton, ErrorBox, Field, FormActions, KeyValueEditor, Loading, PageHeader, Spinner, Tabs } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { useAction } from "@/lib/hooks";

type Tab = "devices" | "multicast" | "integrations" | "config";

export default function ApplicationDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("devices");
  const q = useQuery({ queryKey: ["application", id], queryFn: () => api.applications.get(id!) });
  const devs = useQuery({ queryKey: ["devices", "app", id], queryFn: () => api.devices.list(id!, { limit: 1000 }) });
  const mcs = useQuery({ queryKey: ["multicast-groups", id], queryFn: () => api.multicastGroups.list(id!, { limit: 500 }), enabled: tab === "multicast" });
  const [app, setApp] = useState<Application | null>(null);
  useEffect(() => {
    if (q.data) setApp({ tags: {}, description: "", ...q.data.application });
  }, [q.data]);
  const save = useAction((a: Application) => api.applications.update(a), { success: "Application updated", invalidate: [["application", id], ["applications"]] });
  const del = useAction(() => api.applications.delete(id!), { success: "Application deleted", invalidate: [["applications"], ["devices"]], onSuccess: () => nav("/applications") });

  if (q.error) return <ErrorBox error={q.error} />;
  if (!app) return <Loading />;

  return (
    <div>
      <PageHeader
        title={app.name}
        breadcrumbs={[{ label: "Applications", to: "/applications" }, { label: app.name }]}
        subtitle={app.description}
        actions={
          <>
            <Link to={`/applications/${id}/devices/new`} className="btn-primary"><Plus className="h-4 w-4" /> Add device</Link>
            <ConfirmButton className="btn-secondary text-bad" onConfirm={() => del.mutateAsync(undefined)} title="Delete application?" message="All devices and multicast groups of this application are deleted."><Trash2 className="h-4 w-4" /></ConfirmButton>
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "devices", label: `Devices${devs.data ? ` (${devs.data.totalCount ?? devs.data.result.length})` : ""}`, icon: <Cpu className="h-4 w-4" /> },
          { key: "multicast", label: "Multicast groups", icon: <Radio className="h-4 w-4" /> },
          { key: "integrations", label: "Integrations", icon: <Cable className="h-4 w-4" /> },
          { key: "config", label: "Configuration", icon: <Settings className="h-4 w-4" /> },
        ]}
      />
      {tab === "devices" && (
        <DataTable
          rows={devs.data?.result}
          loading={devs.isLoading}
          error={devs.error}
          rowKey={(d) => d.devEui}
          rowLink={(d) => `/devices/${d.devEui}`}
          searchable
          searchText={(d) => `${d.name} ${d.devEui}`}
          emptyTitle="No devices yet"
          emptyAction={<Link to={`/applications/${id}/devices/new`} className="btn-primary"><Plus className="h-4 w-4" /> Add device</Link>}
          columns={deviceColumns()}
        />
      )}
      {tab === "multicast" && (
        <DataTable
          rows={mcs.data?.result}
          loading={mcs.isLoading}
          error={mcs.error}
          rowKey={(m) => m.id}
          rowLink={(m) => `/multicast-groups/${m.id}`}
          emptyTitle="No multicast groups"
          emptyHint="Multicast groups send one downlink to many Class-B/C devices, e.g. for firmware updates."
          toolbar={<Link to={`/applications/${id}/multicast-groups/new`} className="btn-primary btn-sm"><Plus className="h-3.5 w-3.5" /> Add multicast group</Link>}
          columns={[
            { key: "name", header: "Name", render: (m) => <span className="font-medium">{m.name}</span> },
            { key: "type", header: "Group type", render: (m) => <Badge>{(m.groupType ?? "CLASS_C").replace("_", "-")}</Badge> },
            { key: "region", header: "Region", render: (m) => <Badge tone="brand">{m.region ?? "EU868"}</Badge> },
            { key: "c", header: "Created", render: (m) => <span className="text-muted">{fmtDate(m.createdAt)}</span> },
          ]}
        />
      )}
      {tab === "integrations" && <Integrations applicationId={id!} />}
      {tab === "config" && (
        <form className="max-w-3xl" onSubmit={(e) => { e.preventDefault(); save.mutate(app); }}>
          <Card>
            <div className="grid gap-4">
              <Field label="Application ID"><input className="input mono" disabled value={app.id} /></Field>
              <Field label="Name"><input className="input" required value={app.name} onChange={(e) => setApp({ ...app, name: e.target.value })} /></Field>
              <Field label="Description"><textarea className="input h-20" value={app.description} onChange={(e) => setApp({ ...app, description: e.target.value })} /></Field>
              <Field label="Tags" help="Added to every event of devices in this application."><KeyValueEditor value={app.tags ?? {}} onChange={(tags) => setApp({ ...app, tags })} /></Field>
              {q.data?.measurementKeys?.length ? (
                <Field label="Measurement keys"><div className="flex flex-wrap gap-1">{q.data.measurementKeys.map((k) => <Badge key={k}>{k}</Badge>)}</div></Field>
              ) : null}
            </div>
            <FormActions>
              <button className="btn-primary" disabled={save.isPending}>{save.isPending && <Spinner />} Save changes</button>
            </FormActions>
          </Card>
        </form>
      )}
    </div>
  );
}
