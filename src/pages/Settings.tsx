import { useQuery } from "@tanstack/react-query";
import { Database, RotateCcw, Server, Settings as SettingsIcon } from "lucide-react";
import { useState } from "react";
import { getVersion } from "@/api/internal";
import { Badge, Card, ConfirmButton, Field, FormActions, KV, PageHeader } from "@/components/ui";
import { useSession } from "@/context/session";
import { useToast } from "@/context/toast";

export default function Settings() {
  const { config, connect, disconnect, tenantsError, isAdmin } = useSession();
  const toast = useToast();
  const [restUrl, setRestUrl] = useState(config?.restUrl ?? "");
  const [grpcUrl, setGrpcUrl] = useState(config?.grpcUrl ?? "");
  const [token, setToken] = useState(config?.token ?? "");
  const [tenantId, setTenantId] = useState(config?.tenantId ?? "");
  const version = useQuery({ queryKey: ["version", config?.mode], queryFn: getVersion, retry: false });
  const live = config?.mode === "live";

  return (
    <div className="max-w-3xl">
      <PageHeader title="Connection" icon={<SettingsIcon className="h-5 w-5" />} subtitle="How this console talks to ChirpStack." />
      <div className="space-y-5">
        <Card title="Status">
          <KV
            items={[
              ["Mode", live ? <Badge tone="good" dot>Live ChirpStack</Badge> : <Badge tone="warn" dot>Demo (in-browser simulator)</Badge>],
              ["ChirpStack version", version.isLoading ? "…" : version.error ? <span className="text-bad text-xs">{(version.error as Error).message}</span> : version.data],
              ["Permissions", isAdmin ? "Global admin (can list tenants)" : "Tenant scoped"],
              ["Tenants", tenantsError ? <span className="text-bad text-xs">{(tenantsError as Error).message}</span> : "OK"],
            ]}
          />
        </Card>

        {live ? (
          <Card title="Live connection" subtitle="Changes apply immediately.">
            <div className="space-y-4">
              <Field label="REST API URL" help="Empty = same origin (/api proxied by the dev server).">
                <input className="input" value={restUrl} onChange={(e) => setRestUrl(e.target.value)} placeholder="http://localhost:8090" />
              </Field>
              <Field label="gRPC-web URL" help="Empty = same origin.">
                <input className="input" value={grpcUrl} onChange={(e) => setGrpcUrl(e.target.value)} placeholder="http://localhost:8080" />
              </Field>
              <Field label="API token / JWT">
                <textarea className="input mono h-20" value={token} onChange={(e) => setToken(e.target.value)} />
              </Field>
              <Field label="Default tenant ID">
                <input className="input mono" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
              </Field>
            </div>
            <FormActions>
              <button className="btn-secondary" onClick={disconnect}>Disconnect</button>
              <button
                className="btn-primary"
                onClick={() => {
                  connect({ mode: "live", restUrl, grpcUrl, token, tenantId: tenantId || undefined });
                  toast.success("Connection updated");
                }}
              >
                <Server className="h-4 w-4" /> Save & reconnect
              </button>
            </FormActions>
          </Card>
        ) : (
          <Card title="Demo data" subtitle="The simulator stores your edits in this browser's local storage.">
            <p className="text-sm text-ink2">
              Devices send uplinks every few seconds, gateways report statistics, downlinks you enqueue are transmitted (Class A after the next uplink, Class C immediately) and confirmed downlinks are acknowledged.
            </p>
            <FormActions>
              <ConfirmButton
                title="Reset demo data?"
                message="All tenants, devices, gateways and other objects return to their initial state."
                confirmLabel="Reset"
                onConfirm={async () => {
                  const { resetDb } = await import("@/mock/db");
                  resetDb();
                  window.location.reload();
                }}
              >
                <RotateCcw className="h-4 w-4" /> Reset demo data
              </ConfirmButton>
              <button className="btn-primary" onClick={disconnect}>
                <Database className="h-4 w-4" /> Connect to a real ChirpStack
              </button>
            </FormActions>
          </Card>
        )}
      </div>
    </div>
  );
}
