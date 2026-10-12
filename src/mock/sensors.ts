// Sensor models used by the simulator. Each device in the demo has a "kind";
// values are a deterministic function of time so that historical metrics and
// live uplinks agree with each other.

export type SensorKind = "env" | "meter" | "tracker" | "leak" | "soil" | "air";

export interface MeasurementDef {
  key: string;
  name: string;
  kind: "GAUGE" | "COUNTER" | "ABSOLUTE" | "STRING";
  unit?: string;
  base: number;
  amp: number;
  noise: number;
  digits?: number;
}

export const SENSOR_MODELS: Record<SensorKind, { label: string; fPort: number; measurements: MeasurementDef[] }> = {
  env: {
    label: "Indoor environment",
    fPort: 1,
    measurements: [
      { key: "temperature", name: "Temperature (°C)", kind: "GAUGE", unit: "°C", base: 24, amp: 3, noise: 0.4, digits: 1 },
      { key: "humidity", name: "Humidity (%RH)", kind: "GAUGE", unit: "%", base: 62, amp: 10, noise: 1.5, digits: 0 },
      { key: "co2", name: "CO₂ (ppm)", kind: "GAUGE", unit: "ppm", base: 650, amp: 250, noise: 30, digits: 0 },
    ],
  },
  meter: {
    label: "Smart energy meter",
    fPort: 2,
    measurements: [
      { key: "power", name: "Active power (W)", kind: "GAUGE", unit: "W", base: 1800, amp: 900, noise: 120, digits: 0 },
      { key: "voltage", name: "Voltage (V)", kind: "GAUGE", unit: "V", base: 230, amp: 3, noise: 1, digits: 1 },
      { key: "energy", name: "Energy (kWh)", kind: "COUNTER", unit: "kWh", base: 0, amp: 0, noise: 0, digits: 2 },
    ],
  },
  tracker: {
    label: "GPS asset tracker",
    fPort: 3,
    measurements: [
      { key: "speed", name: "Speed (km/h)", kind: "GAUGE", unit: "km/h", base: 22, amp: 18, noise: 5, digits: 0 },
      { key: "battery", name: "Battery (%)", kind: "GAUGE", unit: "%", base: 78, amp: 6, noise: 0.5, digits: 0 },
      { key: "motion", name: "Motion state", kind: "STRING", base: 0, amp: 0, noise: 0 },
    ],
  },
  leak: {
    label: "Water leak detector",
    fPort: 4,
    measurements: [
      { key: "leak", name: "Leak detected", kind: "STRING", base: 0, amp: 0, noise: 0 },
      { key: "temperature", name: "Temperature (°C)", kind: "GAUGE", unit: "°C", base: 27, amp: 2, noise: 0.3, digits: 1 },
    ],
  },
  soil: {
    label: "Soil moisture probe",
    fPort: 5,
    measurements: [
      { key: "moisture", name: "Soil moisture (%)", kind: "GAUGE", unit: "%", base: 38, amp: 9, noise: 1.2, digits: 1 },
      { key: "soilTemp", name: "Soil temperature (°C)", kind: "GAUGE", unit: "°C", base: 28, amp: 2.5, noise: 0.3, digits: 1 },
      { key: "ec", name: "Conductivity (µS/cm)", kind: "GAUGE", unit: "µS/cm", base: 420, amp: 60, noise: 15, digits: 0 },
    ],
  },
  air: {
    label: "Outdoor air quality",
    fPort: 6,
    measurements: [
      { key: "pm25", name: "PM2.5 (µg/m³)", kind: "GAUGE", unit: "µg/m³", base: 18, amp: 9, noise: 2, digits: 1 },
      { key: "pm10", name: "PM10 (µg/m³)", kind: "GAUGE", unit: "µg/m³", base: 32, amp: 14, noise: 3, digits: 1 },
      { key: "noise", name: "Noise (dBA)", kind: "GAUGE", unit: "dBA", base: 58, amp: 9, noise: 2, digits: 0 },
    ],
  },
};

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rand01(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    return rand01(a - 0x6d2b79f5);
  };
}

const DAY = 86_400_000;

/** Deterministic value for a measurement of a device at time t (ms). */
export function valueAt(devEui: string, m: MeasurementDef, t: number): number | string | boolean {
  const seed = hashStr(devEui + m.key);
  const phase = rand01(seed) * Math.PI * 2;
  const offset = (rand01(seed + 1) - 0.5) * m.amp * 0.6;
  if (m.key === "energy") {
    // monotonically increasing counter, ~1.8 kWh/h average
    const rate = 1.2 + rand01(seed) * 1.2;
    return +(((t - 1_700_000_000_000) / 3_600_000) * rate).toFixed(2);
  }
  if (m.key === "leak") return rand01(seed + Math.floor(t / 1_800_000)) > 0.97;
  if (m.key === "motion") return rand01(seed + Math.floor(t / 600_000)) > 0.4 ? "moving" : "stationary";
  const bucket = Math.floor(t / 60_000);
  const noise = (rand01(seed + bucket) - 0.5) * 2 * m.noise;
  const v = m.base + offset + m.amp * Math.sin((2 * Math.PI * t) / DAY + phase) + noise;
  const d = m.digits ?? 1;
  return +v.toFixed(d);
}

export function readingAt(devEui: string, kind: SensorKind, t: number): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = {};
  for (const m of SENSOR_MODELS[kind].measurements) out[m.key] = valueAt(devEui, m, t);
  return out;
}

export const CODEC_SCRIPT = `// Decode uplink function.
//
// Input is an object with the following fields:
// - bytes = Byte array containing the uplink payload, e.g. [255, 230, 255, 0]
// - fPort = Uplink fPort.
// - variables = Object containing the configured device variables.
//
// Output must be an object with the following fields:
// - data = Object representing the decoded payload.
function decodeUplink(input) {
  var b = input.bytes;
  var data = {};
  for (var i = 0; i + 4 < b.length; i += 5) {
    var id = b[i];
    var v = (b[i + 1] << 24) | (b[i + 2] << 16) | (b[i + 3] << 8) | b[i + 4];
    data["ch" + id] = v / 10;
  }
  return { data: data };
}

// Encode downlink function.
//
// Input is an object with the following fields:
// - data = Object representing the payload that must be encoded.
// - variables = Object containing the configured device variables.
//
// Output must be an object with the following fields:
// - bytes = Byte array containing the downlink payload.
function encodeDownlink(input) {
  return { bytes: [input.data.cmd || 0] };
}
`;
