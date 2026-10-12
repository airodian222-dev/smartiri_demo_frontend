/**
 * Demo-mode network simulator: generates uplinks, joins, status reports,
 * downlink transmissions (from the device queue) and gateway frames, and
 * pushes them to subscribers using the same LogItem shape that ChirpStack's
 * gRPC streams return.
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

export function subscribeStream(kind: string, id: string, cb: Cb): () => void {
  startSimulator();
  const key = `${kind}:${id}`;
  if (!subs.has(key)) subs.set(key, new Set());
  subs.get(key)!.add(cb);
  // replay recent history (oldest first)
  for (const item of buffers.get(key) ?? []) cb(item);
  return () => subs.get(key)?.delete(cb);
}

export function subscribeFeed(cb: FeedCb, replay = true): () => void {
  startSimulator();
  feedSubs.add(cb);
  if (replay) for (const e of feed) cb(e);
  return () => feedSubs.delete(cb);
}

export function recentFeed(): T.FeedEvent[] {
  return [...feed];
}

export function onChange(cb: () => void): () => void {
  changeSubs.add(cb);
  return () => changeSubs.delete(cb);
}

export function notifyChange() {
  changeSubs.forEach((cb) => cb());
}

function emit(kind: string, id: string, item: T.LogItem) {
  const key = `${kind}:${id}`;
  const buf = buffers.get(key) ?? [];
  buf.push(item);
  if (buf.length > BUF) buf.shift();
  buffers.set(key, buf);
  subs.get(key)?.forEach((cb) => cb(item));
}

function emitFeed(e: T.FeedEvent) {
  feed.push(e);
  if (feed.length > 200) feed.shift();
  feedSubs.forEach((cb) => cb(e));
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
const hex = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");

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
    uplinkId: Math.floor(rnd() * 65535),
    nsTime: new Date().toISOString(),
    rssi: Math.round(-60 - rnd() * 55 - i * 6),
    snr: +(10 - rnd() * 18).toFixed(1),
    channel: Math.floor(rnd() * 8),
    rfChain: rnd() > 0.5 ? 1 : 0,
    location: { latitude: g.location?.latitude, longitude: g.location?.longitude },
    context: btoa(String(Math.floor(rnd() * 1e9))),
    crcStatus: "CRC_OK",
  }));
}

function logItem(description: string, body: unknown, properties: Record<string, string>, time = new Date()): T.LogItem {
  return { id: uuid(), time: time.toISOString(), description, body: JSON.stringify(body, null, 2), properties };
}

function frameBody(mType: string, devAddr: string, fCnt: number, fPort: number | undefined, payload: string, txInfo: unknown, rxInfo: unknown) {
  return {
    phyPayload: {
      mhdr: { fType: mType, major: "LoRaWANR1" },
      payload: {
        fhdr: { devAddr, fCtrl: { adr: true, adrAckReq: false, ack: false, fPending: false, classB: false }, fCnt, fOpts: [] },
        fPort: fPort ?? null,
        frmPayload: payload ? [{ bytes: payload }] : null,
      },
      mic: Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join(""),
    },
    txInfo,
    rxInfo,
  };
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
  const bytes = encode(obj);
  const sf = 7 + Math.floor(rnd() * (rnd() > 0.7 ? 6 : 3));
  const dr = Math.max(0, 12 - sf);
  const confirmed = rnd() > 0.85;
  d.fCntUp += 1;
  act.fCntUp = d.fCntUp;
  d.lastSeenAt = at.toISOString();
  d.dr = dr;
  const rxInfo = rxInfoFor(d);
  const txInfo = { frequency: pick(FREQS), modulation: { lora: { bandwidth: 125000, spreadingFactor: sf, codeRate: "CR_4_5" } } };
  const body = {
    deduplicationId: uuid(),
    time: at.toISOString(),
    deviceInfo: info,
    devAddr: act.devAddr,
    adr: true,
    dr,
    fCnt: d.fCntUp,
    fPort: model.fPort,
    confirmed,
    data: b64(bytes),
    object: obj,
    rxInfo,
    txInfo,
  };
  emit("deviceEvents", d.devEui, logItem("up", body, { DR: String(dr), FCnt: String(d.fCntUp), FPort: String(model.fPort), Data: hex(bytes) }, at));

  const fType = confirmed ? "ConfirmedDataUp" : "UnconfirmedDataUp";
  const frame = frameBody(fType, act.devAddr, d.fCntUp, model.fPort, hex(bytes), txInfo, rxInfo);
  const props = { DevAddr: act.devAddr, FCnt: String(d.fCntUp), FPort: String(model.fPort) };
  emit("deviceFrames", d.devEui, logItem(fType, frame, props, at));
  for (const rx of rxInfo) {
    emit("gatewayFrames", rx.gatewayId, logItem(fType, { ...frame, rxInfo: [rx] }, props, at));
    const g = db.gateways.find((x) => x.gatewayId === rx.gatewayId);
    if (g) g.lastSeenAt = at.toISOString();
  }

  const summary = Object.entries(obj)
    .slice(0, 3)
    .map(([k, v]) => `${k}=${typeof v === "number" ? v : String(v)}`)
    .join(", ");
  emitFeed({ id: uuid(), time: at.toISOString(), type: "up", devEui: d.devEui, deviceName: d.name, applicationId: info.applicationId, applicationName: info.applicationName, tenantId: info.tenantId, summary, body });

  // pending confirmed downlink? acknowledge it with this uplink
  const pending = db.queue.find((q) => q.devEui === d.devEui && q.isPending);
  if (pending) {
    db.queue = db.queue.filter((q) => q !== pending);
    const ack = { deduplicationId: uuid(), time: at.toISOString(), deviceInfo: info, queueItemId: pending.id, acknowledged: true, fCntDown: pending.fCntDown };
    emit("deviceEvents", d.devEui, logItem("ack", ack, { Acknowledged: "true" }, at));
    emitFeed({ id: uuid(), time: at.toISOString(), type: "ack", devEui: d.devEui, deviceName: d.name, applicationId: info.applicationId, applicationName: info.applicationName, tenantId: info.tenantId, summary: `downlink fCnt ${pending.fCntDown} acknowledged`, body: ack });
  }

  // Class A: RX1 window downlink from the queue
  sendDownlink(d, new Date(at.getTime() + 1000));

  // periodic status
  if (d.fCntUp % 8 === 0 && d.deviceStatus) {
    if (!d.deviceStatus.externalPowerSource && (d.deviceStatus.batteryLevel ?? 0) > 5) d.deviceStatus.batteryLevel = +((d.deviceStatus.batteryLevel ?? 80) - 0.2).toFixed(1);
    d.deviceStatus.margin = Math.round(5 + rnd() * 15);
    const st = { deduplicationId: uuid(), time: at.toISOString(), deviceInfo: info, margin: d.deviceStatus.margin, externalPowerSource: !!d.deviceStatus.externalPowerSource, batteryLevelUnavailable: false, batteryLevel: d.deviceStatus.batteryLevel };
    emit("deviceEvents", d.devEui, logItem("status", st, { Margin: String(st.margin), Battery: d.deviceStatus.externalPowerSource ? "external" : `${st.batteryLevel}%` }, at));
    emitFeed({ id: uuid(), time: at.toISOString(), type: "status", devEui: d.devEui, deviceName: d.name, applicationId: info.applicationId, applicationName: info.applicationName, tenantId: info.tenantId, summary: `margin ${st.margin} dB, battery ${d.deviceStatus.externalPowerSource ? "external" : st.batteryLevel + "%"}`, body: st });
  }
  if (obj.leak === true) {
    const log = { time: at.toISOString(), deviceInfo: info, level: "WARNING", code: "UPLINK_CODEC", description: "Leak detected flag set in payload", context: { deduplication_id: body.deduplicationId } };
    emit("deviceEvents", d.devEui, logItem("log", log, { Level: "WARNING", Code: "UPLINK_CODEC" }, at));
    emitFeed({ id: uuid(), time: at.toISOString(), type: "log", devEui: d.devEui, deviceName: d.name, applicationId: info.applicationId, applicationName: info.applicationName, tenantId: info.tenantId, summary: "WARNING: leak detected", body: log });
  }
}

function sendDownlink(d: DbDevice, at: Date) {
  const act = db.activations[d.devEui];
  const item = db.queue.find((q) => q.devEui === d.devEui && !q.isPending);
  if (!act || !item) return;
  const gw = tenantGateways(d)[0];
  if (!gw) return;
  const info = deviceInfo(d);
  act.aFCntDown = (act.aFCntDown ?? 0) + 1;
  item.fCntDown = act.aFCntDown;
  if (item.confirmed) item.isPending = true;
  else db.queue = db.queue.filter((q) => q !== item);
  const txInfo = { frequency: 923200000, power: 14, modulation: { lora: { bandwidth: 125000, spreadingFactor: 10, codeRate: "CR_4_5", polarizationInversion: true } }, timing: { delay: { delay: "1s" } } };
  const dataHex = (() => {
    try {
      return Array.from(atob(item.data ?? ""), (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    } catch {
      return "";
    }
  })();
  const fType = item.confirmed ? "ConfirmedDataDown" : "UnconfirmedDataDown";
  const frame = frameBody(fType, act.devAddr, item.fCntDown, item.fPort, dataHex, txInfo, undefined);
  const props = { DevAddr: act.devAddr, FCnt: String(item.fCntDown), FPort: String(item.fPort) };
  emit("deviceFrames", d.devEui, logItem(fType, { ...frame, gatewayId: gw.gatewayId }, props, at));
  emit("gatewayFrames", gw.gatewayId, logItem(fType, frame, props, at));
  const txack = { downlinkId: Math.floor(rnd() * 1e9), time: at.toISOString(), deviceInfo: info, queueItemId: item.id, fCntDown: item.fCntDown, gatewayId: gw.gatewayId, txInfo };
  emit("deviceEvents", d.devEui, logItem("txack", txack, { FCntDown: String(item.fCntDown), GatewayID: gw.gatewayId }, at));
  emitFeed({ id: uuid(), time: at.toISOString(), type: "txack", devEui: d.devEui, deviceName: d.name, applicationId: info.applicationId, applicationName: info.applicationName, tenantId: info.tenantId, summary: `downlink fPort ${item.fPort} sent via ${gw.name}`, body: txack });
  persist();
}

/** Class-C devices receive downlinks right away rather than after the next uplink. */
export function scheduleClassCDownlink(d: DbDevice) {
  const dp = db.deviceProfiles.find((p) => p.id === d.deviceProfileId);
  if (!dp?.supportsClassC || !d.simulated) return;
  setTimeout(() => {
    sendDownlink(d, new Date());
    notifyChange();
  }, 1500);
}

function join(d: DbDevice) {
  const act = db.activations[d.devEui];
  if (!act) return;
  const at = new Date();
  act.devAddr = "26" + Array.from({ length: 6 }, () => Math.floor(rnd() * 16).toString(16)).join("");
  act.fCntUp = 0;
  d.fCntUp = 0;
  const info = deviceInfo(d);
  const rxInfo = rxInfoFor(d);
  const txInfo = { frequency: pick(FREQS), modulation: { lora: { bandwidth: 125000, spreadingFactor: 10, codeRate: "CR_4_5" } } };
  const jr = { phyPayload: { mhdr: { fType: "JoinRequest", major: "LoRaWANR1" }, payload: { joinEui: "0000000000000000", devEui: d.devEui, devNonce: Math.floor(rnd() * 65535) } }, txInfo, rxInfo };
  emit("deviceFrames", d.devEui, logItem("JoinRequest", jr, { DevEUI: d.devEui, JoinEUI: "0000000000000000" }, at));
  rxInfo.forEach((rx) => emit("gatewayFrames", rx.gatewayId, logItem("JoinRequest", { ...jr, rxInfo: [rx] }, { DevEUI: d.devEui }, at)));
  const ja = new Date(at.getTime() + 5000);
  emit("deviceFrames", d.devEui, logItem("JoinAccept", { phyPayload: { mhdr: { fType: "JoinAccept", major: "LoRaWANR1" }, payload: { bytes: "encrypted" } } }, { DevAddr: act.devAddr }, ja));
  const body = { deduplicationId: uuid(), time: at.toISOString(), deviceInfo: info, devAddr: act.devAddr };
  emit("deviceEvents", d.devEui, logItem("join", body, { DevAddr: act.devAddr }, at));
  emitFeed({ id: uuid(), time: at.toISOString(), type: "join", devEui: d.devEui, deviceName: d.name, applicationId: info.applicationId, applicationName: info.applicationName, tenantId: info.tenantId, summary: `joined with DevAddr ${act.devAddr}`, body });
}

function multicastTick() {
  const item = db.mcQueue.shift();
  if (!item) return;
  const mc = db.multicastGroups.find((m) => m.id === item.multicastGroupId);
  if (!mc) return;
  const gws = db.mcGateways.filter((x) => x.multicastGroupId === mc.id).map((x) => x.gatewayId);
  const frame = frameBody("UnconfirmedDataDown", mc.mcAddr, item.fCnt ?? 0, item.fPort, "", { frequency: mc.frequency, modulation: { lora: { bandwidth: 125000, spreadingFactor: 12 - (mc.dr ?? 0), codeRate: "CR_4_5" } } }, undefined);
  gws.forEach((g) => emit("gatewayFrames", g, logItem("UnconfirmedDataDown", frame, { DevAddr: mc.mcAddr, FCnt: String(item.fCnt), FPort: String(item.fPort), Multicast: mc.name })));
}

let timer: ReturnType<typeof setInterval> | null = null;
let ticks = 0;

function tick() {
  ticks++;
  const live = db.devices.filter((d) => d.simulated && !d.isDisabled && db.activations[d.devEui]);
  if (live.length) {
    const d = pick(live);
    if (rnd() < 0.02) join(d);
    else uplink(d);
  }
  // Gateway stats keep online gateways alive
  for (const g of db.gateways) if (g.simulated) g.lastSeenAt = new Date().toISOString();
  if (ticks % 3 === 0) multicastTick();
  persist();
  notifyChange();
}

export function startSimulator() {
  if (timer) return;
  // Backfill the last few minutes so streams and feeds are not empty on first load.
  const live = db.devices.filter((d) => d.simulated && !d.isDisabled && db.activations[d.devEui]);
  const start = Date.now() - 6 * 60_000;
  for (let i = 0; i < 40 && live.length; i++) uplink(pick(live), new Date(start + i * 9_000));
  timer = setInterval(tick, 2500);
}

export function stopSimulator() {
  if (timer) clearInterval(timer);
  timer = null;
}
