import type * as T from "@/api/types";
import { CODEC_SCRIPT, SENSOR_MODELS, mulberry32, type SensorKind } from "./sensors";

type Stamped = { createdAt: string; updatedAt: string };

export type DbTenant = Required<Pick<T.Tenant, "id">> & T.Tenant & Stamped;
export type DbUser = T.User & { id: string; password: string } & Stamped;
export type DbTenantUser = {
  tenantId: string;
  userId: string;
  isAdmin: boolean;
  isDeviceAdmin: boolean;
  isGatewayAdmin: boolean;
} & Stamped;
export type DbGateway = T.Gateway & Stamped & { lastSeenAt?: string; simulated: boolean };
export type DbApplication = T.Application & { id: string } & Stamped;
export type DbDeviceProfile = T.DeviceProfile & { id: string } & Stamped;
export type DbDevice = T.Device &
  Stamped & {
    lastSeenAt?: string;
    deviceStatus?: T.DeviceStatus;
    sensor: SensorKind;
    simulated: boolean;
    dr?: number;
    fCntUp: number;
  };
export type DbKeys = T.DeviceKeys & Stamped;

export interface DB {
  version: number;
  tenants: DbTenant[];
  users: DbUser[];
  tenantUsers: DbTenantUser[];
  gateways: DbGateway[];
  applications: DbApplication[];
  deviceProfiles: DbDeviceProfile[];
  devices: DbDevice[];
  deviceKeys: Record<string, DbKeys>;
  activations: Record<string, T.DeviceActivation>;
}

const STORAGE_KEY = "smartiri.mockdb.v2";
const DB_VERSION = 2;

const now = () => new Date().toISOString();
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const H = 3_600_000;
const D = 24 * H;

function uuid(rnd: () => number): string {
  const h = Array.from({ length: 32 }, () => Math.floor(rnd() * 16).toString(16));
  h[12] = "4";
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

function hex(rnd: () => number, bytes: number): string {
  return Array.from({ length: bytes * 2 }, () => Math.floor(rnd() * 16).toString(16)).join("");
}

function measurementsFor(kind: SensorKind): Record<string, T.Measurement> {
  const out: Record<string, T.Measurement> = {};
  for (const m of SENSOR_MODELS[kind].measurements) out[m.key] = { name: m.name, kind: m.kind };
  return out;
}

function seed(): DB {
  const rnd = mulberry32(20261012);
  const id = () => uuid(rnd);
  const created = ago(120 * D);

  const t1: DbTenant = {
    id: "52f14cd4-c6f1-4fbd-8f87-4025e1d49242",
    name: "SmartIRI Demo",
    description: "Primary tenant for the SmartIRI city & campus IoT network.",
    canHaveGateways: true,
    maxGatewayCount: 0,
    maxDeviceCount: 0,
    privateGatewaysUp: false,
    privateGatewaysDown: false,
    tags: { region: "APAC", plan: "enterprise" },
    createdAt: created,
    updatedAt: ago(10 * D),
  };
  const t2: DbTenant = {
    id: id(),
    name: "Urban Farm Pilot",
    description: "Pilot tenant for an agriculture partner.",
    canHaveGateways: true,
    maxGatewayCount: 5,
    maxDeviceCount: 50,
    privateGatewaysUp: true,
    privateGatewaysDown: true,
    tags: { plan: "pilot" },
    createdAt: ago(40 * D),
    updatedAt: ago(5 * D),
  };

  const users: DbUser[] = [
    { id: id(), email: "admin", isAdmin: true, isActive: true, note: "Default ChirpStack administrator", password: "admin", createdAt: created, updatedAt: created },
    { id: id(), email: "ops@smartiri.io", isAdmin: false, isActive: true, note: "Network operations", password: "demo", createdAt: ago(60 * D), updatedAt: ago(60 * D) },
    { id: id(), email: "field.tech@smartiri.io", isAdmin: false, isActive: true, note: "", password: "demo", createdAt: ago(30 * D), updatedAt: ago(30 * D) },
    { id: id(), email: "agri@partner.example", isAdmin: false, isActive: false, note: "Disabled until pilot contract renewal", password: "demo", createdAt: ago(35 * D), updatedAt: ago(2 * D) },
  ];
  const tu = (tenantId: string, userId: string, a: boolean, d: boolean, g: boolean): DbTenantUser => ({
    tenantId, userId, isAdmin: a, isDeviceAdmin: d, isGatewayAdmin: g, createdAt: ago(20 * D), updatedAt: ago(20 * D),
  });

  // Gateways around Singapore (AS923)
  const gwDefs: [string, string, number, number, string][] = [
    ["Campus North Rooftop", "Kent Ridge campus, Block E1 roof", 1.2989, 103.7713, "online"],
    ["Jurong Innovation", "JTC Cleantech Park", 1.3482, 103.6957, "online"],
    ["CBD Tower 3", "Marina Bay Financial Centre L48", 1.2795, 103.8540, "online"],
    ["Ang Mo Kio Depot", "AMK Industrial Park 2", 1.3711, 103.8456, "online"],
    ["Tampines Hub", "Our Tampines Hub rooftop", 1.3536, 103.9400, "offline"],
    ["Woodlands Spare", "Spare unit in storage", 1.4360, 103.7865, "never"],
  ];
  const gateways: DbGateway[] = gwDefs.map(([name, desc, lat, lon, st], i) => ({
    gatewayId: `0016c001f1${(0x50a0 + i * 17).toString(16).padStart(4, "0")}${i}a`.slice(0, 16),
    name,
    description: desc,
    tenantId: t1.id,
    location: { latitude: lat, longitude: lon, altitude: 40 + i * 12, source: "CONFIG", accuracy: 0 },
    tags: { site: name.split(" ")[0].toLowerCase(), model: i % 2 ? "RAK7289" : "Kerlink iStation" },
    metadata: (st === "never" ? {} : { region_config_id: "as923", region_common_name: "AS923" }) as T.Tags,
    statsInterval: 30,
    createdAt: ago((90 - i * 5) * D),
    updatedAt: ago(3 * D),
    lastSeenAt: st === "online" ? now() : st === "offline" ? ago(2 * D + 3 * H) : undefined,
    simulated: st === "online",
  }));
  gateways.push({
    gatewayId: "a840411f0e2c0001",
    name: "Farm Gateway",
    description: "Solar-powered gateway, Lim Chu Kang",
    tenantId: t2.id,
    location: { latitude: 1.4305, longitude: 103.7171, altitude: 12, source: "GPS", accuracy: 4 },
    tags: { site: "farm" },
    metadata: { region_config_id: "as923" },
    statsInterval: 30,
    createdAt: ago(35 * D),
    updatedAt: ago(35 * D),
    lastSeenAt: now(),
    simulated: true,
  });

  // Device profiles
  const dp = (tenantId: string, name: string, kind: SensorKind, extra: Partial<T.DeviceProfile> = {}): DbDeviceProfile => ({
    id: id(),
    tenantId,
    name,
    description: SENSOR_MODELS[kind].label,
    region: "AS923",
    regionConfigId: "as923",
    macVersion: "LORAWAN_1_0_3",
    regParamsRevision: "A",
    adrAlgorithmId: "default",
    payloadCodecRuntime: "JS",
    payloadCodecScript: CODEC_SCRIPT,
    flushQueueOnActivate: true,
    uplinkInterval: 600,
    deviceStatusReqInterval: 1,
    supportsOtaa: true,
    supportsClassB: false,
    supportsClassC: false,
    classBTimeout: 0,
    classBPingSlotPeriodicity: 0,
    classBPingSlotDr: 0,
    classBPingSlotFreq: 0,
    classCTimeout: 0,
    abpRx1Delay: 0,
    abpRx1DrOffset: 0,
    abpRx2Dr: 0,
    abpRx2Freq: 0,
    tags: { sensor: kind },
    measurements: measurementsFor(kind),
    autoDetectMeasurements: true,
    allowRoaming: false,
    createdAt: ago(80 * D),
    updatedAt: ago(8 * D),
    ...extra,
  });
  const profiles = {
    env: dp(t1.id, "Indoor Env Sensor (OTAA, Class A)", "env"),
    meter: dp(t1.id, "Smart Meter (OTAA, Class C)", "meter", { supportsClassC: true, classCTimeout: 5, macVersion: "LORAWAN_1_0_4", regParamsRevision: "RP002_1_0_3" }),
    tracker: dp(t1.id, "GPS Tracker (OTAA, Class A)", "tracker", { uplinkInterval: 300 }),
    leak: dp(t1.id, "Leak Detector (ABP)", "leak", { supportsOtaa: false, abpRx1Delay: 1, abpRx2Dr: 2, abpRx2Freq: 923200000, payloadCodecRuntime: "CAYENNE_LPP", payloadCodecScript: "" }),
    air: dp(t1.id, "Air Quality Station (OTAA)", "air", { supportsClassB: true, classBTimeout: 5, classBPingSlotPeriodicity: 3, classBPingSlotDr: 2, classBPingSlotFreq: 923400000 }),
    soil: dp(t2.id, "Soil Probe (OTAA)", "soil", { uplinkInterval: 900 }),
  };

  // Applications
  const app = (tenantId: string, name: string, description: string, tags: T.Tags = {}): DbApplication => ({
    id: id(), tenantId, name, description, tags, createdAt: ago(70 * D), updatedAt: ago(6 * D),
  });
  const apps = {
    building: app(t1.id, "Smart Building", "Indoor climate, CO₂ and leak monitoring across campus buildings.", { owner: "facilities" }),
    energy: app(t1.id, "Energy Metering", "Sub-metering of electrical distribution boards.", { owner: "energy" }),
    fleet: app(t1.id, "Asset Tracking", "Campus shuttle and equipment trackers.", { owner: "logistics" }),
    city: app(t1.id, "Urban Air Quality", "Street-level air quality and noise.", { owner: "sustainability" }),
    farm: app(t2.id, "Precision Farming", "Soil moisture and temperature probes.", {}),
  };

  const devices: DbDevice[] = [];
  const deviceKeys: Record<string, DbKeys> = {};
  const activations: Record<string, T.DeviceActivation> = {};
  const addDevices = (a: DbApplication, p: DbDeviceProfile, kind: SensorKind, names: string[], opts: { dormant?: number[]; never?: number[]; disabled?: number[] } = {}) => {
    names.forEach((name, i) => {
      const devEui = (kind === "meter" ? "70b3d5e75e" : kind === "tracker" ? "a84041000181" : "0004a30b00") + hex(rnd, 8).slice(0, kind === "tracker" ? 4 : 6);
      const never = opts.never?.includes(i);
      const dormant = opts.dormant?.includes(i);
      const disabled = opts.disabled?.includes(i);
      const status: T.DeviceStatus | undefined = never
        ? undefined
        : kind === "meter"
          ? { margin: 12 + Math.floor(rnd() * 10), externalPowerSource: true, batteryLevel: -1 }
          : { margin: 3 + Math.floor(rnd() * 18), externalPowerSource: false, batteryLevel: Math.round(35 + rnd() * 64) };
      devices.push({
        devEui,
        name,
        description: `${SENSOR_MODELS[kind].label} — ${name}`,
        applicationId: a.id,
        deviceProfileId: p.id,
        skipFcntCheck: false,
        isDisabled: !!disabled,
        variables: kind === "meter" ? { ct_ratio: "100" } : {},
        tags: { floor: String(1 + Math.floor(rnd() * 8)), sensor: kind },
        joinEui: "0000000000000000",
        createdAt: ago((60 - i) * D),
        updatedAt: ago((10 - (i % 5)) * D),
        lastSeenAt: never ? undefined : dormant ? ago((3 + i) * D) : ago(Math.floor(rnd() * 5 * 60_000)),
        deviceStatus: status,
        sensor: kind,
        simulated: !never && !dormant && !disabled,
        dr: never ? undefined : Math.floor(rnd() * 6),
        fCntUp: never ? 0 : Math.floor(rnd() * 5000),
      });
      if (p.supportsOtaa) {
        deviceKeys[devEui] = { devEui, nwkKey: hex(rnd, 16), appKey: "00000000000000000000000000000000", createdAt: ago(50 * D), updatedAt: ago(50 * D) };
      }
      if (!never) {
        activations[devEui] = {
          devEui,
          devAddr: "26" + hex(rnd, 3),
          appSKey: hex(rnd, 16),
          nwkSEncKey: hex(rnd, 16),
          sNwkSIntKey: hex(rnd, 16),
          fNwkSIntKey: hex(rnd, 16),
          fCntUp: devices[devices.length - 1].fCntUp,
          nFCntDown: Math.floor(rnd() * 40),
          aFCntDown: Math.floor(rnd() * 40),
        };
      }
    });
  };
  addDevices(apps.building, profiles.env, "env", ["env-e1-lobby", "env-e1-lab-201", "env-e1-lab-305", "env-e3-auditorium", "env-e4-server-room", "env-lib-level2", "env-lib-level5", "env-sports-hall"], { dormant: [6], never: [7] });
  addDevices(apps.building, profiles.leak, "leak", ["leak-e1-plant-room", "leak-e4-server-room", "leak-lib-basement"]);
  addDevices(apps.energy, profiles.meter, "meter", ["meter-db-e1-01", "meter-db-e1-02", "meter-db-e4-01", "meter-db-lib-01", "meter-chiller-plant"], { disabled: [4] });
  addDevices(apps.fleet, profiles.tracker, "tracker", ["shuttle-a1", "shuttle-a2", "shuttle-b1", "forklift-07", "cart-12"], { dormant: [4] });
  addDevices(apps.city, profiles.air, "air", ["aq-orchard-rd", "aq-marina-bay", "aq-jurong-east", "aq-amk-ave3"], { never: [3] });
  addDevices(apps.farm, profiles.soil, "soil", ["soil-plot-a1", "soil-plot-a2", "soil-plot-b1", "soil-greenhouse"]);

  return {
    version: DB_VERSION,
    tenants: [t1, t2],
    users,
    tenantUsers: [
      tu(t1.id, users[0].id, true, true, true),
      tu(t1.id, users[1].id, true, true, true),
      tu(t1.id, users[2].id, false, true, false),
      tu(t2.id, users[3].id, true, true, true),
      tu(t2.id, users[1].id, false, false, true),
    ],
    gateways,
    applications: Object.values(apps),
    deviceProfiles: Object.values(profiles),
    devices,
    deviceKeys,
    activations,
  };
}

function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    /* ignore */
  }
  return seed();
}

export let db: DB = load();

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      /* quota or unavailable */
    }
  }, 800);
}

export function resetDb() {
  db = seed();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const newId = () => crypto.randomUUID();
export const stamp = () => {
  const n = now();
  return { createdAt: n, updatedAt: n };
};
