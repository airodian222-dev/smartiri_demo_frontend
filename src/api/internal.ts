/**
 * ChirpStack "InternalService" calls (summaries, live device events, login,
 * search, version). These are not exposed by the REST
 * proxy, so in live mode they go over gRPC-web directly to ChirpStack, the
 * same way the official ChirpStack UI does. In demo mode they are served by
 * the in-browser simulator.
 */
import { getConfig, isDemo } from "@/lib/config";
import { ApiError } from "./http";
import type * as T from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const cjs = (m: Any) => (m && m.default ? m.default : m);

let grpcModules: Promise<{ svc: Any; pb: Any; empty: Any }> | null = null;
function loadGrpc() {
  if (!grpcModules) {
    grpcModules = Promise.all([
      import("@chirpstack/chirpstack-api-grpc-web/api/internal_grpc_web_pb.js"),
      import("@chirpstack/chirpstack-api-grpc-web/api/internal_pb.js"),
      import("google-protobuf/google/protobuf/empty_pb.js"),
    ]).then(([svc, pb, empty]) => ({ svc: cjs(svc), pb: cjs(pb), empty: cjs(empty) }));
  }
  return grpcModules;
}

async function client() {
  const m = await loadGrpc();
  const cfg = getConfig()!;
  const host = (cfg.grpcUrl || window.location.origin).replace(/\/$/, "");
  const c = new m.svc.InternalServiceClient(host, null, null);
  const md = cfg.token ? { authorization: `Bearer ${cfg.token}` } : {};
  return { m, c, md };
}

function call<R>(c: Any, method: string, req: Any, md: Any): Promise<R> {
  return new Promise((resolve, reject) => {
    c[method](req, md, (err: Any, resp: R) => {
      if (err) reject(new ApiError(err.message || "gRPC error", 0, err.code));
      else resolve(resp);
    });
  });
}

const ts = (t: Any): string => (t ? t.toDate().toISOString() : "");

async function mock() {
  return import("@/mock/internal");
}

// ---------------------------------------------------------------- Summaries
export async function devicesSummary(tenantId?: string): Promise<T.DevicesSummary> {
  if (isDemo()) return (await mock()).devicesSummary(tenantId);
  const { m, c, md } = await client();
  const req = new m.pb.GetDevicesSummaryRequest();
  if (tenantId) req.setTenantId(tenantId);
  const r: Any = await call(c, "getDevicesSummary", req, md);
  const drCount: Record<string, number> = {};
  r.getDrCountMap().forEach((v: number, k: number) => (drCount[String(k)] = v));
  return {
    activeCount: r.getActiveCount(),
    inactiveCount: r.getInactiveCount(),
    neverSeenCount: r.getNeverSeenCount(),
    drCount,
  };
}

export async function gatewaysSummary(tenantId?: string): Promise<T.GatewaysSummary> {
  if (isDemo()) return (await mock()).gatewaysSummary(tenantId);
  const { m, c, md } = await client();
  const req = new m.pb.GetGatewaysSummaryRequest();
  if (tenantId) req.setTenantId(tenantId);
  const r: Any = await call(c, "getGatewaysSummary", req, md);
  return { onlineCount: r.getOnlineCount(), offlineCount: r.getOfflineCount(), neverSeenCount: r.getNeverSeenCount() };
}

// ---------------------------------------------------------------- Misc
export async function getVersion(): Promise<string> {
  if (isDemo()) return "4.x (simulated)";
  const { m, c, md } = await client();
  const r: Any = await call(c, "getVersion", new m.empty.Empty(), md);
  return r.getVersion();
}

export async function login(email: string, password: string): Promise<string> {
  const { m, c } = await client();
  const req = new m.pb.LoginRequest();
  req.setEmail(email);
  req.setPassword(password);
  const r: Any = await call(c, "login", req, {});
  return r.getJwt();
}

export async function profile(): Promise<T.Profile> {
  if (isDemo()) return (await mock()).profile();
  const { m, c, md } = await client();
  const r: Any = await call(c, "profile", new m.empty.Empty(), md);
  const u = r.getUser();
  return {
    user: u
      ? { id: u.getId(), email: u.getEmail(), isAdmin: u.getIsAdmin(), isActive: u.getIsActive(), note: u.getNote() }
      : undefined,
    tenants: r.getTenantsList().map((t: Any) => ({
      tenantId: t.getTenantId(),
      isAdmin: t.getIsAdmin(),
      isDeviceAdmin: t.getIsDeviceAdmin(),
      isGatewayAdmin: t.getIsGatewayAdmin(),
    })),
  };
}

export async function globalSearch(search: string): Promise<T.GlobalSearchResult[]> {
  if (isDemo()) return (await mock()).globalSearch(search);
  const { m, c, md } = await client();
  const req = new m.pb.GlobalSearchRequest();
  req.setSearch(search);
  req.setLimit(20);
  const r: Any = await call(c, "globalSearch", req, md);
  return r.getResultList().map((x: Any) => ({
    kind: x.getKind(),
    score: x.getScore(),
    tenantId: x.getTenantId(),
    tenantName: x.getTenantName(),
    applicationId: x.getApplicationId(),
    applicationName: x.getApplicationName(),
    deviceDevEui: x.getDeviceDevEui(),
    deviceName: x.getDeviceName(),
    gatewayId: x.getGatewayId(),
    gatewayName: x.getGatewayName(),
  }));
}

// ---------------------------------------------------------------- Streams
/**
 * Subscribe to a device's live event stream (up, join, status, ack, txack, log).
 * Returns an unsubscribe function.
 */
export function streamDeviceEvents(devEui: string, onItem: (item: T.LogItem) => void, onError?: (e: Error) => void): () => void {
  let cancelled = false;
  let cancelFn: (() => void) | null = null;

  (async () => {
    if (isDemo()) {
      const sim = await import("@/mock/simulator");
      if (cancelled) return;
      cancelFn = sim.subscribeDeviceEvents(devEui, onItem);
      return;
    }
    try {
      const { m, c, md } = await client();
      if (cancelled) return;
      const req = new m.pb.StreamDeviceEventsRequest();
      req.setDevEui(devEui);
      const s = c.streamDeviceEvents(req, md);
      s.on("data", (resp: Any) => {
        const props: Record<string, string> = {};
        resp.getPropertiesMap().forEach((v: string, k: string) => (props[k] = v));
        onItem({ id: resp.getId(), time: ts(resp.getTime()), description: resp.getDescription(), body: resp.getBody(), properties: props });
      });
      s.on("error", (e: Any) => onError?.(new Error(e.message)));
      cancelFn = () => s.cancel();
    } catch (e) {
      onError?.(e as Error);
    }
  })();

  return () => {
    cancelled = true;
    cancelFn?.();
  };
}
