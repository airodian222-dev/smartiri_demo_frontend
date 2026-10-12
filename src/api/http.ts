import { getConfig, isDemo } from "@/lib/config";

export class ApiError extends Error {
  status: number;
  code?: number;
  constructor(message: string, status: number, code?: number) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type Query = Record<string, string | number | boolean | undefined | null>;

export function buildQuery(q?: Query): string {
  if (!q) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * Perform a ChirpStack REST API call. In demo mode the call is served by the
 * in-browser mock server, which implements the same routes and JSON shapes as
 * chirpstack-rest-api, so the UI code is identical for both modes.
 */
export async function rest<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
  if (isDemo()) {
    const { handleMock } = await import("@/mock/server");
    return handleMock<T>(method, path, opts.query ?? {}, opts.body);
  }
  const cfg = getConfig()!;
  const url = `${cfg.restUrl.replace(/\/$/, "")}${path}${buildQuery(opts.query)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    throw new ApiError(`Network error: could not reach ${cfg.restUrl || "the REST API"} (${(e as Error).message})`, 0);
  }
  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const d = data as { message?: string; code?: number } | undefined;
    throw new ApiError(d?.message || `${res.status} ${res.statusText}`, res.status, d?.code);
  }
  return (data ?? {}) as T;
}
