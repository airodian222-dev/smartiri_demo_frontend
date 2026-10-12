import { useQuery } from "@tanstack/react-query";
import { Boxes, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { DeviceProfileTemplate } from "@/api/types";
import { DataTable } from "@/components/DataTable";
import { DEFAULT_PROFILE, DeviceProfileForm } from "@/components/DeviceProfileForm";
import { Badge, Card, ConfirmButton, ErrorBox, FormActions, Loading, PageHeader, Spinner } from "@/components/ui";
import { enumLabel } from "@/lib/format";
import { useAction } from "@/lib/hooks";

export default function DeviceProfileTemplates() {
  const q = useQuery({ queryKey: ["device-profile-templates"], queryFn: () => api.deviceProfileTemplates.list({ limit: 500 }) });
  return (
    <div>
      <PageHeader title="Device-profile templates" icon={<Boxes className="h-5 w-5" />} subtitle="Vendor device definitions that tenants can copy into device profiles" actions={<Link to="/device-profile-templates/new" className="btn-primary"><Plus className="h-4 w-4" /> Add template</Link>} />
      <DataTable
        rows={q.data?.result}
        loading={q.isLoading}
        error={q.error}
        rowKey={(t) => t.id}
        rowLink={(t) => `/device-profile-templates/${t.id}`}
        searchable
        searchText={(t) => `${t.vendor} ${t.name}`}
        columns={[
          { key: "vendor", header: "Vendor", render: (t) => t.vendor, sort: (t) => t.vendor ?? "" },
          { key: "name", header: "Name", render: (t) => <span className="font-medium">{t.name}</span>, sort: (t) => t.name },
          { key: "fw", header: "Firmware", render: (t) => <span className="mono text-xs">{t.firmware}</span> },
          { key: "region", header: "Region", render: (t) => <Badge tone="brand">{t.region ?? "EU868"}</Badge> },
          { key: "mac", header: "MAC version", render: (t) => enumLabel(t.macVersion ?? "LORAWAN_1_0_0") },
          { key: "cap", header: "Capabilities", render: (t) => <div className="flex gap-1"><Badge tone={t.supportsOtaa ? "good" : "neutral"}>{t.supportsOtaa ? "OTAA" : "ABP"}</Badge>{t.supportsClassB && <Badge>B</Badge>}{t.supportsClassC && <Badge>C</Badge>}</div> },
        ]}
      />
    </div>
  );
}

export function DeviceProfileTemplateDetail() {
  const { id } = useParams();
  const isNew = id === "new";
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["device-profile-template", id], queryFn: () => api.deviceProfileTemplates.get(id!), enabled: !isNew });
  const [t, setT] = useState<DeviceProfileTemplate>({ ...DEFAULT_PROFILE, id: "__new", vendor: "", firmware: "" } as DeviceProfileTemplate);
  useEffect(() => {
    if (q.data) setT({ ...DEFAULT_PROFILE, ...q.data.deviceProfileTemplate } as DeviceProfileTemplate);
  }, [q.data]);
  const save = useAction((x: DeviceProfileTemplate) => (isNew ? api.deviceProfileTemplates.create(x) : api.deviceProfileTemplates.update(x)), {
    success: isNew ? "Template created" : "Template updated",
    invalidate: [["device-profile-templates"], ["device-profile-template", id]],
    onSuccess: (_, x) => isNew && nav(`/device-profile-templates/${x.id}`),
  });
  const del = useAction(() => api.deviceProfileTemplates.delete(id!), { success: "Template deleted", invalidate: [["device-profile-templates"]], onSuccess: () => nav("/device-profile-templates") });
  if (!isNew && q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={isNew ? "Add device-profile template" : t.name}
        breadcrumbs={[{ label: "Device-profile templates", to: "/device-profile-templates" }, { label: isNew ? "New" : t.name }]}
        subtitle={!isNew && `${t.vendor} · firmware ${t.firmware}`}
        actions={!isNew && <ConfirmButton className="btn-secondary text-bad" onConfirm={() => del.mutateAsync(undefined)} title="Delete template?"><Trash2 className="h-4 w-4" /> Delete</ConfirmButton>}
      />
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(t); }}>
        <Card>
          <DeviceProfileForm value={t} onChange={setT} template />
          <FormActions>
            <button className="btn-primary" disabled={save.isPending}>{save.isPending && <Spinner />} {isNew ? "Create template" : "Save changes"}</button>
          </FormActions>
        </Card>
      </form>
    </div>
  );
}
