import { useQuery } from "@tanstack/react-query";
import { Cpu, ListOrdered, Plus, RadioTower, Send, Settings, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "@/api/chirpstack";
import type { MulticastGroup } from "@/api/types";
import { DataTable } from "@/components/DataTable";
import { Card, ConfirmButton, Empty, ErrorBox, Field, FormActions, HexInput, Loading, Modal, PageHeader, Select, Spinner, StatusDot, Tabs } from "@/components/ui";
import { useSession } from "@/context/session";
import { REGIONS } from "@/lib/constants";
import { base64ToHex, hexToBase64, timeAgo } from "@/lib/format";
import { useAction } from "@/lib/hooks";

function McForm({ value: m, onChange }: { value: MulticastGroup; onChange: (m: MulticastGroup) => void }) {
  const set = (p: Partial<MulticastGroup>) => onChange({ ...m, ...p });
  return (
    <div className="grid gap-4">
      <Field label="Multicast-group name"><input className="input" required value={m.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Multicast address (McAddr)"><HexInput bytes={4} value={m.mcAddr} onChange={(mcAddr) => set({ mcAddr })} /></Field>
        <Field label="Region"><Select value={m.region} onChange={(region) => set({ region })} options={[...REGIONS]} /></Field>
        <Field label="Multicast network session key (McNwkSKey)"><HexInput bytes={16} secret value={m.mcNwkSKey} onChange={(mcNwkSKey) => set({ mcNwkSKey })} /></Field>
        <Field label="Multicast application session key (McAppSKey)"><HexInput bytes={16} secret value={m.mcAppSKey} onChange={(mcAppSKey) => set({ mcAppSKey })} /></Field>
        <Field label="Frame-counter"><input type="number" className="input" value={m.fCnt ?? 0} onChange={(e) => set({ fCnt: +e.target.value })} /></Field>
        <Field label="Data-rate"><input type="number" className="input" value={m.dr ?? 0} onChange={(e) => set({ dr: +e.target.value })} /></Field>
        <Field label="Frequency (Hz)"><input type="number" className="input" value={m.frequency ?? 0} onChange={(e) => set({ frequency: +e.target.value })} /></Field>
        <Field label="Group type"><Select value={m.groupType} onChange={(g) => set({ groupType: g as MulticastGroup["groupType"] })} options={[{ value: "CLASS_C", label: "Class-C" }, { value: "CLASS_B", label: "Class-B" }]} /></Field>
        {m.groupType === "CLASS_B" ? (
          <Field label="Class-B ping-slot periodicity">
            <Select value={String(m.classBPingSlotPeriodicity ?? 0)} onChange={(x) => set({ classBPingSlotPeriodicity: +x })} options={[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ value: String(i), label: `Every ${2 ** i} sec` }))} />
          </Field>
        ) : (
          <Field label="Class-C scheduling type"><Select value={m.classCSchedulingType ?? "DELAY"} onChange={(x) => set({ classCSchedulingType: x as "DELAY" | "GPS_TIME" })} options={[{ value: "DELAY", label: "Delay" }, { value: "GPS_TIME", label: "GPS time" }]} /></Field>
        )}
      </div>
    </div>
  );
}

const blank = (applicationId: string): MulticastGroup => ({ name: "", applicationId, region: "EU868", mcAddr: "", mcNwkSKey: "", mcAppSKey: "", fCnt: 0, groupType: "CLASS_C", dr: 0, frequency: 868100000, classBPingSlotPeriodicity: 0, classCSchedulingType: "DELAY" });

export function MulticastGroupCreate() {
  const { appId } = useParams();
  const nav = useNavigate();
  const [m, setM] = useState<MulticastGroup>(blank(appId!));
  const save = useAction((x: MulticastGroup) => api.multicastGroups.create(x), { success: "Multicast group created", invalidate: [["multicast-groups"]], onSuccess: (r) => nav(`/multicast-groups/${r.id}`) });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add multicast group" breadcrumbs={[{ label: "Application", to: `/applications/${appId}` }, { label: "New multicast group" }]} />
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(m); }}>
        <Card>
          <McForm value={m} onChange={setM} />
          <FormActions><button className="btn-primary" disabled={save.isPending}>{save.isPending && <Spinner />} Create</button></FormActions>
        </Card>
      </form>
    </div>
  );
}

type Tab = "devices" | "gateways" | "queue" | "config";

export default function MulticastGroupDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { tenantId } = useSession();
  const [tab, setTab] = useState<Tab>("devices");
  const q = useQuery({ queryKey: ["multicast-group", id], queryFn: () => api.multicastGroups.get(id!) });
  const [m, setM] = useState<MulticastGroup | null>(null);
  useEffect(() => { if (q.data) setM({ ...blank(""), ...q.data.multicastGroup }); }, [q.data]);
  const appId = q.data?.multicastGroup.applicationId;
  const devs = useQuery({ queryKey: ["devices", "mc", id], queryFn: () => api.devices.list("", { multicastGroupId: id, limit: 1000 }) });
  const appDevs = useQuery({ queryKey: ["devices", "app", appId], queryFn: () => api.devices.list(appId!, { limit: 1000 }), enabled: !!appId });
  const gws = useQuery({ queryKey: ["gateways", "mc", id], queryFn: () => api.gateways.list(undefined, { multicastGroupId: id, limit: 500 }) });
  const tenantGws = useQuery({ queryKey: ["gateways", tenantId], queryFn: () => api.gateways.list(tenantId!, { limit: 500 }), enabled: !!tenantId });
  const queue = useQuery({ queryKey: ["mc-queue", id], queryFn: () => api.multicastGroups.listQueue(id!), enabled: tab === "queue", refetchInterval: 4000 });

  const [addDev, setAddDev] = useState(false);
  const [addGw, setAddGw] = useState(false);
  const [sel, setSel] = useState("");
  const [fPort, setFPort] = useState(200);
  const [hex, setHex] = useState("");

  const save = useAction((x: MulticastGroup) => api.multicastGroups.update(x), { success: "Multicast group updated", invalidate: [["multicast-group", id]] });
  const del = useAction(() => api.multicastGroups.delete(id!), { success: "Multicast group deleted", invalidate: [["multicast-groups"]], onSuccess: () => nav(`/applications/${appId}`) });
  const addDevice = useAction((eui: string) => api.multicastGroups.addDevice(id!, eui), { success: "Device added", invalidate: [["devices", "mc", id]], onSuccess: () => setAddDev(false) });
  const rmDevice = useAction((eui: string) => api.multicastGroups.removeDevice(id!, eui), { success: "Device removed", invalidate: [["devices", "mc", id]] });
  const addGateway = useAction((gw: string) => api.multicastGroups.addGateway(id!, gw), { success: "Gateway added", invalidate: [["gateways", "mc", id]], onSuccess: () => setAddGw(false) });
  const rmGateway = useAction((gw: string) => api.multicastGroups.removeGateway(id!, gw), { success: "Gateway removed", invalidate: [["gateways", "mc", id]] });
  const enqueue = useAction(() => api.multicastGroups.enqueue(id!, { fPort, data: hexToBase64(hex) }), { success: "Multicast downlink enqueued", invalidate: [["mc-queue", id]], onSuccess: () => setHex("") });
  const flush = useAction(() => api.multicastGroups.flushQueue(id!), { success: "Queue flushed", invalidate: [["mc-queue", id]] });

  if (q.error) return <ErrorBox error={q.error} />;
  if (!m) return <Loading />;
  const memberEuis = new Set((devs.data?.result ?? []).map((d) => d.devEui));
  const memberGws = new Set((gws.data?.result ?? []).map((g) => g.gatewayId));

  return (
    <div>
      <PageHeader
        title={m.name}
        breadcrumbs={[{ label: "Applications", to: "/applications" }, { label: "Application", to: `/applications/${appId}` }, { label: m.name }]}
        subtitle={`${m.groupType.replace("_", "-")} multicast · ${m.region} · McAddr ${m.mcAddr}`}
        actions={<ConfirmButton className="btn-secondary text-bad" onConfirm={() => del.mutateAsync(undefined)} title="Delete multicast group?"><Trash2 className="h-4 w-4" /> Delete</ConfirmButton>}
      />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "devices", label: "Devices", icon: <Cpu className="h-4 w-4" /> },
        { key: "gateways", label: "Gateways", icon: <RadioTower className="h-4 w-4" /> },
        { key: "queue", label: "Queue", icon: <ListOrdered className="h-4 w-4" /> },
        { key: "config", label: "Configuration", icon: <Settings className="h-4 w-4" /> },
      ]} />

      {tab === "devices" && (
        <DataTable
          rows={devs.data?.result}
          loading={devs.isLoading}
          error={devs.error}
          rowKey={(d) => d.devEui}
          rowLink={(d) => `/devices/${d.devEui}`}
          emptyTitle="No devices in this group"
          toolbar={<button className="btn-primary btn-sm" onClick={() => { setSel(""); setAddDev(true); }}><Plus className="h-3.5 w-3.5" /> Add device</button>}
          columns={[
            { key: "name", header: "Name", render: (d) => <span className="font-medium">{d.name}</span> },
            { key: "eui", header: "DevEUI", render: (d) => <span className="mono">{d.devEui}</span> },
            { key: "seen", header: "Last seen", render: (d) => timeAgo(d.lastSeenAt) },
            { key: "a", header: "", className: "text-right", render: (d) => <ConfirmButton className="btn-ghost btn-sm text-bad" title="Remove device from group?" confirmLabel="Remove" onConfirm={() => rmDevice.mutateAsync(d.devEui)}><Trash2 className="h-3.5 w-3.5" /></ConfirmButton> },
          ]}
        />
      )}
      {tab === "gateways" && (
        <DataTable
          rows={gws.data?.result}
          loading={gws.isLoading}
          error={gws.error}
          rowKey={(g) => g.gatewayId}
          rowLink={(g) => `/gateways/${g.gatewayId}`}
          emptyTitle="No gateways in this group"
          emptyHint="Without gateways, ChirpStack selects gateways automatically based on the devices in the group."
          toolbar={<button className="btn-primary btn-sm" onClick={() => { setSel(""); setAddGw(true); }}><Plus className="h-3.5 w-3.5" /> Add gateway</button>}
          columns={[
            { key: "s", header: "Status", render: (g) => <StatusDot state={g.state} /> },
            { key: "name", header: "Name", render: (g) => <span className="font-medium">{g.name}</span> },
            { key: "id", header: "Gateway ID", render: (g) => <span className="mono">{g.gatewayId}</span> },
            { key: "a", header: "", className: "text-right", render: (g) => <ConfirmButton className="btn-ghost btn-sm text-bad" title="Remove gateway from group?" confirmLabel="Remove" onConfirm={() => rmGateway.mutateAsync(g.gatewayId)}><Trash2 className="h-3.5 w-3.5" /></ConfirmButton> },
          ]}
        />
      )}
      {tab === "queue" && (
        <div className="grid lg:grid-cols-5 gap-4">
          <Card title="Enqueue multicast downlink" className="lg:col-span-2">
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); enqueue.mutate(undefined); }}>
              <Field label="FPort"><input type="number" className="input" min={1} max={223} value={fPort} onChange={(e) => setFPort(+e.target.value)} /></Field>
              <Field label="Payload (HEX)"><input className="input mono" value={hex} onChange={(e) => setHex(e.target.value.replace(/[^0-9a-fA-F]/g, ""))} placeholder="0102ff" /></Field>
              <button className="btn-primary" disabled={enqueue.isPending || hex.length % 2 !== 0}><Send className="h-4 w-4" /> Enqueue</button>
            </form>
          </Card>
          <Card title="Queue" className="lg:col-span-3" actions={<ConfirmButton className="btn-secondary btn-sm" title="Flush multicast queue?" confirmLabel="Flush" onConfirm={() => flush.mutateAsync(undefined)}>Flush</ConfirmButton>}>
            {queue.isLoading ? <Loading /> : !queue.data?.items?.length ? <Empty title="Queue is empty" /> : (
              <table className="w-full">
                <thead><tr><th className="table-th">FCnt</th><th className="table-th">FPort</th><th className="table-th">Payload</th></tr></thead>
                <tbody>{queue.data.items.map((i) => <tr key={i.fCnt}><td className="table-td">{i.fCnt ?? 0}</td><td className="table-td">{i.fPort}</td><td className="table-td mono text-xs">{base64ToHex(i.data)}</td></tr>)}</tbody>
              </table>
            )}
          </Card>
        </div>
      )}
      {tab === "config" && (
        <form className="max-w-3xl" onSubmit={(e) => { e.preventDefault(); save.mutate(m); }}>
          <Card>
            <McForm value={m} onChange={setM} />
            <FormActions><button className="btn-primary" disabled={save.isPending}>{save.isPending && <Spinner />} Save changes</button></FormActions>
          </Card>
        </form>
      )}

      <Modal open={addDev} onClose={() => setAddDev(false)} title="Add device to multicast group" footer={<><button className="btn-secondary" onClick={() => setAddDev(false)}>Cancel</button><button className="btn-primary" disabled={!sel} onClick={() => addDevice.mutate(sel)}>Add</button></>}>
        <Select value={sel} onChange={setSel} options={[{ value: "", label: "Select device…" }, ...(appDevs.data?.result ?? []).filter((d) => !memberEuis.has(d.devEui)).map((d) => ({ value: d.devEui, label: `${d.name} (${d.devEui})` }))]} />
      </Modal>
      <Modal open={addGw} onClose={() => setAddGw(false)} title="Add gateway to multicast group" footer={<><button className="btn-secondary" onClick={() => setAddGw(false)}>Cancel</button><button className="btn-primary" disabled={!sel} onClick={() => addGateway.mutate(sel)}>Add</button></>}>
        <Select value={sel} onChange={setSel} options={[{ value: "", label: "Select gateway…" }, ...(tenantGws.data?.result ?? []).filter((g) => !memberGws.has(g.gatewayId)).map((g) => ({ value: g.gatewayId, label: `${g.name} (${g.gatewayId})` }))]} />
      </Modal>
    </div>
  );
}
