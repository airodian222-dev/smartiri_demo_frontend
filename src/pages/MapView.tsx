import { useQuery } from "@tanstack/react-query";
import { Map as MapIcon } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import * as api from "@/api/chirpstack";
import { gatewayPoints, PointsMap } from "@/components/GatewayMap";
import { Card, PageHeader, StatusDot } from "@/components/ui";
import { useSession } from "@/context/session";
import { useTheme } from "@/context/theme";
import { timeAgo } from "@/lib/format";
import { useFeed } from "@/lib/hooks";

export default function MapView() {
  const { tenantId } = useSession();
  const { colors } = useTheme();
  const gws = useQuery({ queryKey: ["gateways", tenantId], queryFn: () => api.gateways.list(tenantId!, { limit: 500 }), enabled: !!tenantId });
  const feed = useFeed(200);
  const trackers = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number; name: string; time: string }>();
    for (const e of feed) {
      if (e.tenantId !== tenantId) continue;
      const o = (e.body as { object?: Record<string, number> }).object;
      if (o?.latitude && !m.has(e.devEui)) m.set(e.devEui, { lat: o.latitude, lng: o.longitude, name: e.deviceName, time: e.time });
    }
    return [...m.entries()].map(([id, p]) => ({ id, lat: p.lat, lng: p.lng, label: p.name, sub: `GPS tracker · ${timeAgo(p.time)}`, link: `/devices/${id}`, color: colors.series[1], radius: 6 }));
  }, [feed, tenantId, colors]);
  const list = gws.data?.result ?? [];

  return (
    <div>
      <PageHeader title="Network map" icon={<MapIcon className="h-5 w-5" />} subtitle="Gateway coverage and device positions" />
      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3" bodyClass="p-2">
          <PointsMap points={gatewayPoints(list, colors)} extra={trackers} height="72vh" />
        </Card>
        <div className="space-y-4">
          <Card title="Legend">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: colors.good }} /> Gateway online</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: colors.bad }} /> Gateway offline</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: colors.axis }} /> Gateway never seen</li>
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full ml-0.5" style={{ background: colors.series[1] }} /> Device with GPS position</li>
            </ul>
          </Card>
          <Card title="Gateways" bodyClass="pb-1">
            <ul className="divide-y divide-line">
              {list.map((g) => (
                <li key={g.gatewayId} className="px-4 py-2 flex items-center justify-between gap-2">
                  <Link to={`/gateways/${g.gatewayId}`} className="text-sm font-medium hover:underline truncate">{g.name}</Link>
                  <StatusDot state={g.state} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
