import { useQuery } from "@tanstack/react-query";
import { Cable, CircleCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "@/api/chirpstack";
import type { GatewayCertificate } from "@/api/types";
import { INTEGRATIONS, INTEGRATION_FIELDS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { Badge, ConfirmButton, CopyButton, ErrorBox, Field, KeyValueEditor, Loading, Modal, Select, Spinner, Toggle } from "./ui";

export function Integrations({ applicationId }: { applicationId: string }) {
  const list = useQuery({ queryKey: ["integrations", applicationId], queryFn: () => api.applications.listIntegrations(applicationId) });
  const [edit, setEdit] = useState<{ slug: string; isNew: boolean } | null>(null);
  const [mqttCert, setMqttCert] = useState<GatewayCertificate | null>(null);
  const configured = new Set((list.data?.result ?? []).map((i) => i.kind));
  const del = useAction((slug: string) => api.applications.deleteIntegration(applicationId, slug), { success: "Integration removed", invalidate: [["integrations", applicationId]] });
  const gen = useAction(() => api.applications.generateMqttCertificate(applicationId), { success: "Certificate generated", onSuccess: setMqttCert });

  if (list.isLoading) return <Loading />;
  if (list.error) return <ErrorBox error={list.error} />;

  return (
    <div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="card p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2"><Cable className="h-4 w-4 text-brand" /> MQTT</div>
            <Badge tone="good"><CircleCheck className="h-3 w-3" /> Global</Badge>
          </div>
          <p className="text-sm text-muted mt-2 flex-1">Events are published to <span className="mono text-xs">application/{applicationId.slice(0, 8)}…/device/+/event/+</span>. Generate a client certificate for MQTT mutual-TLS.</p>
          <button className="btn-secondary btn-sm mt-3 self-start" disabled={gen.isPending} onClick={() => gen.mutate(undefined)}>{gen.isPending && <Spinner />} Get certificate</button>
        </div>
        {INTEGRATIONS.map((i) => {
          const on = configured.has(i.kind);
          return (
            <div key={i.slug} className="card p-4 flex flex-col">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{i.name}</div>
                {on && <Badge tone="good"><CircleCheck className="h-3 w-3" /> Configured</Badge>}
              </div>
              <p className="text-sm text-muted mt-2 flex-1">{i.description}</p>
              <div className="flex gap-2 mt-3">
                {on ? (
                  <>
                    <button className="btn-secondary btn-sm" onClick={() => setEdit({ slug: i.slug, isNew: false })}><Pencil className="h-3.5 w-3.5" /> Edit</button>
                    <ConfirmButton className="btn-ghost btn-sm text-bad" title={`Remove ${i.name} integration?`} confirmLabel="Remove" onConfirm={() => del.mutateAsync(i.slug)}><Trash2 className="h-3.5 w-3.5" /> Remove</ConfirmButton>
                  </>
                ) : (
                  <button className="btn-secondary btn-sm" onClick={() => setEdit({ slug: i.slug, isNew: true })}><Plus className="h-3.5 w-3.5" /> Add</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {edit && <IntegrationModal applicationId={applicationId} slug={edit.slug} isNew={edit.isNew} onClose={() => setEdit(null)} />}
      <Modal open={!!mqttCert} onClose={() => setMqttCert(null)} title="MQTT client certificate" wide footer={<button className="btn-primary" onClick={() => setMqttCert(null)}>Done</button>}>
        {mqttCert && (
          <div className="space-y-3">
            <p className="text-sm">Expires: <b>{fmtDate(mqttCert.expiresAt)}</b></p>
            {([["CA certificate", mqttCert.caCert], ["TLS certificate", mqttCert.tlsCert], ["TLS key", mqttCert.tlsKey]] as const).map(([l, v]) => (
              <div key={l}>
                <div className="flex items-center justify-between"><span className="label">{l}</span><CopyButton text={v} /></div>
                <textarea readOnly className="input mono text-xs h-24" value={v} />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function IntegrationModal({ applicationId, slug, isNew, onClose }: { applicationId: string; slug: string; isNew: boolean; onClose: () => void }) {
  const meta = INTEGRATIONS.find((i) => i.slug === slug)!;
  const fields = INTEGRATION_FIELDS[slug] ?? [];
  const q = useQuery({ queryKey: ["integration", applicationId, slug], queryFn: () => api.applications.getIntegration(applicationId, slug), enabled: !isNew });
  const [data, setData] = useState<Record<string, unknown> | null>(isNew ? { headers: {}, encoding: "JSON", version: "INFLUXDB_1", precision: "NS", uplinkValues: [] } : null);
  useEffect(() => {
    if (!isNew && q.data) setData(q.data.integration);
  }, [isNew, q.data]);
  const save = useAction((d: Record<string, unknown>) => (isNew ? api.applications.createIntegration(applicationId, slug, d) : api.applications.updateIntegration(applicationId, slug, d)), {
    success: `${meta.name} integration saved`,
    invalidate: [["integrations", applicationId], ["integration", applicationId, slug]],
    onSuccess: onClose,
  });
  const set = (k: string, v: unknown) => setData({ ...(data ?? {}), [k]: v });
  return (
    <Modal open onClose={onClose} title={`${isNew ? "Add" : "Edit"} ${meta.name} integration`} wide footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!data || save.isPending} onClick={() => data && save.mutate(data)}>{save.isPending && <Spinner />} Save</button></>}>
      {!data ? (
        q.error ? <ErrorBox error={q.error} /> : <Loading />
      ) : (
        <div className="space-y-4">
          {fields.map((f) => (
            <Field key={f.key} label={f.label} help={f.help}>
              {f.type === "select" ? (
                <Select value={String(data[f.key] ?? f.options![0])} onChange={(v) => set(f.key, v)} options={f.options!} />
              ) : f.type === "textarea" ? (
                <textarea className="input mono text-xs h-28" value={String(data[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />
              ) : f.type === "bool" ? (
                <Toggle checked={!!data[f.key]} onChange={(v) => set(f.key, v)} label={f.label} />
              ) : f.type === "list" ? (
                <input className="input" value={((data[f.key] as string[]) ?? []).join(", ")} onChange={(e) => set(f.key, e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
              ) : (
                <input className="input" type={f.type === "password" ? "password" : "text"} value={String(data[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />
              )}
            </Field>
          ))}
          {slug === "http" && (
            <Field label="Headers" help="Added to every HTTP request, e.g. for authentication.">
              <KeyValueEditor keyLabel="Header" value={(data.headers as Record<string, string>) ?? {}} onChange={(h) => set("headers", h)} />
            </Field>
          )}
        </div>
      )}
    </Modal>
  );
}
