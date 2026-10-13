import { useQuery } from "@tanstack/react-query";
import { Cpu, FileCog, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import * as api from "@/api/chirpstack";
import { deviceKind, SensorChip } from "@/components/sensors";
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui";
import { useSession } from "@/context/session";
import { enumLabel, timeAgo } from "@/lib/format";
import { useTenantDevices } from "@/lib/hooks";

export default function DeviceProfiles() {
  const { tenantId } = useSession();
  const q = useQuery({ queryKey: ["device-profiles", tenantId], queryFn: () => api.deviceProfiles.list(tenantId!, { limit: 500 }), enabled: !!tenantId });
  const devs = useTenantDevices(tenantId);
  const count = (id: string) => devs.data?.filter((d) => d.deviceProfileId === id).length ?? 0;
  const max = Math.max(1, ...(q.data?.result ?? []).map((p) => count(p.id)));

  return (
    <div>
      <PageHeader
        title="Device profiles"
        icon={<FileCog className="h-5 w-5" />}
        subtitle="Templates describing how a type of device communicates and how its data is decoded"
        actions={<Link to="/device-profiles/new" className="btn-primary"><Plus className="h-4 w-4" /> New profile</Link>}
      />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : !q.data?.result.length ? (
        <Card><Empty title="No device profiles yet" icon={<FileCog className="h-5 w-5" />} action={<Link to="/device-profiles/new" className="btn-primary"><Plus className="h-4 w-4" /> New profile</Link>} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {q.data.result.map((p) => {
            const k = deviceKind(undefined, p.name);
            const n = count(p.id);
            return (
              <Link key={p.id} to={`/device-profiles/${p.id}`} className="card card-hover p-5 block relative overflow-hidden animate-rise">
                <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${k.gradient} opacity-[0.14] blur-2xl`} />
                <div className="flex items-start gap-3 relative">
                  <SensorChip gradient={k.gradient}>{k.icon}</SensorChip>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-snug">{p.name}</div>
                    <div className="text-xs text-muted mt-0.5">{p.region ?? "EU868"} · {enumLabel(p.macVersion ?? "LORAWAN_1_0_0")}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-4 relative">
                  <Badge tone={p.supportsOtaa ? "good" : "neutral"}>{p.supportsOtaa ? "OTAA" : "ABP"}</Badge>
                  <Badge tone="brand">Class A</Badge>
                  {p.supportsClassB && <Badge tone="brand">Class B</Badge>}
                  {p.supportsClassC && <Badge tone="brand">Class C</Badge>}
                </div>
                <div className="mt-4 relative">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted flex items-center gap-1"><Cpu className="h-3.5 w-3.5" /> Devices using it</span>
                    <span className="font-semibold tnum">{n}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-raised overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${k.gradient}`} style={{ width: `${(n / max) * 100}%` }} />
                  </div>
                </div>
                <div className="text-[11px] text-muted mt-3 relative">Updated {timeAgo(p.updatedAt)}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
