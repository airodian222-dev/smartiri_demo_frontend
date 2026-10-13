import { rest } from "./http";
import type * as T from "./types";

type Paged = { limit?: number; offset?: number; search?: string };
const pg = (p?: Paged) => ({ limit: p?.limit ?? 100, offset: p?.offset ?? 0, search: p?.search });

export interface MetricsWindow {
  start: string;
  end: string;
  aggregation: T.Aggregation;
}

// ---------------- Tenants
export const tenants = {
  list: (p?: Paged) => rest<T.List<T.TenantListItem>>("GET", "/api/tenants", { query: pg(p) }),
  get: (id: string) => rest<T.GetTenantResponse>("GET", `/api/tenants/${id}`),
  create: (tenant: T.Tenant) => rest<{ id: string }>("POST", "/api/tenants", { body: { tenant } }),
  update: (tenant: T.Tenant) => rest("PUT", `/api/tenants/${tenant.id}`, { body: { tenant } }),
  delete: (id: string) => rest("DELETE", `/api/tenants/${id}`),
  listUsers: (tenantId: string, p?: Paged) =>
    rest<T.List<T.TenantUserListItem>>("GET", `/api/tenants/${tenantId}/users`, { query: pg(p) }),
  addUser: (tenantUser: T.TenantUser) =>
    rest("POST", `/api/tenants/${tenantUser.tenantId}/users`, { body: { tenantUser } }),
  updateUser: (tenantUser: T.TenantUser) =>
    rest("PUT", `/api/tenants/${tenantUser.tenantId}/users/${tenantUser.userId}`, { body: { tenantUser } }),
  deleteUser: (tenantId: string, userId: string) => rest("DELETE", `/api/tenants/${tenantId}/users/${userId}`),
};

// ---------------- Users
export const users = {
  list: (p?: Paged) => rest<T.List<T.UserListItem>>("GET", "/api/users", { query: pg(p) }),
  get: (id: string) =>
    rest<{ user: T.User; createdAt?: string; updatedAt?: string }>("GET", `/api/users/${id}`),
  create: (user: T.User, password: string, tenants: { tenantId: string; isAdmin?: boolean }[] = []) =>
    rest<{ id: string }>("POST", "/api/users", { body: { user, password, tenants } }),
  update: (user: T.User) => rest("PUT", `/api/users/${user.id}`, { body: { user } }),
  delete: (id: string) => rest("DELETE", `/api/users/${id}`),
  updatePassword: (userId: string, password: string) =>
    rest("POST", `/api/users/${userId}/password`, { body: { userId, password } }),
};

// ---------------- Gateways
export const gateways = {
  list: (tenantId: string | undefined, p?: Paged) =>
    rest<T.List<T.GatewayListItem>>("GET", "/api/gateways", { query: { ...pg(p), tenantId } }),
  get: (id: string) => rest<T.GetGatewayResponse>("GET", `/api/gateways/${id}`),
  create: (gateway: T.Gateway) => rest("POST", "/api/gateways", { body: { gateway } }),
  update: (gateway: T.Gateway) => rest("PUT", `/api/gateways/${gateway.gatewayId}`, { body: { gateway } }),
  delete: (id: string) => rest("DELETE", `/api/gateways/${id}`),
  metrics: (id: string, w: MetricsWindow) =>
    rest<T.GatewayMetrics>("GET", `/api/gateways/${id}/metrics`, { query: { ...w } }),
};

// ---------------- Applications
export const applications = {
  list: (tenantId: string, p?: Paged) =>
    rest<T.List<T.ApplicationListItem>>("GET", "/api/applications", { query: { ...pg(p), tenantId } }),
  get: (id: string) => rest<T.GetApplicationResponse>("GET", `/api/applications/${id}`),
  create: (application: T.Application) => rest<{ id: string }>("POST", "/api/applications", { body: { application } }),
  update: (application: T.Application) =>
    rest("PUT", `/api/applications/${application.id}`, { body: { application } }),
  delete: (id: string) => rest("DELETE", `/api/applications/${id}`),
};

// ---------------- Device profiles
export const deviceProfiles = {
  list: (tenantId: string, p?: Paged) =>
    rest<T.List<T.DeviceProfileListItem>>("GET", "/api/device-profiles", { query: { ...pg(p), tenantId } }),
  get: (id: string) => rest<T.GetDeviceProfileResponse>("GET", `/api/device-profiles/${id}`),
  create: (deviceProfile: T.DeviceProfile) =>
    rest<{ id: string }>("POST", "/api/device-profiles", { body: { deviceProfile } }),
  update: (deviceProfile: T.DeviceProfile) =>
    rest("PUT", `/api/device-profiles/${deviceProfile.id}`, { body: { deviceProfile } }),
  delete: (id: string) => rest("DELETE", `/api/device-profiles/${id}`),
};

// ---------------- Devices
export const devices = {
  list: (applicationId: string, p?: Paged) =>
    rest<T.List<T.DeviceListItem>>("GET", "/api/devices", { query: { ...pg(p), applicationId } }),
  get: (devEui: string) => rest<T.GetDeviceResponse>("GET", `/api/devices/${devEui}`),
  create: (device: T.Device) => rest("POST", "/api/devices", { body: { device } }),
  update: (device: T.Device) => rest("PUT", `/api/devices/${device.devEui}`, { body: { device } }),
  delete: (devEui: string) => rest("DELETE", `/api/devices/${devEui}`),

  getKeys: (devEui: string) =>
    rest<{ deviceKeys: T.DeviceKeys; createdAt?: string; updatedAt?: string }>("GET", `/api/devices/${devEui}/keys`),
  createKeys: (devEui: string, deviceKeys: T.DeviceKeys) =>
    rest("POST", `/api/devices/${devEui}/keys`, { body: { deviceKeys: { ...deviceKeys, devEui } } }),
  updateKeys: (devEui: string, deviceKeys: T.DeviceKeys) =>
    rest("PUT", `/api/devices/${devEui}/keys`, { body: { deviceKeys: { ...deviceKeys, devEui } } }),
  deleteKeys: (devEui: string) => rest("DELETE", `/api/devices/${devEui}/keys`),

  metrics: (devEui: string, w: MetricsWindow) =>
    rest<T.DeviceMetrics>("GET", `/api/devices/${devEui}/metrics`, { query: { ...w } }),
  linkMetrics: (devEui: string, w: MetricsWindow) =>
    rest<T.DeviceLinkMetrics>("GET", `/api/devices/${devEui}/link-metrics`, { query: { ...w } }),
};
