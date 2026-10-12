import { Cpu, Play, RadioTower, Server, Zap } from "lucide-react";
import { useState } from "react";
import { login } from "@/api/internal";
import { Field, Spinner, Toggle } from "@/components/ui";
import { useSession } from "@/context/session";
import { setConfig, type ConnectionConfig } from "@/lib/config";

export default function Login() {
  const { connect } = useSession();
  const [restUrl, setRestUrl] = useState("");
  const [grpcUrl, setGrpcUrl] = useState("");
  const [token, setToken] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [email, setEmail] = useState("admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function connectLive(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const cfg: ConnectionConfig = { mode: "live", restUrl: restUrl.trim(), grpcUrl: grpcUrl.trim(), token: token.trim(), tenantId: tenantId.trim() || undefined };
      if (usePassword) {
        setConfig({ ...cfg, token: "" });
        cfg.token = await login(email, password);
      }
      connect(cfg);
    } catch (e) {
      setConfig(null);
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-brand text-white relative overflow-hidden">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" className="h-9 w-9 rounded-lg ring-2 ring-white/30" alt="" />
          <div>
            <div className="font-semibold text-lg">SmartIRI IoT Console</div>
            <div className="text-white/70 text-sm">A modern dashboard for ChirpStack v4</div>
          </div>
        </div>
        <div className="space-y-6 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">Every ChirpStack function, in one clear IoT dashboard.</h1>
          <ul className="space-y-3 text-white/85 text-sm">
            <li className="flex gap-3"><Cpu className="h-5 w-5 shrink-0" /> Devices: provisioning, OTAA keys, ABP activation, downlink queue, live events & LoRaWAN frames, metrics.</li>
            <li className="flex gap-3"><RadioTower className="h-5 w-5 shrink-0" /> Gateways: map, status, RX/TX metrics, live frames, client certificates.</li>
            <li className="flex gap-3"><Server className="h-5 w-5 shrink-0" /> Tenants, users, API keys, applications, integrations, device profiles, multicast groups, regions.</li>
          </ul>
        </div>
        <div className="text-white/60 text-xs">Uses the ChirpStack REST API (chirpstack-rest-api) and gRPC-web for live streams.</div>
        <div className="absolute -right-24 -bottom-24 h-80 w-80 rounded-full border-[40px] border-white/10" />
        <div className="absolute -right-8 -bottom-8 h-48 w-48 rounded-full border-[28px] border-white/10" />
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-3">
            <img src="/favicon.svg" className="h-9 w-9" alt="" />
            <div className="font-semibold text-lg">SmartIRI IoT Console</div>
          </div>

          <div className="card p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-warn/20 grid place-items-center shrink-0">
                <Zap className="h-5 w-5 text-ink" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">Explore the demo</h2>
                <p className="text-sm text-muted mt-0.5">A simulated ChirpStack network with 2 tenants, 7 gateways and 29 devices sending live uplinks. Everything is editable; changes are kept in your browser.</p>
              </div>
            </div>
            <button className="btn-primary w-full mt-4" onClick={() => connect({ mode: "demo", restUrl: "", grpcUrl: "", token: "" })}>
              <Play className="h-4 w-4" /> Launch demo
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted">
            <div className="h-px flex-1 bg-line" /> or connect to your ChirpStack <div className="h-px flex-1 bg-line" />
          </div>

          <form className="card p-5 space-y-4" onSubmit={connectLive}>
            <Field label="REST API URL" help="chirpstack-rest-api base URL. Leave empty to use this site's /api proxy (see README).">
              <input className="input" placeholder="http://localhost:8090" value={restUrl} onChange={(e) => setRestUrl(e.target.value)} />
            </Field>
            <Field label="gRPC-web URL" help="ChirpStack server (default port 8080). Used for live frames/events, API keys, regions and summaries.">
              <input className="input" placeholder="http://localhost:8080" value={grpcUrl} onChange={(e) => setGrpcUrl(e.target.value)} />
            </Field>
            <Toggle checked={usePassword} onChange={setUsePassword} label="Log in with e-mail & password" help="Uses ChirpStack's internal login (gRPC-web) to obtain a JWT." />
            {usePassword ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="E-mail">
                  <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Password">
                  <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
              </div>
            ) : (
              <Field label="API token" help="Create one under API keys in ChirpStack. Admin keys unlock network-server pages.">
                <textarea className="input mono h-20" value={token} onChange={(e) => setToken(e.target.value)} placeholder="eyJ0eXAiOiJKV1Qi…" />
              </Field>
            )}
            <Field label="Tenant ID (optional)" help="Needed for tenant API keys, which cannot list tenants.">
              <input className="input mono" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="52f14cd4-c6f1-4fbd-8f87-4025e1d49242" />
            </Field>
            {err && <div className="text-sm text-bad">{err}</div>}
            <button className="btn-secondary w-full" disabled={busy || (!usePassword && !token)}>
              {busy ? <Spinner /> : <Server className="h-4 w-4" />} Connect
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
