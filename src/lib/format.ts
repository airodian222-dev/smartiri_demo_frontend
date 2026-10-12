export function timeAgo(iso?: string | null): string {
  if (!iso) return "Never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 0) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour12: false });
}

export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBase64(hex: string): string {
  const clean = hex.replace(/[^0-9a-f]/gi, "");
  let bin = "";
  for (let i = 0; i < clean.length; i += 2) bin += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  return btoa(bin);
}

export function base64ToHex(b64?: string): string {
  if (!b64) return "";
  try {
    const bin = atob(b64);
    return Array.from(bin, (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

export function isHex(s: string, bytes?: number): boolean {
  const re = bytes ? new RegExp(`^[0-9a-fA-F]{${bytes * 2}}$`) : /^([0-9a-fA-F]{2})*$/;
  return re.test(s);
}

export function fmtFreq(hz?: number): string {
  if (!hz) return "—";
  return `${(hz / 1_000_000).toFixed(1)} MHz`;
}

export function fmtNumber(n?: number, digits = 0): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function batteryLabel(level?: number, external?: boolean): string {
  if (external) return "External";
  if (level === undefined || level < 0) return "—";
  return `${Math.round(level)}%`;
}

export function enumLabel(v?: string): string {
  if (!v) return "—";
  return v
    .replace(/^LORAWAN_/, "LoRaWAN ")
    .replace(/_/g, " ")
    .replace(/(\d) (\d) (\d)/, "$1.$2.$3");
}

export function shortId(id?: string): string {
  if (!id) return "";
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}
