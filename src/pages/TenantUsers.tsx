import { useQuery } from "@tanstack/react-query";
import { Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import * as api from "@/api/chirpstack";
import type { TenantUser } from "@/api/types";
import { DataTable } from "@/components/DataTable";
import { Badge, ConfirmButton, Field, Modal, PageHeader, Spinner, Toggle } from "@/components/ui";
import { useSession } from "@/context/session";
import { fmtDate } from "@/lib/format";
import { useAction } from "@/lib/hooks";

export default function TenantUsers() {
  const { tenantId, tenant } = useSession();
  const q = useQuery({ queryKey: ["tenant-users", tenantId], queryFn: () => api.tenants.listUsers(tenantId!, { limit: 500 }), enabled: !!tenantId });
  const [edit, setEdit] = useState<TenantUser | null>(null);
  const [isNew, setIsNew] = useState(false);
  const save = useAction((u: TenantUser) => (isNew ? api.tenants.addUser(u) : api.tenants.updateUser(u)), {
    success: isNew ? "User added to tenant" : "Permissions updated",
    invalidate: [["tenant-users"]],
    onSuccess: () => setEdit(null),
  });
  const del = useAction((userId: string) => api.tenants.deleteUser(tenantId!, userId), { success: "User removed from tenant", invalidate: [["tenant-users"]] });

  return (
    <div>
      <PageHeader
        title="Tenant users"
        icon={<Users className="h-5 w-5" />}
        subtitle={`Who can access ${tenant?.name ?? "this tenant"}, and with which permissions`}
        actions={<button className="btn-primary" onClick={() => { setIsNew(true); setEdit({ tenantId: tenantId!, email: "", isAdmin: false, isDeviceAdmin: false, isGatewayAdmin: false }); }}><UserPlus className="h-4 w-4" /> Add tenant user</button>}
      />
      <DataTable
        rows={q.data?.result}
        loading={q.isLoading}
        error={q.error}
        rowKey={(u) => u.userId}
        searchable
        searchText={(u) => u.email}
        columns={[
          { key: "email", header: "E-mail", render: (u) => <span className="font-medium">{u.email}</span> },
          {
            key: "perm",
            header: "Permissions",
            render: (u) => (
              <div className="flex flex-wrap gap-1">
                {u.isAdmin && <Badge tone="brand">Tenant admin</Badge>}
                {u.isGatewayAdmin && <Badge>Gateway admin</Badge>}
                {u.isDeviceAdmin && <Badge>Device admin</Badge>}
                {!u.isAdmin && !u.isGatewayAdmin && !u.isDeviceAdmin && <Badge>Read only</Badge>}
              </div>
            ),
          },
          { key: "since", header: "Member since", render: (u) => <span className="text-muted">{fmtDate(u.createdAt)}</span> },
          {
            key: "a",
            header: "",
            className: "text-right",
            render: (u) => (
              <div className="flex justify-end gap-1">
                <button className="btn-ghost btn-sm" onClick={() => { setIsNew(false); setEdit({ ...u }); }}><Pencil className="h-3.5 w-3.5" /></button>
                <ConfirmButton className="btn-ghost btn-sm text-bad" title="Remove user from tenant?" confirmLabel="Remove" onConfirm={() => del.mutateAsync(u.userId)}><Trash2 className="h-3.5 w-3.5" /></ConfirmButton>
              </div>
            ),
          },
        ]}
      />
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={isNew ? "Add tenant user" : `Edit ${edit?.email}`}
        footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" disabled={save.isPending || !edit?.email} onClick={() => edit && save.mutate(edit)}>{save.isPending && <Spinner />} Save</button></>}
      >
        {edit && (
          <div className="space-y-4">
            <Field label="E-mail (existing user)" help="The user must already exist (Network server → Users).">
              <input className="input" disabled={!isNew} value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            </Field>
            <Toggle checked={!!edit.isAdmin} onChange={(v) => setEdit({ ...edit, isAdmin: v })} label="Tenant admin" help="Full access to this tenant, including users and API keys." />
            <Toggle checked={!!edit.isGatewayAdmin} onChange={(v) => setEdit({ ...edit, isGatewayAdmin: v })} label="Gateway admin" help="Can create, update and delete gateways." />
            <Toggle checked={!!edit.isDeviceAdmin} onChange={(v) => setEdit({ ...edit, isDeviceAdmin: v })} label="Device admin" help="Can manage applications, devices and device profiles." />
          </div>
        )}
      </Modal>
    </div>
  );
}
