import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useSession } from "./context/session";
import ApplicationDetail from "./pages/ApplicationDetail";
import Applications from "./pages/Applications";
import Dashboard from "./pages/Dashboard";
import DeviceCreate from "./pages/DeviceCreate";
import DeviceDetail from "./pages/DeviceDetail";
import DeviceProfileDetail from "./pages/DeviceProfileDetail";
import DeviceProfiles from "./pages/DeviceProfiles";
import Devices from "./pages/Devices";
import GatewayDetail from "./pages/GatewayDetail";
import Gateways, { GatewayCreate } from "./pages/Gateways";
import LiveEvents from "./pages/LiveEvents";
import Login from "./pages/Login";
import MapView from "./pages/MapView";
import Settings from "./pages/Settings";
import TenantUsers from "./pages/TenantUsers";
import Tenants, { TenantDetail } from "./pages/Tenants";
import Users, { UserDetail } from "./pages/Users";

/** In demo mode, periodically refresh queries that reflect simulated network activity. */
function DemoRefresher() {
  const qc = useQueryClient();
  const { config } = useSession();
  useEffect(() => {
    if (config?.mode !== "demo") return;
    let stop: (() => void) | undefined;
    import("./mock/simulator").then((sim) => {
      sim.startSimulator();
      let last = 0;
      stop = sim.onChange(() => {
        const now = Date.now();
        if (now - last < 5000) return;
        last = now;
        qc.invalidateQueries({ predicate: (q) => ["summary", "devices", "gateways", "device", "gateway", "queue"].includes(String(q.queryKey[0])) });
      });
    });
    return () => stop?.();
  }, [config?.mode, qc]);
  return null;
}

export default function App() {
  const { config } = useSession();
  if (!config) return <Login />;
  return (
    <>
      <DemoRefresher />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tenants" element={<Tenants />} />
          <Route path="tenants/:id" element={<TenantDetail />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="tenant/users" element={<TenantUsers />} />
          <Route path="device-profiles" element={<DeviceProfiles />} />
          <Route path="device-profiles/:id" element={<DeviceProfileDetail />} />
          <Route path="gateways" element={<Gateways />} />
          <Route path="gateways/new" element={<GatewayCreate />} />
          <Route path="gateways/:id" element={<GatewayDetail />} />
          <Route path="applications" element={<Applications />} />
          <Route path="applications/:id" element={<ApplicationDetail />} />
          <Route path="applications/:appId/devices/new" element={<DeviceCreate />} />
          <Route path="devices" element={<Devices />} />
          <Route path="devices/:devEui" element={<DeviceDetail />} />
          <Route path="events" element={<LiveEvents />} />
          <Route path="map" element={<MapView />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
