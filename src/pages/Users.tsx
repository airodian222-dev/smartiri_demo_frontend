import { useQuery } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2, Users as UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { User } from "@/api/types";
import { DataTable } from "@/components/DataTable";
import { Badge, Card, ConfirmButton, ErrorBox, Field, FormActions, Loading, Modal, PageHeader, Spinner, Toggle } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { useAction } from "@/lib/hooks";

export default function Users() {
  const q = useQuery({ queryKey: ["users", "list"], queryFn: () => api.users.list({ limit: 500 }) });
  return (
    <div>
      <PageHeader title="Users" icon={<UsersIcon className="h-5 w-5" />} subtitle="Accounts that can log in to ChirpStack" actions={<Link to="/users/new" className="btn-primary"><Plus className="h-4 w-4" /> Add user</Link>} />
      <DataTable
        rows={q.data?.result}
        loading={q.isLoading}
        error={q.error}
        rowKey={(u) => u.id}
        rowLink={(u) => `/users/${u.id}`}
        searchable
        searchText={(u) => u.email}
        columns={[
          { key: "email", header: "E-mail", render: (u) => <span className="font-medium">{u.email}</span>, sort: (u) => u.email },
          { key: "admin", header: "Role", render: (u) => (u.isAdmin ? <Badge tone="brand">Global admin</Badge> : <Badge>User</Badge>) },
          { key: "active", header: "Status", render: (u) => (u.isActive ? <Badge tone="good" dot>Active</Badge> : <Badge tone="bad" dot>Disabled</Badge>) },
          { key: "created", header: "Created", render: (u) => <span className="text-muted">{fmtDate(u.createdAt)}</span>, sort: (u) => u.createdAt ?? "" },
        ]}
      />
    </div>
  );
}

export function UserDetail() {
  const { id } = useParams();
  const isNew = id === "new";
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["user", id], queryFn: () => api.users.get(id!), enabled: !isNew });
  const [u, setU] = useState<User>({ email: "", isAdmin: false, isActive: true, note: "" });
  const [password, setPassword] = useState("");
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  useEffect(() => {
    if (q.data) setU(q.data.user);
  }, [q.data]);

  const save = useAction((x: User) => (isNew ? api.users.create(x, password) : api.users.update(x).then(() => ({ id: x.id! }))), {
    success: isNew ? "User created" : "User updated",
    invalidate: [["users"], ["user", id]],
    onSuccess: (r) => isNew && nav(`/users/${(r as { id: string }).id}`),
  });
  const del = useAction(() => api.users.delete(id!), { success: "User deleted", invalidate: [["users"]], onSuccess: () => nav("/users") });
  const pw = useAction(() => api.users.updatePassword(id!, newPw), { success: "Password updated", onSuccess: () => { setPwOpen(false); setNewPw(""); } });

  if (!isNew && q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={isNew ? "Add user" : u.email}
        breadcrumbs={[{ label: "Users", to: "/users" }, { label: isNew ? "New" : u.email }]}
        actions={
          !isNew && (
            <>
              <button className="btn-secondary" onClick={() => setPwOpen(true)}><KeyRound className="h-4 w-4" /> Change password</button>
              <ConfirmButton className="btn-secondary text-bad" onConfirm={() => del.mutateAsync(undefined)} title="Delete user?"><Trash2 className="h-4 w-4" /> Delete</ConfirmButton>
            </>
          )
        }
      />
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(u); }}>
        <Card>
          <div className="grid gap-4">
            <Field label="E-mail address"><input className="input" required value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} /></Field>
            {isNew && <Field label="Password"><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>}
            <Field label="Optional note"><textarea className="input h-20" value={u.note ?? ""} onChange={(e) => setU({ ...u, note: e.target.value })} /></Field>
            <Toggle checked={!!u.isActive} onChange={(v) => setU({ ...u, isActive: v })} label="Is active" help="Disabled users cannot log in." />
            <Toggle checked={!!u.isAdmin} onChange={(v) => setU({ ...u, isAdmin: v })} label="Is global admin" help="Global admins can manage all tenants and network-server settings." />
          </div>
          <FormActions>
            <button className="btn-primary" disabled={save.isPending}>{save.isPending && <Spinner />} {isNew ? "Create user" : "Save changes"}</button>
          </FormActions>
        </Card>
      </form>
      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Change password" footer={<><button className="btn-secondary" onClick={() => setPwOpen(false)}>Cancel</button><button className="btn-primary" disabled={!newPw || pw.isPending} onClick={() => pw.mutate(undefined)}>Update password</button></>}>
        <Field label="New password"><input className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}
