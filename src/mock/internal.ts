import { ApiError } from "@/api/http";
import type * as T from "@/api/types";
import { db, newId, persist } from "./db";
import { gatewayState } from "./simulator";

export function listApiKeys(opts: { isAdmin?: boolean; tenantId?: string }): T.List<T.ApiKey> {
  const result = db.apiKeys
    .filter((k) => (opts.isAdmin ? k.isAdmin : !k.isAdmin && k.tenantId === opts.tenantId))
    .map(({ id, name, isAdmin, tenantId }) => ({ id, name, isAdmin, tenantId }));
  return { totalCount: result.length, result };
}

export function createApiKey(k: Omit<T.ApiKey, "id">) {
  const id = newId();
  db.apiKeys.push({ ...k, id, createdAt: new Date().toISOString() });
  persist();
  const enc = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const token = `${enc({ typ: "JWT", alg: "HS256" })}.${enc({ aud: "chirpstack", iss: "chirpstack", sub: id, typ: "key" })}.${enc({ sig: crypto.randomUUID() })}`;
  return { id, token };
}

export function deleteApiKey(id: string) {
  db.apiKeys = db.apiKeys.filter((k) => k.id !== id);
  persist();
}

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

const REGIONS: T.RegionDetail[] = [
  {
    id: "as923",
    region: "AS923",
    description: "AS923 (Singapore)",
    userInfo: "Default AS923 configuration with 8 uplink channels (923.2 – 922.0 MHz).",
    uplinkChannels: [923200000, 923400000, 922000000, 922200000, 922400000, 922600000, 922800000, 923000000].map((f) => ({ frequency: f, dataRates: [0, 1, 2, 3, 4, 5] })),
    rx1Delay: 1, rx1DrOffset: 0, rx2Dr: 2, rx2Frequency: 923200000, classBPingSlotDr: 3, classBPingSlotFrequency: 923400000,
  },
  {
    id: "eu868",
    region: "EU868",
    description: "EU868",
    userInfo: "",
    uplinkChannels: [868100000, 868300000, 868500000, 867100000, 867300000, 867500000, 867700000, 867900000].map((f) => ({ frequency: f, dataRates: [0, 1, 2, 3, 4, 5] })),
    rx1Delay: 1, rx1DrOffset: 0, rx2Dr: 0, rx2Frequency: 869525000, classBPingSlotDr: 3, classBPingSlotFrequency: 869525000,
  },
  {
    id: "us915_0",
    region: "US915",
    description: "US915 (channels 0-7 + 64)",
    userInfo: "",
    uplinkChannels: [902300000, 902500000, 902700000, 902900000, 903100000, 903300000, 903500000, 903700000].map((f) => ({ frequency: f, dataRates: [0, 1, 2, 3] })),
    rx1Delay: 1, rx1DrOffset: 0, rx2Dr: 8, rx2Frequency: 923300000, classBPingSlotDr: 8, classBPingSlotFrequency: 0,
  },
];

export function listRegions(): T.RegionListItem[] {
  return REGIONS.map(({ id, region, description }) => ({ id, region, description }));
}

export function getRegion(id: string): T.RegionDetail {
  const r = REGIONS.find((x) => x.id === id);
  if (!r) throw new ApiError("Region not found", 404, 5);
  return r;
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
