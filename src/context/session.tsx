import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as api from "@/api/chirpstack";
import type { TenantListItem } from "@/api/types";
import { getConfig, setConfig, type ConnectionConfig } from "@/lib/config";

interface SessionCtx {
  config: ConnectionConfig | null;
  connect: (cfg: ConnectionConfig) => void;
  disconnect: () => void;
  tenants: TenantListItem[];
  tenantsError: unknown;
  tenantId: string | null;
  tenant: TenantListItem | undefined;
  setTenantId: (id: string) => void;
  /** true when tenants can be listed, i.e. the token has admin rights */
  isAdmin: boolean;
}

const Ctx = createContext<SessionCtx>(null as unknown as SessionCtx);
const TENANT_KEY = "smartiri.tenant";

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [config, setCfg] = useState<ConnectionConfig | null>(getConfig());
  const [tenantId, setTenantIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TENANT_KEY);
    } catch {
      return null;
    }
  });

  const tenantsQ = useQuery({
    queryKey: ["tenants", "all", config?.mode, config?.restUrl, config?.token],
    queryFn: () => api.tenants.list({ limit: 500 }),
    enabled: !!config,
    retry: false,
  });

  const tenants = useMemo(() => {
    const list = tenantsQ.data?.result ?? [];
    if (!list.length && config?.tenantId) return [{ id: config.tenantId, name: "Tenant " + config.tenantId.slice(0, 8) } as TenantListItem];
    return list;
  }, [tenantsQ.data, config?.tenantId]);

  useEffect(() => {
    if (!tenants.length) return;
    if (!tenantId || !tenants.some((t) => t.id === tenantId)) {
      const pref = config?.tenantId && tenants.find((t) => t.id === config.tenantId);
      setTenantId((pref || tenants[0]).id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenants]);

  function setTenantId(id: string) {
    setTenantIdState(id);
    try {
      localStorage.setItem(TENANT_KEY, id);
    } catch {
      /* ignore */
    }
  }

  const value: SessionCtx = {
    config,
    connect: (cfg) => {
      setConfig(cfg);
      setCfg(cfg);
      qc.clear();
    },
    disconnect: () => {
      setConfig(null);
      setCfg(null);
      qc.clear();
    },
    tenants,
    tenantsError: tenantsQ.error,
    tenantId,
    tenant: tenants.find((t) => t.id === tenantId),
    setTenantId,
    isAdmin: !!tenantsQ.data,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

/** Returns the selected tenant id, or throws for pages that require one. */
export function useTenantId(): string {
  const { tenantId } = useSession();
  return tenantId ?? "";
}
