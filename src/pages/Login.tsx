import { Activity, Cpu, Play, RadioTower, Server } from "lucide-react";
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
    <div data-theme="dark" className="min-h-full relative overflow-hidden bg-[#060914] text-ink" style={{ colorScheme: "dark" }}>
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_15%_10%,rgba(99,102,241,0.35),transparent_60%),radial-gradient(50%_50%_at_90%_20%,rgba(6,182,212,0.25),transparent_60%),radial-gradient(60%_60%_at_60%_100%,rgba(168,85,247,0.25),transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="relative min-h-full grid lg:grid-cols-[1.1fr_1fr] gap-10 max-w-7xl mx-auto px-6 py-10 lg:py-16 items-center">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" className="h-11 w-11 drop-shadow-[0_8px_24px_rgba(99,102,241,0.7)]" alt="" />
            <div>
              <div className="font-bold text-lg text-white">SmartIRI</div>
              <div className="text-sm text-slate-400">IoT Command Center</div>
            </div>
          </div>
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" /> Powered by ChirpStack v4 · LoRaWAN®
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] text-white">
              See every sensor,<br />
              <span className="gradient-text">every signal, live.</span>
            </h1>
            <p className="mt-4 text-slate-300 max-w-lg">A real-time command center for your LoRaWAN network: live sensor data, gateway coverage, device health and fleet management in one place.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-lg">
            {[
              { i: <Cpu className="h-5 w-5" />, v: "29", l: "devices", g: "from-indigo-500 to-violet-500" },
              { i: <RadioTower className="h-5 w-5" />, v: "7", l: "gateways", g: "from-cyan-500 to-sky-500" },
              { i: <Activity className="h-5 w-5" />, v: "Live", l: "uplinks", g: "from-emerald-500 to-teal-500" },
            ].map((x) => (
              <div key={x.l} className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur p-4">
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${x.g} text-white grid place-items-center shadow-lg`}>{x.i}</div>
                <div className="mt-3 text-2xl font-bold text-white">{x.v}</div>
                <div className="text-xs text-slate-400">demo {x.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-md lg:ml-auto">
          <div className="rounded-3xl border border-white/10 bg-[#0d1328]/80 backdrop-blur-2xl shadow-[0_40px_120px_-40px_rgba(99,102,241,0.7)] p-6 sm:p-7">
            <h2 className="text-xl font-bold text-white">Welcome</h2>
            <p className="text-sm text-slate-400 mt-1">Explore instantly, or connect your own ChirpStack.</p>
            <button className="btn-primary w-full mt-5 py-3 text-[15px]" onClick={() => connect({ mode: "demo", restUrl: "", grpcUrl: "", token: "" })}>
              <Play className="h-4 w-4" /> Launch demo
            </button>
            <p className="text-xs text-slate-500 mt-2 text-center">Simulated network · edits are kept in your browser</p>
            <div className="flex items-center gap-3 text-xs text-slate-500 my-6">
              <div className="h-px flex-1 bg-white/10" /> or connect to ChirpStack <div className="h-px flex-1 bg-white/10" />
            </div>
          <form className="space-y-4" onSubmit={connectLive}>
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
    </div>
  );
}
