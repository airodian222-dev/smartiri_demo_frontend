import { useQuery } from "@tanstack/react-query";
import { Activity, BatteryMedium, Cpu, Moon, Plus, Settings, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { Application } from "@/api/types";
import { DeviceCard } from "@/components/DeviceCard";
import { Badge, Card, ConfirmButton, Empty, ErrorBox, Field, FormActions, KeyValueEditor, Loading, PageHeader, Spinner, Tabs } from "@/components/ui";
import { KpiCard } from "@/components/charts";
import { deviceState } from "@/components/DeviceTable";
import { useAction } from "@/lib/hooks";

type Tab = "devices" | "config";

export default function ApplicationDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("devices");
  const q = useQuery({ queryKey: ["application", id], queryFn: () => api.applications.get(id!) });
  const devs = useQuery({ queryKey: ["devices", "app", id], queryFn: () => api.devices.list(id!, { limit: 1000 }) });
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
            <ConfirmButton className="btn-secondary text-bad" onConfirm={() => del.mutateAsync(undefined)} title="Delete application?" message="All devices of this application are deleted."><Trash2 className="h-4 w-4" /></ConfirmButton>
          </>
        }
      />
      {devs.data && (() => {
        const list = devs.data.result ?? [];
        const by = (l: string) => list.filter((d) => deviceState(d.lastSeenAt).label === l).length;
        const bat = list.map((d) => d.deviceStatus).filter((st) => st && !st.externalPowerSource && (st.batteryLevel ?? -1) >= 0).map((st) => st!.batteryLevel!);
        const avg = bat.length ? bat.reduce((a, b) => a + b, 0) / bat.length : 0;
        return (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <KpiCard label="Devices" value={list.length} icon={<Cpu />} tone="brand" />
            <KpiCard label="Active (24 h)" value={by("Active")} unit={`/ ${list.length}`} icon={<Activity />} tone="green" progress={list.length ? by("Active") / list.length : 0} />
            <KpiCard label="Inactive / never seen" value={by("Inactive") + by("Never seen")} icon={<Moon />} tone="pink" />
            <KpiCard label="Battery average" value={avg ? avg.toFixed(0) : "—"} unit={avg ? "%" : undefined} icon={<BatteryMedium />} tone="cyan" progress={avg / 100} sub={bat.length ? `${bat.length} battery devices` : "Mains powered"} />
          </div>
        );
      })()}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "devices", label: `Devices${devs.data ? ` (${devs.data.totalCount ?? devs.data.result.length})` : ""}`, icon: <Cpu className="h-4 w-4" /> },
          { key: "config", label: "Settings", icon: <Settings className="h-4 w-4" /> },
        ]}
      />
      {tab === "devices" &&
        (devs.isLoading ? (
          <Loading />
        ) : devs.error ? (
          <ErrorBox error={devs.error} />
        ) : !devs.data?.result.length ? (
          <Card>
            <Empty title="No devices yet" icon={<Cpu className="h-5 w-5" />} action={<Link to={`/applications/${id}/devices/new`} className="btn-primary"><Plus className="h-4 w-4" /> Add device</Link>} />
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {devs.data.result.map((d) => (
              <DeviceCard key={d.devEui} d={{ ...d, applicationId: id!, applicationName: app.name }} />
            ))}
          </div>
        ))}
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
