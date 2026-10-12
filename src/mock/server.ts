/**
 * In-browser implementation of the chirpstack-rest-api routes used by the UI.
 * Request/response JSON follows the grpc-gateway (camelCase) format.
 */
import { ApiError } from "@/api/http";
import type * as T from "@/api/types";
import { db, newId, persist, stamp, type DbDevice } from "./db";
import { deviceLinkMetrics, deviceMetrics, gatewayMetrics } from "./metrics";
import type { SensorKind } from "./sensors";
import { notifyChange, scheduleClassCDownlink, gatewayState } from "./simulator";

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
  db.apiKeys = db.apiKeys.filter((k) => k.tenantId !== p.id);
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
  if (q.multicastGroupId) {
    const ids = db.mcGateways.filter((m) => m.multicastGroupId === q.multicastGroupId).map((m) => m.gatewayId);
    list = list.filter((g) => ids.includes(g.gatewayId));
  }
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
route("POST", "/api/gateways/{id}/generate-certificate", (p) => {
  must(db.gateways.find((x) => x.gatewayId === p.id), "gateway");
  return fakeCert(`gateway ${p.id}`);
});

function fakeCert(cn: string) {
  const b = (n: number) => Array.from({ length: n }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[Math.floor(Math.random() * 64)]).join("");
  const pem = (label: string, lines: number) => `-----BEGIN ${label}-----\n${Array.from({ length: lines }, () => b(64)).join("\n")}\n-----END ${label}-----\n`;
  return {
    tlsCert: `# Subject: CN=${cn} (demo certificate)\n` + pem("CERTIFICATE", 12),
    tlsKey: pem("PRIVATE KEY", 4),
    caCert: pem("CERTIFICATE", 10),
    expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
  };
}

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
  db.multicastGroups = db.multicastGroups.filter((m) => m.applicationId !== p.id);
  db.integrations = db.integrations.filter((i) => i.applicationId !== p.id);
  db.applications = db.applications.filter((a) => a.id !== p.id);
  return {};
});
const SLUG_KIND: Record<string, string> = {
  http: "HTTP", influxdb: "INFLUX_DB", thingsboard: "THINGS_BOARD", mydevices: "MY_DEVICES", "gcp-pub-sub": "GCP_PUB_SUB",
  "aws-sns": "AWS_SNS", "azure-service-bus": "AZURE_SERVICE_BUS", "pilot-things": "PILOT_THINGS", ifttt: "IFTTT", blynk: "BLYNK",
};
route("GET", "/api/applications/{id}/integrations", (p) => {
  const result = db.integrations.filter((i) => i.applicationId === p.id).map((i) => ({ kind: SLUG_KIND[i.slug] }));
  result.push({ kind: "MQTT_GLOBAL" });
  return { totalCount: result.length, result };
});
route("POST", "/api/applications/{id}/integrations/mqtt/certificate", (p) => fakeCert(`application ${p.id}`));
route("GET", "/api/applications/{id}/integrations/{slug}", (p) => {
  const i = must(db.integrations.find((x) => x.applicationId === p.id && x.slug === p.slug), "integration");
  return { integration: { applicationId: p.id, ...i.data } };
});
route("POST", "/api/applications/{id}/integrations/{slug}", (p, _, b) => {
  if (db.integrations.some((x) => x.applicationId === p.id && x.slug === p.slug)) throw conflict("Object already exists (integration)");
  db.integrations.push({ applicationId: p.id, slug: p.slug, data: strip(b.integration, "applicationId") });
  return {};
});
route("PUT", "/api/applications/{id}/integrations/{slug}", (p, _, b) => {
  const i = must(db.integrations.find((x) => x.applicationId === p.id && x.slug === p.slug), "integration");
  i.data = strip(b.integration, "applicationId");
  return {};
});
route("DELETE", "/api/applications/{id}/integrations/{slug}", (p) => {
  db.integrations = db.integrations.filter((x) => !(x.applicationId === p.id && x.slug === p.slug));
  return {};
});

// ------------------------------------------------------------ Device profiles
route("GET", "/api/device-profiles/adr-algorithms", () => ({
  totalCount: 3,
  result: [
    { id: "default", name: "Default ADR algorithm (LoRa only)" },
    { id: "lr_fhss", name: "LR-FHSS only ADR algorithm" },
    { id: "lora_lr_fhss", name: "LoRa & LR-FHSS ADR algorithm" },
  ],
}));
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

// ------------------------------------------------------------ Device profile templates
route("GET", "/api/device-profile-templates", (_, q) =>
  page(
    [...db.templates].sort((a, b) => (a.vendor + a.name).localeCompare(b.vendor + b.name)).map((d) => ({
      id: d.id, createdAt: d.createdAt, updatedAt: d.updatedAt, name: d.name, vendor: d.vendor, firmware: d.firmware, region: d.region,
      macVersion: d.macVersion, regParamsRevision: d.regParamsRevision, supportsOtaa: d.supportsOtaa, supportsClassB: d.supportsClassB, supportsClassC: d.supportsClassC,
    })),
    q,
    (x) => x.vendor + " " + x.name,
  ),
);
route("GET", "/api/device-profile-templates/{id}", (p) => {
  const d = must(db.templates.find((x) => x.id === p.id), "device profile template");
  return { deviceProfileTemplate: strip(d, "createdAt", "updatedAt"), createdAt: d.createdAt, updatedAt: d.updatedAt };
});
route("POST", "/api/device-profile-templates", (_, __, b) => {
  const t = b.deviceProfileTemplate;
  if (!t?.id) throw invalid("id is required");
  if (db.templates.some((x) => x.id === t.id)) throw conflict("Object already exists (device profile template)");
  db.templates.push({ ...t, ...stamp() });
  return {};
});
route("PUT", "/api/device-profile-templates/{id}", (p, _, b) => {
  const d = must(db.templates.find((x) => x.id === p.id), "device profile template");
  Object.assign(d, { ...b.deviceProfileTemplate, id: p.id, updatedAt: now() });
  return {};
});
route("DELETE", "/api/device-profile-templates/{id}", (p) => {
  db.templates = db.templates.filter((x) => x.id !== p.id);
  return {};
});

// ------------------------------------------------------------ Devices
const devOrThrow = (eui: string) => must(db.devices.find((d) => d.devEui === eui), "device");
const profileName = (id: string) => db.deviceProfiles.find((p) => p.id === id)?.name ?? "";

route("GET", "/api/devices", (_, q) => {
  if (!q.applicationId && !q.multicastGroupId) throw invalid("application_id is required");
  let list = db.devices;
  if (q.applicationId) list = list.filter((d) => d.applicationId === q.applicationId);
  if (q.multicastGroupId) {
    const euis = db.mcDevices.filter((m) => m.multicastGroupId === q.multicastGroupId).map((m) => m.devEui);
    list = list.filter((d) => euis.includes(d.devEui));
  }
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
  db.queue = db.queue.filter((q) => q.devEui !== p.eui);
  db.mcDevices = db.mcDevices.filter((m) => m.devEui !== p.eui);
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
  return {};
};
route("POST", "/api/devices/{eui}/keys", upsertKeys);
route("PUT", "/api/devices/{eui}/keys", upsertKeys);
route("DELETE", "/api/devices/{eui}/keys", (p) => {
  delete db.deviceKeys[p.eui];
  return {};
});
route("DELETE", "/api/devices/{eui}/dev-nonces", () => ({}));
route("GET", "/api/devices/{eui}/activation", (p) => {
  devOrThrow(p.eui);
  const a = db.activations[p.eui];
  return a ? { deviceActivation: a } : {};
});
route("POST", "/api/devices/{eui}/activate", (p, _, b) => {
  const d = devOrThrow(p.eui);
  db.activations[p.eui] = { ...b.deviceActivation, devEui: p.eui };
  d.fCntUp = b.deviceActivation.fCntUp ?? 0;
  if (!d.isDisabled) d.simulated = true;
  return {};
});
route("DELETE", "/api/devices/{eui}/activation", (p) => {
  const d = devOrThrow(p.eui);
  delete db.activations[p.eui];
  d.simulated = false;
  return {};
});
route("POST", "/api/devices/{eui}/get-random-dev-addr", () => ({
  devAddr: "26" + Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
}));
route("GET", "/api/devices/{eui}/metrics", (p, q) => deviceMetrics(devOrThrow(p.eui), q as any)); // eslint-disable-line @typescript-eslint/no-explicit-any
route("GET", "/api/devices/{eui}/link-metrics", (p, q) => {
  const d = devOrThrow(p.eui);
  const dp = db.deviceProfiles.find((x) => x.id === d.deviceProfileId);
  return deviceLinkMetrics(d, dp?.uplinkInterval ?? 600, q as any); // eslint-disable-line @typescript-eslint/no-explicit-any
});
route("GET", "/api/devices/{eui}/queue", (p) => {
  devOrThrow(p.eui);
  const items = db.queue.filter((q) => q.devEui === p.eui).map((q) => strip(q, "createdAt"));
  return { totalCount: items.length, result: items };
});
route("POST", "/api/devices/{eui}/queue", (p, _, b) => {
  const d = devOrThrow(p.eui);
  const qi = b.queueItem as T.DeviceQueueItem;
  if (!qi.fPort || qi.fPort < 1 || qi.fPort > 223) throw invalid("FPort must be between 1 and 223");
  let data = qi.data;
  if (!data && qi.object) data = btoa(JSON.stringify(qi.object));
  const item = { id: newId(), devEui: p.eui, confirmed: !!qi.confirmed, fPort: qi.fPort, data, object: qi.object, isPending: false, createdAt: now(), expiresAt: qi.expiresAt };
  db.queue.push(item);
  scheduleClassCDownlink(d);
  return { id: item.id };
});
route("DELETE", "/api/devices/{eui}/queue", (p) => {
  db.queue = db.queue.filter((q) => q.devEui !== p.eui);
  return {};
});
route("POST", "/api/devices/{eui}/get-next-f-cnt-down", (p) => ({ fCntDown: db.activations[p.eui]?.aFCntDown ?? 0 }));

// ------------------------------------------------------------ Multicast groups
route("GET", "/api/multicast-groups", (_, q) =>
  page(
    db.multicastGroups.filter((m) => m.applicationId === q.applicationId).sort(byName).map((m) => ({ id: m.id, createdAt: m.createdAt, updatedAt: m.updatedAt, name: m.name, region: m.region, groupType: m.groupType })),
    q,
  ),
);
route("GET", "/api/multicast-groups/{id}", (p) => {
  const m = must(db.multicastGroups.find((x) => x.id === p.id), "multicast group");
  return { multicastGroup: strip(m, "createdAt", "updatedAt"), createdAt: m.createdAt, updatedAt: m.updatedAt };
});
route("POST", "/api/multicast-groups", (_, __, b) => {
  const m = { ...b.multicastGroup, id: newId(), ...stamp() };
  db.multicastGroups.push(m);
  return { id: m.id };
});
route("PUT", "/api/multicast-groups/{id}", (p, _, b) => {
  const m = must(db.multicastGroups.find((x) => x.id === p.id), "multicast group");
  Object.assign(m, { ...b.multicastGroup, id: p.id, updatedAt: now() });
  return {};
});
route("DELETE", "/api/multicast-groups/{id}", (p) => {
  db.multicastGroups = db.multicastGroups.filter((x) => x.id !== p.id);
  db.mcDevices = db.mcDevices.filter((x) => x.multicastGroupId !== p.id);
  db.mcGateways = db.mcGateways.filter((x) => x.multicastGroupId !== p.id);
  return {};
});
route("POST", "/api/multicast-groups/{id}/devices", (p, _, b) => {
  devOrThrow(b.devEui);
  if (!db.mcDevices.some((x) => x.multicastGroupId === p.id && x.devEui === b.devEui)) db.mcDevices.push({ multicastGroupId: p.id, devEui: b.devEui });
  return {};
});
route("DELETE", "/api/multicast-groups/{id}/devices/{eui}", (p) => {
  db.mcDevices = db.mcDevices.filter((x) => !(x.multicastGroupId === p.id && x.devEui === p.eui));
  return {};
});
route("POST", "/api/multicast-groups/{id}/gateways", (p, _, b) => {
  must(db.gateways.find((g) => g.gatewayId === b.gatewayId), "gateway");
  if (!db.mcGateways.some((x) => x.multicastGroupId === p.id && x.gatewayId === b.gatewayId)) db.mcGateways.push({ multicastGroupId: p.id, gatewayId: b.gatewayId });
  return {};
});
route("DELETE", "/api/multicast-groups/{id}/gateways/{gw}", (p) => {
  db.mcGateways = db.mcGateways.filter((x) => !(x.multicastGroupId === p.id && x.gatewayId === p.gw));
  return {};
});
route("GET", "/api/multicast-groups/{id}/queue", (p) => ({ items: db.mcQueue.filter((x) => x.multicastGroupId === p.id) }));
route("POST", "/api/multicast-groups/{id}/queue", (p, _, b) => {
  const m = must(db.multicastGroups.find((x) => x.id === p.id), "multicast group");
  const fCnt = m.fCnt ?? 0;
  m.fCnt = fCnt + 1;
  db.mcQueue.push({ multicastGroupId: p.id, fCnt, fPort: b.queueItem.fPort, data: b.queueItem.data });
  return { fCnt };
});
route("DELETE", "/api/multicast-groups/{id}/queue", (p) => {
  db.mcQueue = db.mcQueue.filter((x) => x.multicastGroupId !== p.id);
  return {};
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
