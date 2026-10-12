import { useQuery } from "@tanstack/react-query";
import { FileCog, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import * as api from "@/api/chirpstack";
import { DataTable } from "@/components/DataTable";
import { Badge, PageHeader } from "@/components/ui";
import { useSession } from "@/context/session";
import { enumLabel, fmtDate } from "@/lib/format";

export default function DeviceProfiles() {
  const { tenantId } = useSession();
  const q = useQuery({ queryKey: ["device-profiles", tenantId], queryFn: () => api.deviceProfiles.list(tenantId!, { limit: 500 }), enabled: !!tenantId });
  return (
    <div>
      <PageHeader
        title="Device profiles"
        icon={<FileCog className="h-5 w-5" />}
        subtitle="LoRaWAN capabilities, codec and measurements shared by a group of devices"
        actions={<Link to="/device-profiles/new" className="btn-primary"><Plus className="h-4 w-4" /> Add device profile</Link>}
      />
      <DataTable
        rows={q.data?.result}
        loading={q.isLoading}
        error={q.error}
        rowKey={(d) => d.id}
        rowLink={(d) => `/device-profiles/${d.id}`}
        searchable
        searchText={(d) => d.name}
        columns={[
          { key: "name", header: "Name", render: (d) => <span className="font-medium">{d.name}</span>, sort: (d) => d.name },
          { key: "region", header: "Region", render: (d) => <Badge tone="brand">{d.region ?? "EU868"}</Badge> },
          { key: "mac", header: "MAC version", render: (d) => enumLabel(d.macVersion ?? "LORAWAN_1_0_0") },
          { key: "rp", header: "Reg. params", render: (d) => <span className="mono text-xs">{d.regParamsRevision ?? "A"}</span> },
          {
            key: "cls",
            header: "Capabilities",
            render: (d) => (
              <div className="flex gap-1">
                <Badge tone={d.supportsOtaa ? "good" : "neutral"}>{d.supportsOtaa ? "OTAA" : "ABP"}</Badge>
                {d.supportsClassB && <Badge>Class B</Badge>}
                {d.supportsClassC && <Badge>Class C</Badge>}
              </div>
            ),
          },
          { key: "upd", header: "Updated", render: (d) => <span className="text-muted">{fmtDate(d.updatedAt)}</span>, sort: (d) => d.updatedAt ?? "" },
        ]}
      />
    </div>
  );
}
