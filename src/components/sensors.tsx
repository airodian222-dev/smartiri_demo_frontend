import {
  Activity, Battery, BatteryCharging, Cloud, Cpu, Droplet, Droplets, Gauge, Leaf, MapPin, Navigation, Sprout, Thermometer, Volume2, Wind, Zap,
} from "lucide-react";
import type { ReactNode } from "react";

export interface SensorMeta {
  label: string;
  unit?: string;
  icon: ReactNode;
  /** Tailwind gradient classes for the icon chip */
  gradient: string;
  /** index into the chart series palette */
  series: number;
}

const M: Record<string, SensorMeta> = {
  temperature: { label: "Temperature", unit: "°C", icon: <Thermometer />, gradient: "from-orange-500 to-rose-500", series: 6 },
  soilTemp: { label: "Soil temp", unit: "°C", icon: <Thermometer />, gradient: "from-amber-500 to-orange-600", series: 1 },
  humidity: { label: "Humidity", unit: "%", icon: <Droplets />, gradient: "from-sky-500 to-cyan-400", series: 2 },
  co2: { label: "CO₂", unit: "ppm", icon: <Cloud />, gradient: "from-slate-500 to-indigo-500", series: 0 },
  power: { label: "Power", unit: "W", icon: <Zap />, gradient: "from-amber-400 to-yellow-500", series: 1 },
  voltage: { label: "Voltage", unit: "V", icon: <Gauge />, gradient: "from-violet-500 to-fuchsia-500", series: 4 },
  energy: { label: "Energy", unit: "kWh", icon: <BatteryCharging />, gradient: "from-emerald-500 to-teal-400", series: 5 },
  speed: { label: "Speed", unit: "km/h", icon: <Navigation />, gradient: "from-indigo-500 to-blue-500", series: 7 },
  battery: { label: "Battery", unit: "%", icon: <Battery />, gradient: "from-emerald-500 to-lime-500", series: 5 },
  leak: { label: "Leak", icon: <Droplet />, gradient: "from-blue-500 to-cyan-500", series: 2 },
  motion: { label: "Motion", icon: <Activity />, gradient: "from-pink-500 to-rose-500", series: 3 },
  moisture: { label: "Soil moisture", unit: "%", icon: <Sprout />, gradient: "from-lime-500 to-emerald-600", series: 5 },
  ec: { label: "Conductivity", unit: "µS/cm", icon: <Activity />, gradient: "from-teal-500 to-cyan-600", series: 2 },
  pm25: { label: "PM2.5", unit: "µg/m³", icon: <Wind />, gradient: "from-fuchsia-500 to-purple-600", series: 4 },
  pm10: { label: "PM10", unit: "µg/m³", icon: <Wind />, gradient: "from-purple-500 to-indigo-600", series: 0 },
  noise: { label: "Noise", unit: "dBA", icon: <Volume2 />, gradient: "from-rose-500 to-pink-600", series: 3 },
  latitude: { label: "Latitude", icon: <MapPin />, gradient: "from-sky-500 to-indigo-500", series: 7 },
  longitude: { label: "Longitude", icon: <MapPin />, gradient: "from-sky-500 to-indigo-500", series: 7 },
};

export function sensorMeta(key: string, name?: string): SensorMeta {
  if (M[key]) return M[key];
  const unit = name?.match(/\(([^)]+)\)$/)?.[1];
  return { label: name?.replace(/\s*\([^)]*\)$/, "") || key, unit, icon: <Gauge />, gradient: "from-indigo-500 to-cyan-500", series: 0 };
}

/** Device "kind" (from the sensor tag or the profile name) → icon & colour. */
export function deviceKind(tags?: Record<string, string>, profileName?: string): { label: string; icon: ReactNode; gradient: string } {
  const k = (tags?.sensor || profileName || "").toLowerCase();
  if (k.includes("meter") || k.includes("energy")) return { label: "Energy meter", icon: <Zap />, gradient: "from-amber-400 to-orange-500" };
  if (k.includes("track") || k.includes("gps")) return { label: "Tracker", icon: <Navigation />, gradient: "from-indigo-500 to-blue-500" };
  if (k.includes("leak")) return { label: "Leak sensor", icon: <Droplet />, gradient: "from-blue-500 to-cyan-400" };
  if (k.includes("soil")) return { label: "Soil probe", icon: <Sprout />, gradient: "from-lime-500 to-emerald-600" };
  if (k.includes("air")) return { label: "Air quality", icon: <Leaf />, gradient: "from-fuchsia-500 to-purple-600" };
  if (k.includes("env") || k.includes("temp")) return { label: "Environment", icon: <Thermometer />, gradient: "from-orange-500 to-rose-500" };
  return { label: "Device", icon: <Cpu />, gradient: "from-slate-500 to-indigo-500" };
}

export function SensorChip({ gradient, children, size = "md" }: { gradient: string; children: ReactNode; size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "h-8 w-8 rounded-xl [&>svg]:h-4 [&>svg]:w-4" : size === "lg" ? "h-14 w-14 rounded-2xl [&>svg]:h-7 [&>svg]:w-7" : "h-10 w-10 rounded-xl [&>svg]:h-5 [&>svg]:w-5";
  return <div className={`bg-gradient-to-br ${gradient} text-white grid place-items-center shrink-0 shadow-lg ${s}`}>{children}</div>;
}
