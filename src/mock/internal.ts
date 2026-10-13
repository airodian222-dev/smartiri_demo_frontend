import type * as T from "@/api/types";
import { db } from "./db";
import { gatewayState } from "./simulator";

function tenantOf(appId: string) {
  return db.applications.find((a) => a.id === appId)?.tenantId;
}

export function devicesSummary(tenantId?: string): T.DevicesSummary {
  const devs = db.devices.filter((d) => !tenantId || tenantOf(d.applicationId) === tenantId);
  const out: T.DevicesSummary = { activeCount: 0, inactiveCount: 0, neverSeenCount: 0, drCount: {} };
  for (const d of devs) {
    if (!d.lastSeenAt) {
      out.neverSeenCount++;
      continue;
    }
    const dp = db.deviceProfiles.find((p) => p.id === d.deviceProfileId);
    const window = Math.max(dp?.uplinkInterval ?? 3600, 600) * 2 * 1000;
    if (Date.now() - new Date(d.lastSeenAt).getTime() < window) out.activeCount++;
    else out.inactiveCount++;
    if (d.dr !== undefined) out.drCount[String(d.dr)] = (out.drCount[String(d.dr)] ?? 0) + 1;
  }
  return out;
}

export function gatewaysSummary(tenantId?: string): T.GatewaysSummary {
  const out = { onlineCount: 0, offlineCount: 0, neverSeenCount: 0 };
  for (const g of db.gateways.filter((x) => !tenantId || x.tenantId === tenantId)) {
    const s = gatewayState(g);
    if (s === "ONLINE") out.onlineCount++;
    else if (s === "OFFLINE") out.offlineCount++;
    else out.neverSeenCount++;
  }
  return out;
}

export function profile(): T.Profile {
  const admin = db.users.find((u) => u.isAdmin) ?? db.users[0];
  return {
    user: { id: admin.id, email: admin.email, isAdmin: admin.isAdmin, isActive: admin.isActive, note: admin.note },
    tenants: db.tenantUsers.filter((t) => t.userId === admin.id),
  };
}

export function globalSearch(q: string): T.GlobalSearchResult[] {
  const s = q.toLowerCase().trim();
  if (!s) return [];
  const out: T.GlobalSearchResult[] = [];
  for (const t of db.tenants) if (t.name.toLowerCase().includes(s)) out.push({ kind: "tenant", tenantId: t.id, tenantName: t.name });
  for (const a of db.applications)
    if (a.name.toLowerCase().includes(s)) out.push({ kind: "application", tenantId: a.tenantId, applicationId: a.id, applicationName: a.name });
  for (const g of db.gateways)
    if (g.name.toLowerCase().includes(s) || g.gatewayId.includes(s)) out.push({ kind: "gateway", tenantId: g.tenantId, gatewayId: g.gatewayId, gatewayName: g.name });
  for (const d of db.devices)
    if (d.name.toLowerCase().includes(s) || d.devEui.includes(s)) {
      const a = db.applications.find((x) => x.id === d.applicationId);
      out.push({ kind: "device", tenantId: a?.tenantId, applicationId: a?.id, applicationName: a?.name, deviceDevEui: d.devEui, deviceName: d.name });
    }
  return out.slice(0, 20);
}
