import type * as T from "@/api/types";
import type { DbDevice, DbGateway } from "./db";
import { SENSOR_MODELS, hashStr, rand01, valueAt } from "./sensors";

const STEP: Record<T.Aggregation, number> = {
  MINUTE: 60_000,
  HOUR: 3_600_000,
  DAY: 86_400_000,
  MONTH: 30 * 86_400_000,
};

export function buckets(start: string, end: string, agg: T.Aggregation): number[] {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const step = STEP[agg] ?? STEP.HOUR;
  const out: number[] = [];
  let t = Math.floor(s / step) * step;
  while (t <= e && out.length < 1500) {
    out.push(t);
    t += step;
  }
  return out;
}

const iso = (ts: number[]) => ts.map((t) => new Date(t).toISOString());

/** Activity factor in [0..1] for a device/gateway at time t (0 if not active). */
function alive(lastSeen: string | undefined, created: string | undefined, t: number, simulated: boolean): boolean {
  if (!lastSeen) return false;
  if (created && t < new Date(created).getTime()) return false;
  if (!simulated && t > new Date(lastSeen).getTime()) return false;
  return true;
}

function packetsPer(step: number, interval: number, seed: number) {
  const expected = step / (interval * 1000);
  const jitter = 0.85 + rand01(seed) * 0.3;
  return Math.max(0, Math.round(expected * jitter));
}

export function deviceMetrics(d: DbDevice, w: { start: string; end: string; aggregation: T.Aggregation }): T.DeviceMetrics {
  const ts = buckets(w.start, w.end, w.aggregation);
  const metrics: Record<string, T.Metric> = {};
  const states: Record<string, T.DeviceState> = {};
  for (const m of SENSOR_MODELS[d.sensor].measurements) {
    if (m.kind === "STRING") {
      if (d.lastSeenAt) states[m.key] = { name: m.name, value: String(valueAt(d.devEui, m, Date.now())) };
      continue;
    }
    const data = ts.map((t) =>
      alive(d.lastSeenAt, d.createdAt, t, d.simulated) ? Number(valueAt(d.devEui, m, t + STEP[w.aggregation] / 2)) : 0,
    );
    let values = data;
    if (m.kind === "COUNTER") {
      // per-bucket consumption
      values = ts.map((t, i) =>
        data[i] ? +(Number(valueAt(d.devEui, m, t + STEP[w.aggregation])) - Number(valueAt(d.devEui, m, t))).toFixed(2) : 0,
      );
    }
    metrics[m.key] = { name: m.name, timestamps: iso(ts), datasets: [{ label: m.key, data: values }], kind: m.kind === "COUNTER" ? "COUNTER" : "GAUGE" };
  }
  return { metrics, states };
}

export function deviceLinkMetrics(d: DbDevice, interval: number, w: { start: string; end: string; aggregation: T.Aggregation }): T.DeviceLinkMetrics {
  const ts = buckets(w.start, w.end, w.aggregation);
  const step = STEP[w.aggregation];
  const seed = hashStr(d.devEui);
  // Simulator sends roughly every 75s; use a realistic but lively interval
  const effInterval = Math.min(interval, 120);
  const rx = ts.map((t, i) => (alive(d.lastSeenAt, d.createdAt, t, d.simulated) ? packetsPer(step, effInterval, seed + i) : 0));
  const rssiBase = -70 - rand01(seed) * 40;
  const snrBase = 9 - rand01(seed + 3) * 14;
  const rssi = ts.map((_, i) => (rx[i] ? +(rssiBase + (rand01(seed + i * 7) - 0.5) * 8).toFixed(0) : 0));
  const snr = ts.map((_, i) => (rx[i] ? +(snrBase + (rand01(seed + i * 11) - 0.5) * 4).toFixed(1) : 0));
  const freqs = [923200000, 923400000, 922200000, 922400000];
  const drs = [0, 1, 2, 3, 4, 5];
  const mainDr = d.dr ?? 5;
  return {
    rxPackets: { name: "Received", timestamps: iso(ts), datasets: [{ label: "rx_count", data: rx }], kind: "ABSOLUTE" },
    gwRssi: { name: "RSSI", timestamps: iso(ts), datasets: [{ label: "rssi", data: rssi }], kind: "GAUGE" },
    gwSnr: { name: "SNR", timestamps: iso(ts), datasets: [{ label: "snr", data: snr }], kind: "GAUGE" },
    rxPacketsPerFreq: {
      name: "Received / frequency",
      timestamps: iso(ts),
      datasets: freqs.map((f, fi) => ({ label: String(f), data: rx.map((v, i) => Math.round((v * (1 + rand01(seed + i + fi * 100))) / (freqs.length + 1))) })),
      kind: "ABSOLUTE",
    },
    rxPacketsPerDr: {
      name: "Received / DR",
      timestamps: iso(ts),
      datasets: drs
        .filter((dr) => Math.abs(dr - mainDr) <= 1)
        .map((dr) => ({ label: String(dr), data: rx.map((v) => (dr === mainDr ? Math.round(v * 0.8) : Math.round(v * 0.1))) })),
      kind: "ABSOLUTE",
    },
    errors: {
      name: "Errors",
      timestamps: iso(ts),
      datasets: [{ label: "UPLINK_FCNT_RETRANSMISSION", data: rx.map((v, i) => (v && rand01(seed + i * 3) > 0.85 ? 1 : 0)) }],
      kind: "ABSOLUTE",
    },
  };
}

export function gatewayMetrics(g: DbGateway, deviceCount: number, w: { start: string; end: string; aggregation: T.Aggregation }): T.GatewayMetrics {
  const ts = buckets(w.start, w.end, w.aggregation);
  const step = STEP[w.aggregation];
  const seed = hashStr(g.gatewayId);
  const created = g.createdAt;
  const isAlive = (t: number) => alive(g.lastSeenAt, created, t, g.simulated);
  const diurnal = (t: number) => 0.75 + 0.25 * Math.sin((2 * Math.PI * t) / 86_400_000);
  const rx = ts.map((t, i) => (isAlive(t) ? Math.round(((step / 90_000) * Math.max(3, deviceCount) * diurnal(t) * (0.8 + rand01(seed + i) * 0.4)) / 3) : 0));
  const tx = rx.map((v, i) => Math.round(v * (0.06 + rand01(seed + i * 5) * 0.05)));
  const freqs = [923200000, 923400000, 922000000, 922200000, 922400000, 922600000, 922800000, 923000000];
  const split = (arr: number[], n: number, salt: number) =>
    Array.from({ length: n }, (_, k) => arr.map((v, i) => Math.round((v * (0.5 + rand01(seed + salt + k * 31 + i))) / n)));
  const rxF = split(rx, freqs.length, 1);
  const txF = split(tx, 2, 2);
  const rxD = split(rx, 6, 3);
  const txD = split(tx, 3, 4);
  return {
    rxPackets: { name: "Received", timestamps: iso(ts), datasets: [{ label: "rx_count", data: rx }], kind: "ABSOLUTE" },
    txPackets: { name: "Transmitted", timestamps: iso(ts), datasets: [{ label: "tx_count", data: tx }], kind: "ABSOLUTE" },
    rxPacketsPerFreq: { name: "Received / frequency", timestamps: iso(ts), datasets: freqs.map((f, i) => ({ label: String(f), data: rxF[i] })), kind: "ABSOLUTE" },
    txPacketsPerFreq: { name: "Transmitted / frequency", timestamps: iso(ts), datasets: [923200000, 923400000].map((f, i) => ({ label: String(f), data: txF[i] })), kind: "ABSOLUTE" },
    rxPacketsPerDr: { name: "Received / DR", timestamps: iso(ts), datasets: [0, 1, 2, 3, 4, 5].map((dr, i) => ({ label: String(dr), data: rxD[i] })), kind: "ABSOLUTE" },
    txPacketsPerDr: { name: "Transmitted / DR", timestamps: iso(ts), datasets: [2, 3, 5].map((dr, i) => ({ label: String(dr), data: txD[i] })), kind: "ABSOLUTE" },
    txPacketsPerStatus: {
      name: "TX / status",
      timestamps: iso(ts),
      datasets: [
        { label: "OK", data: tx.map((v) => Math.round(v * 0.95)) },
        { label: "TOO_LATE", data: tx.map((v, i) => (v && rand01(seed + i * 13) > 0.8 ? 1 : 0)) },
        { label: "COLLISION_PACKET", data: tx.map((v, i) => (v && rand01(seed + i * 17) > 0.9 ? 1 : 0)) },
      ],
      kind: "ABSOLUTE",
    },
  };
}
