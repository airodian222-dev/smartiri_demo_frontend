import { Activity, Pause, Play } from "lucide-react";
import { useMemo, useState } from "react";
import type { FeedEvent } from "@/api/types";
import { EVENT_STYLE, EventIcon, FeedList } from "@/components/Feed";
import { LogStream } from "@/components/LogStream";
import { Badge, Card, Empty, JsonView, PageHeader, Select } from "@/components/ui";
import { useSession } from "@/context/session";
import { isDemo } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { useFeed, useTenantDevices } from "@/lib/hooks";

const TYPES = ["up", "join", "status", "txack", "ack", "log"];

export default function LiveEvents() {
  return isDemo() ? <DemoFeed /> : <DeviceStreamPicker />;
}

function DemoFeed() {
  const { tenantId } = useSession();
  const all = useFeed(400);
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<FeedEvent[]>([]);
  const [type, setType] = useState("");
  const [app, setApp] = useState("");
  const [selected, setSelected] = useState<FeedEvent | null>(null);
  const source = (paused ? frozen : all).filter((e) => e.tenantId === tenantId);
  const apps = useMemo(() => [...new Map(source.map((e) => [e.applicationId, e.applicationName])).entries()], [source]);
  const events = source.filter((e) => (!type || e.type === type) && (!app || e.applicationId === app));
  const counts = TYPES.map((t) => ({ t, n: source.filter((e) => e.type === t).length }));

  return (
    <div>
      <PageHeader
        title="Live events"
        icon={<Activity className="h-5 w-5" />}
        subtitle="Every uplink, join, downlink and alert in this workspace, as it happens"
        actions={<button className="btn-secondary" onClick={() => { setFrozen(all); setPaused(!paused); }}>{paused ? <><Play className="h-4 w-4" /> Resume</> : <><Pause className="h-4 w-4" /> Pause</>}</button>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {counts.map(({ t, n }) => (
          <button key={t} onClick={() => setType(type === t ? "" : t)} className={`card card-hover px-4 py-3 text-left flex items-center gap-3 ${type === t ? "ring-2 ring-brand shadow-glow" : ""}`}>
            <EventIcon type={t} />
            <div>
              <div className="text-xs text-muted">{EVENT_STYLE[t]?.label ?? t}</div>
              <div className="text-xl font-bold tnum">{n}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="grid lg:grid-cols-5 gap-4">
        <Card
          className="lg:col-span-3"
          title={<span className="flex items-center gap-2">{paused ? <Badge>Paused</Badge> : <Badge tone="good" dot>Live</Badge>} {events.length} events</span>}
          actions={
            <>
              <Select className="py-1 w-auto text-xs" value={type} onChange={setType} options={[{ value: "", label: "All types" }, ...TYPES]} />
              <Select className="py-1 w-auto text-xs" value={app} onChange={setApp} options={[{ value: "", label: "All applications" }, ...apps.map(([id, name]) => ({ value: id, label: name }))]} />
            </>
          }
          bodyClass="pb-1"
        >
          {events.length ? (
            <div className="max-h-[70vh] overflow-y-auto">
              <FeedList events={events} onSelect={setSelected} selectedId={selected?.id} />
            </div>
          ) : (
            <Empty title="Waiting for events…" />
          )}
        </Card>
        <Card className="lg:col-span-2 lg:sticky lg:top-0 self-start" title={selected ? `${selected.type} · ${selected.deviceName}` : "Event details"} subtitle={selected ? fmtDate(selected.time) : "Select an event to inspect its JSON payload"}>
          {selected ? <JsonView value={selected.body} /> : <Empty title="No event selected" />}
        </Card>
      </div>
    </div>
  );
}

function DeviceStreamPicker() {
  const { tenantId } = useSession();
  const devs = useTenantDevices(tenantId);
  const [eui, setEui] = useState("");
  return (
    <div>
      <PageHeader title="Live events" icon={<Activity className="h-5 w-5" />} subtitle="Choose a device to follow its data live." />
      <div className="flex flex-wrap gap-2 mb-4">
        <Select className="w-auto min-w-[280px]" value={eui} onChange={setEui} options={[{ value: "", label: "Select a device…" }, ...(devs.data ?? []).map((d) => ({ value: d.devEui, label: `${d.name} — ${d.applicationName}` }))]} />
      </div>
      {eui ? <LogStream key={eui} id={eui} /> : <Card><Empty title="No device selected" /></Card>}
    </div>
  );
}
