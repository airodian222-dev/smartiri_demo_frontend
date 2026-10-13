/**
 * Demo-mode network simulator: generates uplinks with decoded sensor values,
 * joins, status reports and alerts, and pushes them to subscribers using the
 * same LogItem shape that ChirpStack's device event stream returns.
 */
import type * as T from "@/api/types";
import { db, persist, type DbDevice, type DbGateway } from "./db";
import { SENSOR_MODELS, readingAt } from "./sensors";

type Cb = (item: T.LogItem) => void;
type FeedCb = (e: T.FeedEvent) => void;

const subs = new Map<string, Set<Cb>>();
const buffers = new Map<string, T.LogItem[]>();
const feedSubs = new Set<FeedCb>();
const feed: T.FeedEvent[] = [];
const changeSubs = new Set<() => void>();
const BUF = 60;

export function gatewayState(g: DbGateway): T.GatewayState {
  if (!g.lastSeenAt) return "NEVER_SEEN";
  const age = Date.now() - new Date(g.lastSeenAt).getTime();
  return age < (g.statsInterval || 30) * 2000 + 60_000 ? "ONLINE" : "OFFLINE";
}

/** Live events of one device; recent history is replayed on subscribe. */
export function subscribeDeviceEvents(devEui: string, cb: Cb): () => void {
  startSimulator();
  if (!subs.has(devEui)) subs.set(devEui, new Set());
  subs.get(devEui)!.add(cb);
  for (const item of buffers.get(devEui) ?? []) cb(item);
  return () => subs.get(devEui)?.delete(cb);
}

/** Network-wide feed of all events (used by the dashboard and live stream). */
export function subscribeFeed(cb: FeedCb, replay = true): () => void {
  startSimulator();
  feedSubs.add(cb);
  if (replay) for (const e of feed) cb(e);
  return () => feedSubs.delete(cb);
}

export function onChange(cb: () => void): () => void {
  changeSubs.add(cb);
  return () => changeSubs.delete(cb);
}

export function notifyChange() {
  changeSubs.forEach((cb) => cb());
}

const rnd = Math.random;
const pick = <X,>(a: X[]) => a[Math.floor(rnd() * a.length)];
const uuid = () => crypto.randomUUID();
const FREQS = [923200000, 923400000, 922000000, 922200000, 922400000, 922600000, 922800000, 923000000];

function deviceInfo(d: DbDevice) {
  const app = db.applications.find((a) => a.id === d.applicationId);
  const tenant = db.tenants.find((t) => t.id === app?.tenantId);
  const dp = db.deviceProfiles.find((p) => p.id === d.deviceProfileId);
  return {
    tenantId: tenant?.id ?? "",
    tenantName: tenant?.name ?? "",
    applicationId: app?.id ?? "",
    applicationName: app?.name ?? "",
    deviceProfileId: dp?.id ?? "",
    deviceProfileName: dp?.name ?? "",
    deviceName: d.name,
    devEui: d.devEui,
    deviceClassEnabled: dp?.supportsClassC ? "CLASS_C" : dp?.supportsClassB ? "CLASS_B" : "CLASS_A",
    tags: d.tags ?? {},
  };
}

/** Publish one event to the device stream and the network feed. */
function publish(d: DbDevice, type: string, body: Record<string, unknown>, properties: Record<string, string>, summary: string, at: Date) {
  const item: T.LogItem = { id: uuid(), time: at.toISOString(), description: type, body: JSON.stringify(body, null, 2), properties };
  const buf = buffers.get(d.devEui) ?? [];
  buf.push(item);
  if (buf.length > BUF) buf.shift();
  buffers.set(d.devEui, buf);
  subs.get(d.devEui)?.forEach((cb) => cb(item));

  const info = body.deviceInfo as ReturnType<typeof deviceInfo>;
  const e: T.FeedEvent = { id: uuid(), time: at.toISOString(), type, devEui: d.devEui, deviceName: d.name, applicationId: info.applicationId, applicationName: info.applicationName, tenantId: info.tenantId, summary, body };
  feed.push(e);
  if (feed.length > 200) feed.shift();
  feedSubs.forEach((cb) => cb(e));
}

function encode(obj: Record<string, number | string | boolean>): Uint8Array {
  const out: number[] = [];
  Object.values(obj).forEach((v, i) => {
    if (typeof v === "number") {
      const n = Math.round(v * 10) | 0;
      out.push(i + 1, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
    } else {
      out.push(i + 1, 0, 0, 0, typeof v === "boolean" ? (v ? 1 : 0) : v === "moving" ? 1 : 0);
    }
  });
  return new Uint8Array(out);
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));

function tenantGateways(d: DbDevice): DbGateway[] {
  const app = db.applications.find((a) => a.id === d.applicationId);
  return db.gateways.filter((g) => g.tenantId === app?.tenantId && g.simulated);
}

function rxInfoFor(d: DbDevice) {
  const gws = tenantGateways(d);
  if (!gws.length) return [];
  const n = Math.min(gws.length, 1 + Math.floor(rnd() * 3));
  const chosen = [...gws].sort(() => rnd() - 0.5).slice(0, n);
  return chosen.map((g, i) => ({
    gatewayId: g.gatewayId,
    rssi: Math.round(-60 - rnd() * 55 - i * 6),
    snr: +(10 - rnd() * 18).toFixed(1),
    location: { latitude: g.location?.latitude, longitude: g.location?.longitude },
  }));
}

function uplink(d: DbDevice, at = new Date()) {
  const act = db.activations[d.devEui];
  if (!act) return;
  const info = deviceInfo(d);
  const model = SENSOR_MODELS[d.sensor];
  const obj = readingAt(d.devEui, d.sensor, at.getTime());
  if (d.sensor === "tracker") {
    const phase = (parseInt(d.devEui.slice(-4), 16) % 360) * (Math.PI / 180);
    const t = at.getTime() / 900_000 + phase;
    obj.latitude = +(1.2966 + 0.012 * Math.sin(t)).toFixed(6);
    obj.longitude = +(103.7764 + 0.018 * Math.cos(t)).toFixed(6);
  }
  const sf = 7 + Math.floor(rnd() * (rnd() > 0.7 ? 6 : 3));
  const dr = Math.max(0, 12 - sf);
  d.fCntUp += 1;
  act.fCntUp = d.fCntUp;
  d.lastSeenAt = at.toISOString();
  d.dr = dr;
  const rxInfo = rxInfoFor(d);
  for (const rx of rxInfo) {
    const g = db.gateways.find((x) => x.gatewayId === rx.gatewayId);
    if (g) g.lastSeenAt = at.toISOString();
  }
  const body = {
    deduplicationId: uuid(),
    time: at.toISOString(),
    deviceInfo: info,
    devAddr: act.devAddr,
    dr,
    fCnt: d.fCntUp,
    fPort: model.fPort,
    data: b64(encode(obj)),
    object: obj,
    rxInfo,
    txInfo: { frequency: pick(FREQS), modulation: { lora: { bandwidth: 125000, spreadingFactor: sf, codeRate: "CR_4_5" } } },
  };
  const summary = Object.entries(obj)
    .slice(0, 3)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(", ");
  publish(d, "up", body, { DR: String(dr), FCnt: String(d.fCntUp) }, summary, at);

  // periodic battery / link status report
  if (d.fCntUp % 8 === 0 && d.deviceStatus) {
    if (!d.deviceStatus.externalPowerSource && (d.deviceStatus.batteryLevel ?? 0) > 5) d.deviceStatus.batteryLevel = +((d.deviceStatus.batteryLevel ?? 80) - 0.2).toFixed(1);
    d.deviceStatus.margin = Math.round(5 + rnd() * 15);
    const ext = !!d.deviceStatus.externalPowerSource;
    const st = { time: at.toISOString(), deviceInfo: info, margin: d.deviceStatus.margin, externalPowerSource: ext, batteryLevel: d.deviceStatus.batteryLevel };
    const battery = ext ? "external" : `${st.batteryLevel}%`;
    publish(d, "status", st, { Margin: `${st.margin} dB`, Battery: battery }, `margin ${st.margin} dB, battery ${battery}`, at);
  }
  if (obj.leak === true) {
    const log = { time: at.toISOString(), deviceInfo: info, level: "WARNING", code: "UPLINK_CODEC", description: "Leak detected" };
    publish(d, "log", log, { Level: "WARNING", Alert: "Leak detected" }, "WARNING: leak detected", at);
  }
}

function join(d: DbDevice) {
  const act = db.activations[d.devEui];
  if (!act) return;
  const at = new Date();
  act.devAddr = "26" + Array.from({ length: 6 }, () => Math.floor(rnd() * 16).toString(16)).join("");
  act.fCntUp = 0;
  d.fCntUp = 0;
  const body = { time: at.toISOString(), deviceInfo: deviceInfo(d), devAddr: act.devAddr };
  publish(d, "join", body, { DevAddr: act.devAddr }, `joined with DevAddr ${act.devAddr}`, at);
}

/** Demo: a newly provisioned device joins and reports right away. */
export function kickDevice(d: DbDevice) {
  d.deviceStatus ??= { margin: 10, externalPowerSource: false, batteryLevel: 100 };
  setTimeout(() => {
    join(d);
    setTimeout(() => {
      uplink(d);
      persist();
      notifyChange();
    }, 1500);
  }, 800);
}

let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  const live = db.devices.filter((d) => d.simulated && !d.isDisabled && db.activations[d.devEui]);
  if (live.length) {
    const d = pick(live);
    if (rnd() < 0.02) join(d);
    else uplink(d);
  }
  // Gateway statistics keep online gateways alive
  for (const g of db.gateways) if (g.simulated) g.lastSeenAt = new Date().toISOString();
  persist();
  notifyChange();
}

export function startSimulator() {
  if (timer) return;
  // Backfill the last minutes (every device at least once) so pages are not empty on first load.
  const live = db.devices.filter((d) => d.simulated && !d.isDisabled && db.activations[d.devEui]);
  const start = Date.now() - 8 * 60_000;
  const order = [...live].sort(() => rnd() - 0.5);
  const n = Math.max(40, order.length);
  for (let i = 0; i < n && live.length; i++) uplink(i < order.length ? order[i] : pick(live), new Date(start + (i * 8 * 60_000) / n));
  timer = setInterval(tick, 2500);
}
