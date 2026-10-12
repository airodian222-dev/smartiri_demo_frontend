/**
 * ChirpStack "InternalService" calls (API keys, regions, summaries, live
 * frame/event streams, login, search). These are not exposed by the REST
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

let grpcModules: Promise<{ svc: Any; pb: Any; empty: Any; common: Any }> | null = null;
function loadGrpc() {
  if (!grpcModules) {
    grpcModules = Promise.all([
      import("@chirpstack/chirpstack-api-grpc-web/api/internal_grpc_web_pb.js"),
      import("@chirpstack/chirpstack-api-grpc-web/api/internal_pb.js"),
      import("google-protobuf/google/protobuf/empty_pb.js"),
      import("@chirpstack/chirpstack-api-grpc-web/common/common_pb.js"),
    ]).then(([svc, pb, empty, common]) => ({ svc: cjs(svc), pb: cjs(pb), empty: cjs(empty), common: cjs(common) }));
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

function regionName(common: Any, n: number): string {
  const e = common.Region as Record<string, number>;
  return Object.keys(e).find((k) => e[k] === n) ?? String(n);
}

async function mock() {
  return import("@/mock/internal");
}

// ---------------------------------------------------------------- API keys
export async function listApiKeys(opts: { isAdmin?: boolean; tenantId?: string }): Promise<T.List<T.ApiKey>> {
  if (isDemo()) return (await mock()).listApiKeys(opts);
  const { m, c, md } = await client();
  const req = new m.pb.ListApiKeysRequest();
  req.setLimit(100);
  req.setIsAdmin(!!opts.isAdmin);
  if (opts.tenantId) req.setTenantId(opts.tenantId);
  const r: Any = await call(c, "listApiKeys", req, md);
  return {
    totalCount: r.getTotalCount(),
    result: r.getResultList().map((k: Any) => ({
      id: k.getId(),
      name: k.getName(),
      isAdmin: k.getIsAdmin(),
      tenantId: k.getTenantId(),
    })),
  };
}

export async function createApiKey(k: Omit<T.ApiKey, "id">): Promise<{ id: string; token: string }> {
  if (isDemo()) return (await mock()).createApiKey(k);
  const { m, c, md } = await client();
  const key = new m.pb.ApiKey();
  key.setName(k.name);
  key.setIsAdmin(!!k.isAdmin);
  if (k.tenantId) key.setTenantId(k.tenantId);
  const req = new m.pb.CreateApiKeyRequest();
  req.setApiKey(key);
  const r: Any = await call(c, "createApiKey", req, md);
  return { id: r.getId(), token: r.getToken() };
}

export async function deleteApiKey(id: string): Promise<void> {
  if (isDemo()) return (await mock()).deleteApiKey(id);
  const { m, c, md } = await client();
  const req = new m.pb.DeleteApiKeyRequest();
  req.setId(id);
  await call(c, "deleteApiKey", req, md);
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

// ---------------------------------------------------------------- Regions
export async function listRegions(): Promise<T.RegionListItem[]> {
  if (isDemo()) return (await mock()).listRegions();
  const { m, c, md } = await client();
  const r: Any = await call(c, "listRegions", new m.empty.Empty(), md);
  return r.getRegionsList().map((x: Any) => ({
    id: x.getId(),
    region: regionName(m.common, x.getRegion()),
    description: x.getDescription(),
  }));
}

export async function getRegion(id: string): Promise<T.RegionDetail> {
  if (isDemo()) return (await mock()).getRegion(id);
  const { m, c, md } = await client();
  const req = new m.pb.GetRegionRequest();
  req.setId(id);
  const r: Any = await call(c, "getRegion", req, md);
  return {
    id: r.getId(),
    region: regionName(m.common, r.getRegion()),
    userInfo: r.getUserInfo(),
    description: r.getDescription(),
    uplinkChannels: r.getUplinkChannelsList().map((ch: Any) => ({
      frequency: ch.getFrequency(),
      dataRates: ch.getDataRatesList(),
    })),
    rx1Delay: r.getRx1Delay(),
    rx1DrOffset: r.getRx1DrOffset(),
    rx2Dr: r.getRx2Dr(),
    rx2Frequency: r.getRx2Frequency(),
    classBPingSlotDr: r.getClassBPingSlotDr(),
    classBPingSlotFrequency: r.getClassBPingSlotFrequency(),
  };
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
export type StreamKind = "deviceEvents" | "deviceFrames" | "gatewayFrames";

/**
 * Subscribe to a live LogItem stream. Returns an unsubscribe function.
 */
export function stream(
  kind: StreamKind,
  id: string,
  onItem: (item: T.LogItem) => void,
  onError?: (e: Error) => void,
): () => void {
  let cancelled = false;
  let cancelFn: (() => void) | null = null;

  (async () => {
    if (isDemo()) {
      const sim = await import("@/mock/simulator");
      if (cancelled) return;
      cancelFn = sim.subscribeStream(kind, id, onItem);
      return;
    }
    try {
      const { m, c, md } = await client();
      if (cancelled) return;
      let req: Any;
      let method: string;
      if (kind === "gatewayFrames") {
        req = new m.pb.StreamGatewayFramesRequest();
        req.setGatewayId(id);
        method = "streamGatewayFrames";
      } else if (kind === "deviceFrames") {
        req = new m.pb.StreamDeviceFramesRequest();
        req.setDevEui(id);
        method = "streamDeviceFrames";
      } else {
        req = new m.pb.StreamDeviceEventsRequest();
        req.setDevEui(id);
        method = "streamDeviceEvents";
      }
      const s = c[method](req, md);
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
