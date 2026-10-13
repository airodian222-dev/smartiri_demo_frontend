import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import type { GatewayListItem } from "@/api/types";
import { useTheme } from "@/context/theme";
import { timeAgo } from "@/lib/format";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sub?: string;
  link?: string;
  color?: string;
  radius?: number;
  pulse?: boolean;
}

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join("|");
  useEffect(() => {
    if (!points.length) return;
    map.invalidateSize();
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 13, { animate: false });
    else map.fitBounds(points.map((p) => [p.lat, p.lng]) as [number, number][], { padding: [36, 36], maxZoom: 15, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export function gatewayPoints(gws: GatewayListItem[], colors: { good: string; bad: string; axis: string }): MapPoint[] {
  return gws
    .filter((g) => g.location?.latitude && g.location?.longitude)
    .map((g) => ({
      id: g.gatewayId,
      lat: g.location!.latitude!,
      lng: g.location!.longitude!,
      label: g.name,
      sub: `${g.state === "ONLINE" ? "Online" : g.state === "OFFLINE" ? "Offline" : "Never seen"} · last seen ${timeAgo(g.lastSeenAt)}`,
      link: `/gateways/${g.gatewayId}`,
      color: g.state === "ONLINE" ? colors.good : g.state === "OFFLINE" ? colors.bad : colors.axis,
      radius: 8,
      pulse: g.state === "ONLINE",
    }));
}

export function PointsMap({ points, height = 320, extra }: { points: MapPoint[]; height?: number | string; extra?: MapPoint[] }) {
  const { colors, dark } = useTheme();
  const all = [...points, ...(extra ?? [])];
  const tiles = `https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`;
  return (
    <div style={{ height }} className="relative z-0">
      <MapContainer center={[1.3521, 103.8198]} zoom={11} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer key={tiles} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' url={tiles} />
        <FitBounds points={all} />
        {(extra ?? []).map((p) => (
          <CircleMarker key={`x-${p.id}`} center={[p.lat, p.lng]} radius={p.radius ?? 5} pathOptions={{ color: dark ? "#0b1024" : "#ffffff", weight: 2, fillColor: p.color ?? colors.series[1], fillOpacity: 0.95 }}>
            <Tooltip>{p.label}</Tooltip>
            <Popup>
              <div className="text-sm font-medium">{p.link ? <Link to={p.link}>{p.label}</Link> : p.label}</div>
              {p.sub && <div className="text-xs opacity-70">{p.sub}</div>}
            </Popup>
          </CircleMarker>
        ))}
        {points.filter((p) => p.pulse).map((p) => (
          <CircleMarker key={`p-${p.id}`} center={[p.lat, p.lng]} radius={(p.radius ?? 8) + 4} interactive={false} pathOptions={{ stroke: false, fillColor: p.color ?? colors.series[0], fillOpacity: 0.5, className: "pulse-marker" }} />
        ))}
        {points.map((p) => (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={p.radius ?? 8} pathOptions={{ color: dark ? "#0b1024" : "#ffffff", weight: 3, fillColor: p.color ?? colors.series[0], fillOpacity: 1 }}>
            <Tooltip>{p.label}</Tooltip>
            <Popup>
              <div className="text-sm font-medium">{p.link ? <Link to={p.link}>{p.label}</Link> : p.label}</div>
              {p.sub && <div className="text-xs opacity-70">{p.sub}</div>}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
