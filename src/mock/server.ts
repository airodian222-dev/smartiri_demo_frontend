/**
 * In-browser implementation of the chirpstack-rest-api routes used by the UI.
 * Request/response JSON follows the grpc-gateway (camelCase) format.
 */
import { ApiError } from "@/api/http";
import type * as T from "@/api/types";
import { db, newId, persist, stamp, type DbDevice } from "./db";
import { deviceLinkMetrics, deviceMetrics, gatewayMetrics } from "./metrics";
import type { SensorKind } from "./sensors";
import { gatewayState, kickDevice, notifyChange } from "./simulator";

type Q = Record<string, string | number | boolean | undefined | null>;
type Handler = (p: Record<string, string>, q: Q, body: any) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

const routes: { method: string; re: RegExp; keys: string[]; h: Handler }[] = [];
function route(method: string, path: string, h: Handler) {
  const keys: string[] = [];
  const re = new RegExp(
    "^" +
      path.replace(/\{(\w+)\}/g, (_, k) => {
        keys.push(k);
        return "([^/]+)";
      }) +
      "$",
  );
  routes.push({ method, re, keys, h });
}

const notFound = (what: string) => new ApiError(`Object does not exist (${what})`, 404, 5);
const invalid = (msg: string) => new ApiError(msg, 400, 3);
const conflict = (msg: string) => new ApiError(msg, 409, 6);
const now = () => new Date().toISOString();

function page<X>(items: X[], q: Q, nameOf: (x: X) => string = (x: any) => x.name): T.List<X> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const search = String(q.search ?? "").toLowerCase();
  const filtered = search ? items.filter((x) => nameOf(x).toLowerCase().includes(search)) : items;
  const offset = Number(q.offset ?? 0);
  const limit = Number(q.limit ?? 100);
  return { totalCount: filtered.length, result: filtered.slice(offset, offset + limit) };
}
const byName = <X extends { name: string }>(a: X, b: X) => a.name.localeCompare(b.name);
const strip = <O extends object>(o: O, ...keys: string[]) => {
  const c: any = { ...o }; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const k of keys) delete c[k];
  return c;
};
function must<X>(x: X | undefined, what: string): X {
  if (!x) throw notFound(what);
  return x;
}

// ------------------------------------------------------------ Tenants
route("GET", "/api/tenants", (_, q) =>
  page(
    [...db.tenants].sort(byName).map((t) => ({
      id: t.id, createdAt: t.createdAt, updatedAt: t.updatedAt, name: t.name, canHaveGateways: t.canHaveGateways,
      privateGatewaysUp: t.privateGatewaysUp, privateGatewaysDown: t.privateGatewaysDown,
      maxGatewayCount: t.maxGatewayCount, maxDeviceCount: t.maxDeviceCount,
    })),
    q,
  ),
);
route("GET", "/api/tenants/{id}", (p) => {
  const t = must(db.tenants.find((x) => x.id === p.id), "tenant");
  return { tenant: strip(t, "createdAt", "updatedAt"), createdAt: t.createdAt, updatedAt: t.updatedAt };
});
route("POST", "/api/tenants", (_, __, b) => {
  if (!b?.tenant?.name) throw invalid("name is required");
  const t = { ...b.tenant, id: newId(), ...stamp() };
  db.tenants.push(t);
  return { id: t.id };
});
route("PUT", "/api/tenants/{id}", (p, _, b) => {
  const i = db.tenants.findIndex((x) => x.id === p.id);
  if (i < 0) throw notFound("tenant");
  db.tenants[i] = { ...db.tenants[i], ...b.tenant, id: p.id, updatedAt: now() };
  return {};
});
route("DELETE", "/api/tenants/{id}", (p) => {
  must(db.tenants.find((x) => x.id === p.id), "tenant");
  const apps = db.applications.filter((a) => a.tenantId === p.id).map((a) => a.id);
  db.devices = db.devices.filter((d) => !apps.includes(d.applicationId));
  db.applications = db.applications.filter((a) => a.tenantId !== p.id);
  db.gateways = db.gateways.filter((g) => g.tenantId !== p.id);
  db.deviceProfiles = db.deviceProfiles.filter((d) => d.tenantId !== p.id);
  db.tenantUsers = db.tenantUsers.filter((u) => u.tenantId !== p.id);
  db.tenants = db.tenants.filter((x) => x.id !== p.id);
  return {};
});
route("GET", "/api/tenants/{id}/users", (p, q) => {
  const list = db.tenantUsers
    .filter((u) => u.tenantId === p.id)
    .map((tu) => {
      const u = db.users.find((x) => x.id === tu.userId);
      return { ...tu, email: u?.email ?? "?" };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
  return page(list, q, (x) => x.email);
});
route("GET", "/api/tenants/{id}/users/{userId}", (p) => {
  const tu = must(db.tenantUsers.find((u) => u.tenantId === p.id && u.userId === p.userId), "tenant user");
  const u = db.users.find((x) => x.id === tu.userId);
  return { tenantUser: { ...strip(tu, "createdAt", "updatedAt"), email: u?.email }, createdAt: tu.createdAt, updatedAt: tu.updatedAt };
});
route("POST", "/api/tenants/{id}/users", (p, _, b) => {
  const tu = b.tenantUser as T.TenantUser;
  let u = db.users.find((x) => x.email === tu.email);
  if (!u) throw notFound(`user with email ${tu.email}`);
  if (db.tenantUsers.some((x) => x.tenantId === p.id && x.userId === u!.id)) throw conflict("User is already a member of this tenant");
  db.tenantUsers.push({ tenantId: p.id, userId: u.id, isAdmin: !!tu.isAdmin, isDeviceAdmin: !!tu.isDeviceAdmin, isGatewayAdmin: !!tu.isGatewayAdmin, ...stamp() });
  return {};
});
route("PUT", "/api/tenants/{id}/users/{userId}", (p, _, b) => {
  const tu = must(db.tenantUsers.find((u) => u.tenantId === p.id && u.userId === p.userId), "tenant user");
  Object.assign(tu, { isAdmin: !!b.tenantUser.isAdmin, isDeviceAdmin: !!b.tenantUser.isDeviceAdmin, isGatewayAdmin: !!b.tenantUser.isGatewayAdmin, updatedAt: now() });
  return {};
});
route("DELETE", "/api/tenants/{id}/users/{userId}", (p) => {
  db.tenantUsers = db.tenantUsers.filter((u) => !(u.tenantId === p.id && u.userId === p.userId));
  return {};
});

// ------------------------------------------------------------ Users
route("GET", "/api/users", (_, q) =>
  page(
    [...db.users].sort((a, b) => a.email.localeCompare(b.email)).map((u) => ({ id: u.id, createdAt: u.createdAt, updatedAt: u.updatedAt, email: u.email, isAdmin: u.isAdmin, isActive: u.isActive })),
    q,
    (x) => x.email,
  ),
);
route("GET", "/api/users/{id}", (p) => {
  const u = must(db.users.find((x) => x.id === p.id), "user");
  return { user: { id: u.id, email: u.email, isAdmin: u.isAdmin, isActive: u.isActive, note: u.note }, createdAt: u.createdAt, updatedAt: u.updatedAt };
});
route("POST", "/api/users", (_, __, b) => {
  if (!b.user?.email) throw invalid("email is required");
  if (db.users.some((u) => u.email === b.user.email)) throw conflict("Object already exists (user)");
  const u = { ...b.user, id: newId(), password: b.password, ...stamp() };
  db.users.push(u);
  for (const t of b.tenants ?? []) db.tenantUsers.push({ tenantId: t.tenantId, userId: u.id, isAdmin: !!t.isAdmin, isDeviceAdmin: !!t.isDeviceAdmin, isGatewayAdmin: !!t.isGatewayAdmin, ...stamp() });
  return { id: u.id };
});
route("PUT", "/api/users/{id}", (p, _, b) => {
  const u = must(db.users.find((x) => x.id === p.id), "user");
  Object.assign(u, { email: b.user.email, isAdmin: !!b.user.isAdmin, isActive: !!b.user.isActive, note: b.user.note ?? "", updatedAt: now() });
  return {};
});
route("DELETE", "/api/users/{id}", (p) => {
  db.users = db.users.filter((u) => u.id !== p.id);
  db.tenantUsers = db.tenantUsers.filter((u) => u.userId !== p.id);
  return {};
});
route("POST", "/api/users/{id}/password", (p, _, b) => {
  const u = must(db.users.find((x) => x.id === p.id), "user");
  u.password = b.password;
  return {};
});

// ------------------------------------------------------------ Gateways
route("GET", "/api/gateways", (_, q) => {
  let list = db.gateways;
  if (q.tenantId) list = list.filter((g) => g.tenantId === q.tenantId);
  return page(
    [...list].sort(byName).map((g) => ({
      tenantId: g.tenantId, gatewayId: g.gatewayId, name: g.name, description: g.description, location: g.location,
      properties: g.metadata, createdAt: g.createdAt, updatedAt: g.updatedAt, lastSeenAt: g.lastSeenAt, state: gatewayState(g),
    })),
    q,
    (x) => x.name + " " + x.gatewayId,
  );
});
route("GET", "/api/gateways/{id}", (p) => {
  const g = must(db.gateways.find((x) => x.gatewayId === p.id), "gateway");
  return { gateway: strip(g, "createdAt", "updatedAt", "lastSeenAt", "simulated"), createdAt: g.createdAt, updatedAt: g.updatedAt, lastSeenAt: g.lastSeenAt };
});
route("POST", "/api/gateways", (_, __, b) => {
  const g = b.gateway as T.Gateway;
  if (!/^[0-9a-fA-F]{16}$/.test(g.gatewayId ?? "")) throw invalid("Gateway ID must be 8 bytes HEX (EUI64)");
  if (db.gateways.some((x) => x.gatewayId === g.gatewayId.toLowerCase())) throw conflict("Object already exists (gateway)");
  db.gateways.push({ ...g, gatewayId: g.gatewayId.toLowerCase(), statsInterval: g.statsInterval || 30, ...stamp(), simulated: false });
  return {};
});
route("PUT", "/api/gateways/{id}", (p, _, b) => {
  const g = must(db.gateways.find((x) => x.gatewayId === p.id), "gateway");
  Object.assign(g, { ...b.gateway, gatewayId: p.id, updatedAt: now() });
  return {};
});
route("DELETE", "/api/gateways/{id}", (p) => {
  db.gateways = db.gateways.filter((x) => x.gatewayId !== p.id);
  return {};
});
route("GET", "/api/gateways/{id}/metrics", (p, q) => {
  const g = must(db.gateways.find((x) => x.gatewayId === p.id), "gateway");
  const devs = db.devices.filter((d) => db.applications.find((a) => a.id === d.applicationId)?.tenantId === g.tenantId && d.simulated).length;
  return gatewayMetrics(g, devs, q as any); // eslint-disable-line @typescript-eslint/no-explicit-any
});
// ------------------------------------------------------------ Applications
route("GET", "/api/applications", (_, q) => {
  if (!q.tenantId) throw invalid("tenant_id is required");
  return page(
    db.applications.filter((a) => a.tenantId === q.tenantId).sort(byName).map((a) => ({ id: a.id, createdAt: a.createdAt, updatedAt: a.updatedAt, name: a.name, description: a.description })),
    q,
  );
});
route("GET", "/api/applications/{id}", (p) => {
  const a = must(db.applications.find((x) => x.id === p.id), "application");
  const keys = new Set<string>();
  for (const d of db.devices.filter((x) => x.applicationId === a.id)) {
    const dp = db.deviceProfiles.find((x) => x.id === d.deviceProfileId);
    Object.keys(dp?.measurements ?? {}).forEach((k) => keys.add(k));
  }
  return { application: strip(a, "createdAt", "updatedAt"), createdAt: a.createdAt, updatedAt: a.updatedAt, measurementKeys: [...keys] };
});
route("POST", "/api/applications", (_, __, b) => {
  if (!b.application?.name) throw invalid("name is required");
  const a = { ...b.application, id: newId(), ...stamp() };
  db.applications.push(a);
  return { id: a.id };
});
route("PUT", "/api/applications/{id}", (p, _, b) => {
  const a = must(db.applications.find((x) => x.id === p.id), "application");
  Object.assign(a, { ...b.application, id: p.id, updatedAt: now() });
  return {};
});
route("DELETE", "/api/applications/{id}", (p) => {
  db.devices = db.devices.filter((d) => d.applicationId !== p.id);
  db.applications = db.applications.filter((a) => a.id !== p.id);
  return {};
});
// ------------------------------------------------------------ Device profiles
route("GET", "/api/device-profiles", (_, q) => {
  if (!q.tenantId) throw invalid("tenant_id is required");
  return page(
    db.deviceProfiles.filter((d) => d.tenantId === q.tenantId).sort(byName).map((d) => ({
      id: d.id, createdAt: d.createdAt, updatedAt: d.updatedAt, name: d.name, region: d.region, macVersion: d.macVersion,
      regParamsRevision: d.regParamsRevision, supportsOtaa: d.supportsOtaa, supportsClassB: d.supportsClassB, supportsClassC: d.supportsClassC,
    })),
    q,
  );
});
route("GET", "/api/device-profiles/{id}", (p) => {
  const d = must(db.deviceProfiles.find((x) => x.id === p.id), "device profile");
  return { deviceProfile: strip(d, "createdAt", "updatedAt"), createdAt: d.createdAt, updatedAt: d.updatedAt };
});
route("POST", "/api/device-profiles", (_, __, b) => {
  if (!b.deviceProfile?.name) throw invalid("name is required");
  const d = { ...b.deviceProfile, id: newId(), ...stamp() };
  db.deviceProfiles.push(d);
  return { id: d.id };
});
route("PUT", "/api/device-profiles/{id}", (p, _, b) => {
  const d = must(db.deviceProfiles.find((x) => x.id === p.id), "device profile");
  Object.assign(d, { ...b.deviceProfile, id: p.id, updatedAt: now() });
  return {};
});
route("DELETE", "/api/device-profiles/{id}", (p) => {
  if (db.devices.some((d) => d.deviceProfileId === p.id)) throw new ApiError("Device profile is still in use by one or more devices", 400, 9);
  db.deviceProfiles = db.deviceProfiles.filter((x) => x.id !== p.id);
  return {};
});

// ------------------------------------------------------------ Devices
const devOrThrow = (eui: string) => must(db.devices.find((d) => d.devEui === eui), "device");
const profileName = (id: string) => db.deviceProfiles.find((p) => p.id === id)?.name ?? "";

route("GET", "/api/devices", (_, q) => {
  if (!q.applicationId) throw invalid("application_id is required");
  const list = db.devices.filter((d) => d.applicationId === q.applicationId);
  return page(
    [...list].sort(byName).map((d) => ({
      devEui: d.devEui, createdAt: d.createdAt, updatedAt: d.updatedAt, lastSeenAt: d.lastSeenAt, name: d.name, description: d.description,
      deviceProfileId: d.deviceProfileId, deviceProfileName: profileName(d.deviceProfileId), deviceStatus: d.deviceStatus, tags: d.tags,
    })),
    q,
    (x) => x.name + " " + x.devEui,
  );
});
route("GET", "/api/devices/{eui}", (p) => {
  const d = devOrThrow(p.eui);
  const dp = db.deviceProfiles.find((x) => x.id === d.deviceProfileId);
  return {
    device: strip(d, "createdAt", "updatedAt", "lastSeenAt", "deviceStatus", "sensor", "simulated", "dr", "fCntUp"),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    lastSeenAt: d.lastSeenAt,
    deviceStatus: d.deviceStatus,
    classEnabled: dp?.supportsClassC ? "CLASS_C" : dp?.supportsClassB ? "CLASS_B" : "CLASS_A",
  };
});
route("POST", "/api/devices", (_, __, b) => {
  const d = b.device as T.Device;
  if (!/^[0-9a-fA-F]{16}$/.test(d.devEui ?? "")) throw invalid("DevEUI must be 8 bytes HEX");
  if (db.devices.some((x) => x.devEui === d.devEui.toLowerCase())) throw conflict("Object already exists (device)");
  const dp = db.deviceProfiles.find((x) => x.id === d.deviceProfileId);
  const sensor = (dp?.tags?.sensor as SensorKind) || "env";
  const dev: DbDevice = { ...d, devEui: d.devEui.toLowerCase(), ...stamp(), sensor, simulated: false, fCntUp: 0 };
  db.devices.push(dev);
  return {};
});
route("PUT", "/api/devices/{eui}", (p, _, b) => {
  const d = devOrThrow(p.eui);
  Object.assign(d, { ...b.device, devEui: p.eui, updatedAt: now() });
  if (d.isDisabled) d.simulated = false;
  else if (db.activations[p.eui]) d.simulated = true;
  return {};
});
route("DELETE", "/api/devices/{eui}", (p) => {
  devOrThrow(p.eui);
  db.devices = db.devices.filter((d) => d.devEui !== p.eui);
  delete db.deviceKeys[p.eui];
  delete db.activations[p.eui];
  return {};
});
route("GET", "/api/devices/{eui}/keys", (p) => {
  devOrThrow(p.eui);
  const k = must(db.deviceKeys[p.eui], "device keys");
  return { deviceKeys: strip(k, "createdAt", "updatedAt"), createdAt: k.createdAt, updatedAt: k.updatedAt };
});
const upsertKeys = (p: Record<string, string>, _q: Q, b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  devOrThrow(p.eui);
  const prev = db.deviceKeys[p.eui];
  db.deviceKeys[p.eui] = { ...b.deviceKeys, devEui: p.eui, createdAt: prev?.createdAt ?? now(), updatedAt: now() };
  // Demo: a device with a join key "joins" the network and starts reporting.
  const d = devOrThrow(p.eui);
  if (!db.activations[p.eui]) {
    const hex = (n: number) => Array.from({ length: n * 2 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    db.activations[p.eui] = { devEui: p.eui, devAddr: "26" + hex(3), appSKey: hex(16), nwkSEncKey: hex(16), sNwkSIntKey: hex(16), fNwkSIntKey: hex(16), fCntUp: 0, nFCntDown: 0, aFCntDown: 0 };
  }
  if (!d.isDisabled && !d.simulated) {
    d.simulated = true;
    kickDevice(d);
  }
  return {};
};
route("POST", "/api/devices/{eui}/keys", upsertKeys);
route("PUT", "/api/devices/{eui}/keys", upsertKeys);
route("DELETE", "/api/devices/{eui}/keys", (p) => {
  delete db.deviceKeys[p.eui];
  return {};
});
route("GET", "/api/devices/{eui}/metrics", (p, q) => deviceMetrics(devOrThrow(p.eui), q as any)); // eslint-disable-line @typescript-eslint/no-explicit-any
route("GET", "/api/devices/{eui}/link-metrics", (p, q) => {
  const d = devOrThrow(p.eui);
  const dp = db.deviceProfiles.find((x) => x.id === d.deviceProfileId);
  return deviceLinkMetrics(d, dp?.uplinkInterval ?? 600, q as any); // eslint-disable-line @typescript-eslint/no-explicit-any
});
// ------------------------------------------------------------ Dispatcher
export async function handleMock<R>(method: string, path: string, query: Q, body: unknown): Promise<R> {
  await new Promise((r) => setTimeout(r, 60 + Math.random() * 120));
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    const result = r.h(params, query, body ? JSON.parse(JSON.stringify(body)) : undefined);
    if (method !== "GET") {
      persist();
      notifyChange();
    }
    return JSON.parse(JSON.stringify(result ?? {})) as R;
  }
  throw new ApiError(`Not implemented in demo: ${method} ${path}`, 501, 12);
}
