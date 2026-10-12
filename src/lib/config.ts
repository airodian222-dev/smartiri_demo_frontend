export type Mode = "demo" | "live";

export interface ConnectionConfig {
  mode: Mode;
  /** Base URL of chirpstack-rest-api. Empty = same origin (dev server proxies /api). */
  restUrl: string;
  /** Base URL of the ChirpStack gRPC-web endpoint (ChirpStack itself, port 8080). Empty = same origin. */
  grpcUrl: string;
  /** API token or JWT used as Bearer token. */
  token: string;
  /** Optional fixed tenant for tenant-scoped API keys that cannot list tenants. */
  tenantId?: string;
}

const KEY = "smartiri.connection";

export function loadConfig(): ConnectionConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ConnectionConfig) : null;
  } catch {
    return null;
  }
}

export function saveConfig(cfg: ConnectionConfig | null) {
  try {
    if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

let current: ConnectionConfig | null = loadConfig();

export function getConfig(): ConnectionConfig | null {
  return current;
}

export function setConfig(cfg: ConnectionConfig | null) {
  current = cfg;
  saveConfig(cfg);
}

export function isDemo() {
  return current?.mode !== "live";
}
