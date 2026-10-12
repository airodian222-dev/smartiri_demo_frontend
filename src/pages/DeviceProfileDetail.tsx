import { useQuery } from "@tanstack/react-query";
import { Boxes, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { DeviceProfile } from "@/api/types";
import { DEFAULT_PROFILE, DeviceProfileForm } from "@/components/DeviceProfileForm";
import { Card, ConfirmButton, ErrorBox, Field, FormActions, Loading, Modal, PageHeader, Select, Spinner } from "@/components/ui";
import { useSession } from "@/context/session";
import { fmtDate } from "@/lib/format";
import { useAction } from "@/lib/hooks";

export default function DeviceProfileDetail() {
  const { id } = useParams();
  const isNew = id === "new";
  const nav = useNavigate();
  const { tenantId } = useSession();
  const q = useQuery({ queryKey: ["device-profile", id], queryFn: () => api.deviceProfiles.get(id!), enabled: !isNew });
  const [dp, setDp] = useState<DeviceProfile>({ ...DEFAULT_PROFILE, tenantId: tenantId ?? "" });
  const [tplOpen, setTplOpen] = useState(false);
  const [tplId, setTplId] = useState("");
  const templates = useQuery({ queryKey: ["device-profile-templates"], queryFn: () => api.deviceProfileTemplates.list({ limit: 500 }), enabled: isNew, retry: false });

  useEffect(() => {
    if (q.data) setDp({ ...DEFAULT_PROFILE, ...q.data.deviceProfile } as DeviceProfile);
  }, [q.data]);

  const save = useAction((x: DeviceProfile) => (isNew ? api.deviceProfiles.create({ ...x, tenantId: tenantId! }) : api.deviceProfiles.update(x).then(() => ({ id: x.id! }))), {
    success: isNew ? "Device profile created" : "Device profile updated",
    invalidate: [["device-profiles"], ["device-profile", id]],
    onSuccess: (r) => isNew && nav(`/device-profiles/${(r as { id: string }).id}`),
  });
  const del = useAction(() => api.deviceProfiles.delete(id!), { success: "Device profile deleted", invalidate: [["device-profiles"]], onSuccess: () => nav("/device-profiles") });

  async function applyTemplate() {
    const t = await api.deviceProfileTemplates.get(tplId);
    const { id: _id, vendor: _v, firmware: _f, ...rest } = t.deviceProfileTemplate;
    void _id; void _v; void _f;
    setDp({ ...DEFAULT_PROFILE, ...rest, tenantId: tenantId! } as DeviceProfile);
    setTplOpen(false);
  }

  if (!isNew && q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={isNew ? "Add device profile" : dp.name}
        breadcrumbs={[{ label: "Device profiles", to: "/device-profiles" }, { label: isNew ? "New" : dp.name }]}
        subtitle={!isNew && <span className="text-xs">Updated {fmtDate(q.data?.updatedAt)}</span>}
        actions={
          isNew ? (
            <button className="btn-secondary" onClick={() => setTplOpen(true)}><Boxes className="h-4 w-4" /> Select device-profile template</button>
          ) : (
            <ConfirmButton className="btn-secondary text-bad" onConfirm={() => del.mutateAsync(undefined)} title="Delete device profile?"><Trash2 className="h-4 w-4" /> Delete</ConfirmButton>
          )
        }
      />
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(dp); }}>
        <Card>
          <DeviceProfileForm value={dp} onChange={setDp} />
          <FormActions>
            <button className="btn-primary" disabled={save.isPending}>{save.isPending && <Spinner />} {isNew ? "Create device profile" : "Save changes"}</button>
          </FormActions>
        </Card>
      </form>
      <Modal open={tplOpen} onClose={() => setTplOpen(false)} title="Select device-profile template" footer={<><button className="btn-secondary" onClick={() => setTplOpen(false)}>Cancel</button><button className="btn-primary" disabled={!tplId} onClick={applyTemplate}>Apply</button></>}>
        {templates.error ? (
          <ErrorBox error={templates.error} />
        ) : (
          <Field label="Template" help="Copies all settings of the template into this new profile.">
            <Select value={tplId} onChange={setTplId} options={[{ value: "", label: "Select…" }, ...(templates.data?.result ?? []).map((t) => ({ value: t.id, label: `${t.vendor} — ${t.name} (${t.region}, fw ${t.firmware})` }))]} />
          </Field>
        )}
      </Modal>
    </div>
  );
}
