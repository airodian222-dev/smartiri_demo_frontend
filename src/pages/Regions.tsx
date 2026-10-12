import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { useParams } from "react-router-dom";
import { getRegion, listRegions } from "@/api/internal";
import { DataTable } from "@/components/DataTable";
import { Badge, Card, ErrorBox, KV, Loading, PageHeader } from "@/components/ui";
import { fmtFreq } from "@/lib/format";

export default function Regions() {
  const q = useQuery({ queryKey: ["regions"], queryFn: listRegions, retry: false });
  return (
    <div>
      <PageHeader title="Regions" icon={<Globe className="h-5 w-5" />} subtitle="Region configurations enabled on the network server (read-only, configured in chirpstack.toml)" />
      <DataTable
        rows={q.data}
        loading={q.isLoading}
        error={q.error}
        rowKey={(r) => r.id}
        rowLink={(r) => `/regions/${r.id}`}
        columns={[
          { key: "id", header: "ID", render: (r) => <span className="mono">{r.id}</span> },
          { key: "region", header: "Region", render: (r) => <Badge tone="brand">{r.region}</Badge> },
          { key: "desc", header: "Description", render: (r) => r.description || "—" },
        ]}
      />
    </div>
  );
}

export function RegionDetail() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["region", id], queryFn: () => getRegion(id!), retry: false });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const r = q.data!;
  return (
    <div className="max-w-4xl">
      <PageHeader title={r.description || r.id} breadcrumbs={[{ label: "Regions", to: "/regions" }, { label: r.id }]} subtitle={<Badge tone="brand">{r.region}</Badge>} />
      <div className="grid gap-4">
        <Card title="Receive windows & Class-B">
          <KV
            cols={3}
            items={[
              ["RX1 delay", `${r.rx1Delay} s`],
              ["RX1 DR offset", r.rx1DrOffset],
              ["RX2 data-rate", `DR${r.rx2Dr}`],
              ["RX2 frequency", fmtFreq(r.rx2Frequency)],
              ["Class-B ping-slot DR", `DR${r.classBPingSlotDr}`],
              ["Class-B ping-slot frequency", fmtFreq(r.classBPingSlotFrequency)],
            ]}
          />
          {r.userInfo && <p className="text-sm text-muted mt-4">{r.userInfo}</p>}
        </Card>
        <DataTable
          rows={r.uplinkChannels.map((c, i) => ({ ...c, i }))}
          rowKey={(c) => String(c.i)}
          columns={[
            { key: "i", header: "Channel", render: (c) => c.i },
            { key: "f", header: "Frequency", render: (c) => <span className="mono">{fmtFreq(c.frequency)}</span> },
            { key: "dr", header: "Data-rates", render: (c) => (c.dataRates.length ? `DR${Math.min(...c.dataRates)} – DR${Math.max(...c.dataRates)}` : "—") },
          ]}
        />
      </div>
    </div>
  );
}
