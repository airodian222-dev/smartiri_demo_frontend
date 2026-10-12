import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Activity, AppWindow, Boxes, Building2, ChevronDown, Cpu, FileCog, Gauge, Globe, KeyRound, LayoutDashboard, LogOut, Map, Menu, Monitor,
  Moon, RadioTower, Search, Server, Settings, Sun, Users, X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { globalSearch } from "@/api/internal";
import { useSession } from "@/context/session";
import { useTheme } from "@/context/theme";
import { Badge, Spinner } from "./ui";

function NavItem({ to, icon, children, end }: { to: string; icon: ReactNode; children: ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
          isActive ? "bg-brand/10 text-brand font-medium" : "text-ink2 hover:bg-raised hover:text-ink",
        )
      }
    >
      <span className="h-4 w-4 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {children}
    </NavLink>
  );
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <div className="px-2.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function TenantSelector() {
  const { tenants, tenantId, setTenantId } = useSession();
  const nav = useNavigate();
  return (
    <div className="relative">
      <Building2 className="h-4 w-4 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <select
        className="input pl-8 pr-8 py-1.5 appearance-none font-medium"
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
      <ChevronDown className="h-4 w-4 text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const { setTenantId } = useSession();
  const res = useQuery({ queryKey: ["search", q], queryFn: () => globalSearch(q), enabled: q.trim().length >= 2 });
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="h-4 w-4 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
      <input
        className="input pl-8 py-1.5"
        placeholder="Search devices, gateways, applications…"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full card shadow-lg max-h-96 overflow-auto py-1">
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
              <button key={i} onClick={go} className="w-full text-left px-3 py-2 hover:bg-raised flex items-center gap-2.5">
                <span className="text-muted">{icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm truncate">{name}</span>
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
  const next = pref === "light" ? "dark" : pref === "dark" ? "system" : "light";
  const Icon = pref === "light" ? Sun : pref === "dark" ? Moon : Monitor;
  return (
    <button className="btn-ghost" title={`Theme: ${pref} (click for ${next})`} onClick={() => setPref(next)}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function Layout() {
  const { config, disconnect, isAdmin, tenant } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMobileOpen(false), [loc.pathname]);

  const sidebar = (
    <nav className="flex flex-col h-full">
      <Link to="/" className="flex items-center gap-2.5 px-4 h-14 border-b border-line shrink-0">
        <img src="/favicon.svg" className="h-7 w-7" alt="" />
        <div className="leading-tight">
          <div className="font-semibold text-sm">SmartIRI</div>
          <div className="text-[11px] text-muted">IoT Console · ChirpStack</div>
        </div>
      </Link>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <Section title="Tenant">
          <div className="px-0.5 pb-2">
            <TenantSelector />
          </div>
          <NavItem to="/" end icon={<LayoutDashboard />}>Dashboard</NavItem>
          <NavItem to="/devices" icon={<Cpu />}>Devices</NavItem>
          <NavItem to="/gateways" icon={<RadioTower />}>Gateways</NavItem>
          <NavItem to="/applications" icon={<AppWindow />}>Applications</NavItem>
          <NavItem to="/device-profiles" icon={<FileCog />}>Device profiles</NavItem>
          <NavItem to="/events" icon={<Activity />}>Live events</NavItem>
          <NavItem to="/map" icon={<Map />}>Map</NavItem>
          <NavItem to="/tenant/users" icon={<Users />}>Tenant users</NavItem>
          <NavItem to="/tenant/api-keys" icon={<KeyRound />}>Tenant API keys</NavItem>
        </Section>
        {isAdmin && (
          <Section title="Network server">
            <NavItem to="/network" icon={<Gauge />}>Overview</NavItem>
            <NavItem to="/tenants" icon={<Building2 />}>Tenants</NavItem>
            <NavItem to="/users" icon={<Users />}>Users</NavItem>
            <NavItem to="/api-keys" icon={<KeyRound />}>API keys</NavItem>
            <NavItem to="/device-profile-templates" icon={<Boxes />}>Profile templates</NavItem>
            <NavItem to="/regions" icon={<Globe />}>Regions</NavItem>
          </Section>
        )}
      </div>
      <div className="border-t border-line p-3 space-y-0.5">
        <NavItem to="/settings" icon={<Settings />}>Connection</NavItem>
      </div>
    </nav>
  );

  return (
    <div className="h-full flex">
      <aside className="hidden lg:block w-60 shrink-0 bg-surface border-r border-line">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[900] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-surface border-r border-line">{sidebar}</aside>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 bg-surface border-b border-line flex items-center gap-3 px-4">
          <button className="btn-ghost lg:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <GlobalSearch />
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-2">
            {config?.mode === "demo" ? (
              <Badge tone="warn" dot>Demo · simulated network</Badge>
            ) : (
              <Badge tone="good" dot>
                <Server className="h-3 w-3" /> Live
              </Badge>
            )}
            {tenant && <span className="text-xs text-muted hidden md:inline">{tenant.name}</span>}
          </div>
          <ThemeSwitch />
          <button className="btn-ghost" title="Disconnect" onClick={disconnect}>
            <LogOut className="h-4 w-4" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
