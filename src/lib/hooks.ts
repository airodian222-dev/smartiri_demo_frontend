import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import * as api from "@/api/chirpstack";
import { streamDeviceEvents } from "@/api/internal";
import type { DeviceListItem, FeedEvent, LogItem } from "@/api/types";
import { useToast } from "@/context/toast";
import { isDemo } from "./config";

export type TenantDevice = DeviceListItem & { applicationId: string; applicationName: string };

/** ChirpStack lists devices per application; aggregate across all applications of a tenant. */
export function useTenantDevices(tenantId: string | null) {
  return useQuery({
    queryKey: ["devices", "tenant", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<TenantDevice[]> => {
      const apps = await api.applications.list(tenantId!, { limit: 500 });
      const lists = await Promise.all(
        (apps.result ?? []).map(async (a) => {
          const r = await api.devices.list(a.id, { limit: 1000 });
          return (r.result ?? []).map((d) => ({ ...d, applicationId: a.id, applicationName: a.name }));
        }),
      );
      return lists.flat();
    },
  });
}

/** Mutation that toasts on success/error and invalidates the given query keys. */
export function useAction<V, R = unknown>(fn: (v: V) => Promise<R>, opts: { success?: string; invalidate?: QueryKey[]; onSuccess?: (r: R, v: V) => void } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      if (opts.success) toast.success(opts.success);
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      opts.onSuccess?.(r, v);
    },
    onError: (e) => toast.error(e),
  });
}

/** Subscribe to a device's live event stream. */
export function useDeviceEvents(id: string | undefined, max = 200) {
  const [items, setItems] = useState<LogItem[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!id || paused) return;
    setError(null);
    const unsub = streamDeviceEvents(
      id,
      (item) => setItems((prev) => (prev.some((p) => p.id === item.id) ? prev : [item, ...prev].slice(0, max))),
      (e) => setError(e),
    );
    return unsub;
  }, [id, paused, max]);
  return { items, error, paused, setPaused, clear: () => setItems([]) };
}

/** Network-wide live event feed. Only the demo simulator can provide this (ChirpStack streams are per device). */
export function useFeed(max = 100) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  useEffect(() => {
    if (!isDemo()) return;
    let unsub: (() => void) | undefined;
    let alive = true;
    import("@/mock/simulator").then((sim) => {
      if (!alive) return;
      unsub = sim.subscribeFeed((e) => setEvents((prev) => [e, ...prev].slice(0, max)));
    });
    return () => {
      alive = false;
      unsub?.();
    };
  }, [max]);
  return events;
}
