import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Activity, AppWindow, Boxes, Building2, ChevronsUpDown, Cpu, FileCog, Gauge, Globe, KeyRound, LayoutDashboard, LogOut, Map, Menu, Monitor,
  Moon, RadioTower, Search, Server, Settings, ShieldCheck, Sun, Users, X, Zap,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { globalSearch } from "@/api/internal";
import { useSession } from "@/context/session";
import { useTheme } from "@/context/theme";
import { Spinner } from "./ui";

function NavItem({ to, icon, children, end, badge }: { to: string; icon: ReactNode; children: ReactNode; end?: boolean; badge?: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition-all",
          isActive ? "bg-gradient-to-r from-indigo-500/25 to-violet-500/10 text-white font-medium ring-1 ring-indigo-400/30" : "text-ink2 hover:bg-white/5 hover:text-white",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-gradient-to-b from-indigo-400 to-cyan-400" />}
          <span className={clsx("h-[18px] w-[18px] shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]", isActive ? "text-indigo-300" : "text-muted group-hover:text-ink2")}>{icon}</span>
          <span className="flex-1">{children}</span>
          {badge}
        </>
      )}
    </NavLink>
  );
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <div className="px-3 mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted/80">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function WorkspaceSwitcher() {
  const { tenants, tenantId, setTenantId, tenant } = useSession();
  const nav = useNavigate();
  const initials = (tenant?.name ?? "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <label className="relative flex items-center gap-3 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-3 py-2.5 cursor-pointer hover:bg-white/[0.07] transition">
      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 grid place-items-center text-xs font-bold text-white shrink-0">{initials}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] uppercase tracking-wider text-muted">Workspace</div>
        <div className="text-sm font-semibold text-white truncate">{tenant?.name ?? "—"}</div>
      </div>
      <ChevronsUpDown className="h-4 w-4 text-muted" />
      <select
        className="absolute inset-0 opacity-0 cursor-pointer"
        value={tenantId ?? ""}
        onChange={(e) => {
          setTenantId(e.target.value);
          nav("/");
        }}
      >
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const { setTenantId } = useSession();
  const res = useQuery({ queryKey: ["search", q], queryFn: () => globalSearch(q), enabled: q.trim().length >= 2 });
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, []);
  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="h-4 w-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        ref={input}
        className="input pl-9 pr-14 py-2 rounded-xl bg-surface/60"
        placeholder="Search devices, gateways, apps…"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      <kbd className="hidden sm:block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted border border-line rounded-md px-1.5 py-0.5 font-mono">⌘K</kbd>
      {open && q.trim().length >= 2 && (
        <div className="absolute z-50 mt-2 w-full card bg-surface shadow-2xl max-h-96 overflow-auto p-1.5">
          {res.isLoading && (
            <div className="px-3 py-2 text-sm text-muted flex items-center gap-2">
              <Spinner /> Searching…
            </div>
          )}
          {res.error && <div className="px-3 py-2 text-sm text-bad">{(res.error as Error).message}</div>}
          {res.data?.length === 0 && <div className="px-3 py-2 text-sm text-muted">No results</div>}
          {res.data?.map((r, i) => {
            const go = () => {
              if (r.tenantId) setTenantId(r.tenantId);
              setOpen(false);
              setQ("");
              if (r.kind === "device") nav(`/devices/${r.deviceDevEui}`);
              else if (r.kind === "gateway") nav(`/gateways/${r.gatewayId}`);
              else if (r.kind === "application") nav(`/applications/${r.applicationId}`);
              else nav(`/tenants/${r.tenantId}`);
            };
            const icon = r.kind === "device" ? <Cpu className="h-4 w-4" /> : r.kind === "gateway" ? <RadioTower className="h-4 w-4" /> : r.kind === "application" ? <AppWindow className="h-4 w-4" /> : <Building2 className="h-4 w-4" />;
            const name = r.deviceName || r.gatewayName || r.applicationName || r.tenantName;
            const sub = r.kind === "device" ? `${r.deviceDevEui} · ${r.applicationName}` : r.kind === "gateway" ? r.gatewayId : r.kind;
            return (
              <button key={i} onClick={go} className="w-full text-left px-3 py-2 rounded-xl hover:bg-brand/10 flex items-center gap-3">
                <span className="h-8 w-8 rounded-lg bg-brand/12 text-brand grid place-items-center">{icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{name}</span>
                  <span className="block text-xs text-muted truncate mono">{sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ThemeSwitch() {
  const { pref, setPref } = useTheme();
  const opts = [
    { k: "light" as const, i: <Sun className="h-3.5 w-3.5" /> },
    { k: "dark" as const, i: <Moon className="h-3.5 w-3.5" /> },
    { k: "system" as const, i: <Monitor className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="hidden sm:inline-flex rounded-xl border border-line bg-surface/60 p-0.5">
      {opts.map((o) => (
        <button key={o.k} title={`${o.k} theme`} onClick={() => setPref(o.k)} className={clsx("h-7 w-7 grid place-items-center rounded-lg transition", pref === o.k ? "gradient-brand text-white" : "text-muted hover:text-ink")}>
          {o.i}
        </button>
      ))}
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden xl:block text-right leading-tight">
      <div className="text-sm font-semibold tnum">{now.toLocaleTimeString(undefined, { hour12: false })}</div>
      <div className="text-[11px] text-muted">{now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</div>
    </div>
  );
}

export function Layout() {
  const { config, disconnect, isAdmin } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMobileOpen(false), [loc.pathname]);
  const demo = config?.mode === "demo";

  const sidebar = (
    <nav className="sidebar flex flex-col h-full bg-[radial-gradient(120%_60%_at_0%_0%,rgba(99,102,241,0.22),transparent_60%),linear-gradient(180deg,#0b1024,#070a18)] text-ink border-r border-white/5">
      <Link to="/" className="flex items-center gap-3 px-5 h-16 shrink-0">
        <img src="/favicon.svg" className="h-9 w-9 drop-shadow-[0_6px_16px_rgba(99,102,241,0.6)]" alt="" />
        <div className="leading-tight">
          <div className="font-bold text-[15px] text-white tracking-tight">SmartIRI</div>
          <div className="text-[11px] text-muted">IoT Command Center</div>
        </div>
      </Link>
      <div className="px-3 pb-3">
        <WorkspaceSwitcher />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <Section title="Monitor">
          <NavItem to="/" end icon={<LayoutDashboard />}>Overview</NavItem>
          <NavItem to="/events" icon={<Activity />} badge={demo ? <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" /> : undefined}>Live stream</NavItem>
          <NavItem to="/map" icon={<Map />}>Map</NavItem>
        </Section>
        <Section title="Fleet">
          <NavItem to="/devices" icon={<Cpu />}>Devices</NavItem>
          <NavItem to="/gateways" icon={<RadioTower />}>Gateways</NavItem>
          <NavItem to="/applications" icon={<AppWindow />}>Applications</NavItem>
        </Section>
        <Section title="Configure">
          <NavItem to="/device-profiles" icon={<FileCog />}>Device profiles</NavItem>
          <NavItem to="/tenant/users" icon={<Users />}>Team</NavItem>
          <NavItem to="/tenant/api-keys" icon={<KeyRound />}>Access tokens</NavItem>
        </Section>
        {isAdmin && (
          <Section title="Platform">
            <NavItem to="/network" icon={<Gauge />}>Network overview</NavItem>
            <NavItem to="/tenants" icon={<Building2 />}>Workspaces</NavItem>
            <NavItem to="/users" icon={<ShieldCheck />}>Users</NavItem>
            <NavItem to="/api-keys" icon={<KeyRound />}>Admin tokens</NavItem>
            <NavItem to="/device-profile-templates" icon={<Boxes />}>Device catalog</NavItem>
            <NavItem to="/regions" icon={<Globe />}>Regions</NavItem>
          </Section>
        )}
      </div>
      <div className="p-3">
        <Link to="/settings" className="block rounded-2xl p-3 ring-1 ring-white/10 bg-gradient-to-br from-indigo-500/15 to-cyan-500/5 hover:from-indigo-500/25 transition">
          <div className="flex items-center gap-2.5">
            <div className={clsx("h-8 w-8 rounded-lg grid place-items-center", demo ? "bg-amber-400/15 text-amber-300" : "bg-emerald-400/15 text-emerald-300")}>
              {demo ? <Zap className="h-4 w-4" /> : <Server className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-white">{demo ? "Demo network" : "Live ChirpStack"}</div>
              <div className="text-[11px] text-muted truncate">{demo ? "Simulated traffic" : config?.restUrl || "same-origin"}</div>
            </div>
            <Settings className="h-4 w-4 text-muted" />
          </div>
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="h-full flex">
      <aside className="hidden lg:block w-[260px] shrink-0">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[900] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[270px]">{sidebar}</aside>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 shrink-0 flex items-center gap-3 px-4 sm:px-6 border-b border-line/60 bg-page/60 backdrop-blur-xl sticky top-0 z-40">
          <button className="btn-ghost lg:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <GlobalSearch />
          <div className="flex-1" />
          <Clock />
          <ThemeSwitch />
          <div className="flex items-center gap-2 pl-2 border-l border-line">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 grid place-items-center text-[11px] font-bold text-white">AD</div>
            <button className="btn-ghost px-2" title="Disconnect" onClick={disconnect}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8 py-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
