import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { Device } from "@/api/types";
import { Card, FormActions, PageHeader, Spinner } from "@/components/ui";
import { useSession } from "@/context/session";
import { useAction } from "@/lib/hooks";
import { DeviceFields } from "./DeviceDetail";

export default function DeviceCreate() {
  const { appId } = useParams();
  const { tenantId } = useSession();
  const nav = useNavigate();
  const app = useQuery({ queryKey: ["application", appId], queryFn: () => api.applications.get(appId!) });
  const profiles = useQuery({ queryKey: ["device-profiles", tenantId], queryFn: () => api.deviceProfiles.list(tenantId!, { limit: 500 }), enabled: !!tenantId });
  const [d, setD] = useState<Device>({ devEui: "", name: "", description: "", applicationId: appId!, deviceProfileId: "", joinEui: "", tags: {}, variables: {}, isDisabled: false, skipFcntCheck: false });
  const save = useAction((x: Device) => api.devices.create(x), {
    success: "Device created. Set its join key under Settings.",
    invalidate: [["devices"]],
    onSuccess: (_, x) => nav(`/devices/${x.devEui}`),
  });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add device" breadcrumbs={[{ label: "Applications", to: "/applications" }, { label: app.data?.application.name ?? "…", to: `/applications/${appId}` }, { label: "New device" }]} />
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(d); }}>
        <Card>
          <DeviceFields value={d} onChange={setD} profiles={profiles.data?.result ?? []} isNew />
          <FormActions>
            <button className="btn-primary" disabled={save.isPending || d.devEui.length !== 16 || !d.deviceProfileId}>{save.isPending && <Spinner />} Create device</button>
          </FormActions>
        </Card>
      </form>
    </div>
  );
}
