import { useQuery } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { createApiKey, deleteApiKey, listApiKeys } from "@/api/internal";
import { DataTable } from "@/components/DataTable";
import { ConfirmButton, CopyButton, Field, Modal, PageHeader, Spinner } from "@/components/ui";
import { useSession } from "@/context/session";
import { useAction } from "@/lib/hooks";

export default function ApiKeys({ admin }: { admin?: boolean }) {
  const { tenantId, tenant } = useSession();
  const q = useQuery({ queryKey: ["api-keys", admin ? "admin" : tenantId], queryFn: () => listApiKeys({ isAdmin: admin, tenantId: admin ? undefined : tenantId! }), retry: false });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const create = useAction(() => createApiKey({ name, isAdmin: !!admin, tenantId: admin ? undefined : tenantId! }), {
    success: "API key created",
    invalidate: [["api-keys"]],
    onSuccess: (r) => setToken(r.token),
  });
  const del = useAction((id: string) => deleteApiKey(id), { success: "API key deleted", invalidate: [["api-keys"]] });
  return (
    <div>
      <PageHeader
        title={admin ? "API keys" : "Tenant API keys"}
        icon={<KeyRound className="h-5 w-5" />}
        subtitle={admin ? "Global admin keys for external integrations" : `Keys scoped to ${tenant?.name ?? "this tenant"}`}
        actions={<button className="btn-primary" onClick={() => { setName(""); setToken(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add API key</button>}
      />
      <DataTable
        rows={q.data?.result}
        loading={q.isLoading}
        error={q.error}
        rowKey={(k) => k.id}
        emptyTitle="No API keys"
        emptyHint="API keys let external services (Node-RED, Grafana, scripts) call the ChirpStack API."
        columns={[
          { key: "id", header: "ID", render: (k) => <span className="mono text-muted">{k.id}</span> },
          { key: "name", header: "Name", render: (k) => <span className="font-medium">{k.name}</span> },
          {
            key: "a",
            header: "",
            className: "text-right",
            render: (k) => (
              <ConfirmButton className="btn-ghost btn-sm text-bad" title="Delete API key?" message="Services using this key will lose access immediately." onConfirm={() => del.mutateAsync(k.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </ConfirmButton>
            ),
          },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={token ? "API key created" : "Add API key"}
        footer={token ? <button className="btn-primary" onClick={() => setOpen(false)}>Done</button> : <><button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={!name || create.isPending} onClick={() => create.mutate(undefined)}>{create.isPending && <Spinner />} Create</button></>}
      >
        {token ? (
          <div className="space-y-2">
            <p className="text-sm text-ink2">Copy the token now — it will not be shown again.</p>
            <div className="flex items-start gap-2">
              <textarea readOnly className="input mono h-28 text-xs" value={token} />
              <CopyButton text={token} />
            </div>
          </div>
        ) : (
          <Field label="Name"><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Node-RED" /></Field>
        )}
      </Modal>
    </div>
  );
}
