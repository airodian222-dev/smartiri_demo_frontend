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
  list: (tenantId: string | undefined, p?: Paged & { multicastGroupId?: string }) =>
    rest<T.List<T.GatewayListItem>>("GET", "/api/gateways", {
      query: { ...pg(p), tenantId, multicastGroupId: p?.multicastGroupId },
    }),
  get: (id: string) => rest<T.GetGatewayResponse>("GET", `/api/gateways/${id}`),
  create: (gateway: T.Gateway) => rest("POST", "/api/gateways", { body: { gateway } }),
  update: (gateway: T.Gateway) => rest("PUT", `/api/gateways/${gateway.gatewayId}`, { body: { gateway } }),
  delete: (id: string) => rest("DELETE", `/api/gateways/${id}`),
  metrics: (id: string, w: MetricsWindow) =>
    rest<T.GatewayMetrics>("GET", `/api/gateways/${id}/metrics`, { query: { ...w } }),
  generateCertificate: (id: string) =>
    rest<T.GatewayCertificate>("POST", `/api/gateways/${id}/generate-certificate`, { body: {} }),
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
  listIntegrations: (id: string) =>
    rest<T.List<T.IntegrationListItem>>("GET", `/api/applications/${id}/integrations`),
  getIntegration: <I = Record<string, unknown>>(id: string, slug: string) =>
    rest<{ integration: I }>("GET", `/api/applications/${id}/integrations/${slug}`),
  createIntegration: (id: string, slug: string, integration: Record<string, unknown>) =>
    rest("POST", `/api/applications/${id}/integrations/${slug}`, {
      body: { integration: { ...integration, applicationId: id } },
    }),
  updateIntegration: (id: string, slug: string, integration: Record<string, unknown>) =>
    rest("PUT", `/api/applications/${id}/integrations/${slug}`, {
      body: { integration: { ...integration, applicationId: id } },
    }),
  deleteIntegration: (id: string, slug: string) => rest("DELETE", `/api/applications/${id}/integrations/${slug}`),
  generateMqttCertificate: (id: string) =>
    rest<T.GatewayCertificate>("POST", `/api/applications/${id}/integrations/mqtt/certificate`, {
      body: { applicationId: id },
    }),
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
  adrAlgorithms: () => rest<T.List<T.AdrAlgorithm>>("GET", "/api/device-profiles/adr-algorithms"),
};

export const deviceProfileTemplates = {
  list: (p?: Paged) =>
    rest<T.List<T.DeviceProfileTemplateListItem>>("GET", "/api/device-profile-templates", { query: pg(p) }),
  get: (id: string) =>
    rest<{ deviceProfileTemplate: T.DeviceProfileTemplate; createdAt?: string; updatedAt?: string }>(
      "GET",
      `/api/device-profile-templates/${id}`,
    ),
  create: (deviceProfileTemplate: T.DeviceProfileTemplate) =>
    rest("POST", "/api/device-profile-templates", { body: { deviceProfileTemplate } }),
  update: (deviceProfileTemplate: T.DeviceProfileTemplate) =>
    rest("PUT", `/api/device-profile-templates/${deviceProfileTemplate.id}`, { body: { deviceProfileTemplate } }),
  delete: (id: string) => rest("DELETE", `/api/device-profile-templates/${id}`),
};

// ---------------- Devices
export const devices = {
  list: (applicationId: string, p?: Paged & { multicastGroupId?: string }) =>
    rest<T.List<T.DeviceListItem>>("GET", "/api/devices", {
      query: { ...pg(p), applicationId, multicastGroupId: p?.multicastGroupId },
    }),
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
  flushDevNonces: (devEui: string) => rest("DELETE", `/api/devices/${devEui}/dev-nonces`),

  getActivation: (devEui: string) =>
    rest<{ deviceActivation?: T.DeviceActivation }>("GET", `/api/devices/${devEui}/activation`),
  activate: (devEui: string, deviceActivation: T.DeviceActivation) =>
    rest("POST", `/api/devices/${devEui}/activate`, { body: { deviceActivation: { ...deviceActivation, devEui } } }),
  deactivate: (devEui: string) => rest("DELETE", `/api/devices/${devEui}/activation`),
  randomDevAddr: (devEui: string) =>
    rest<{ devAddr: string }>("POST", `/api/devices/${devEui}/get-random-dev-addr`, { body: {} }),

  metrics: (devEui: string, w: MetricsWindow) =>
    rest<T.DeviceMetrics>("GET", `/api/devices/${devEui}/metrics`, { query: { ...w } }),
  linkMetrics: (devEui: string, w: MetricsWindow) =>
    rest<T.DeviceLinkMetrics>("GET", `/api/devices/${devEui}/link-metrics`, { query: { ...w } }),

  getQueue: (devEui: string) =>
    rest<T.List<T.DeviceQueueItem>>("GET", `/api/devices/${devEui}/queue`, { query: { countOnly: false } }),
  enqueue: (devEui: string, queueItem: T.DeviceQueueItem) =>
    rest<{ id: string }>("POST", `/api/devices/${devEui}/queue`, { body: { queueItem: { ...queueItem, devEui } } }),
  flushQueue: (devEui: string) => rest("DELETE", `/api/devices/${devEui}/queue`),
  nextFCntDown: (devEui: string) =>
    rest<{ fCntDown?: number }>("POST", `/api/devices/${devEui}/get-next-f-cnt-down`, { body: {} }),
};

// ---------------- Multicast groups
export const multicastGroups = {
  list: (applicationId: string, p?: Paged) =>
    rest<T.List<T.MulticastGroupListItem>>("GET", "/api/multicast-groups", { query: { ...pg(p), applicationId } }),
  get: (id: string) =>
    rest<{ multicastGroup: T.MulticastGroup; createdAt?: string; updatedAt?: string }>(
      "GET",
      `/api/multicast-groups/${id}`,
    ),
  create: (multicastGroup: T.MulticastGroup) =>
    rest<{ id: string }>("POST", "/api/multicast-groups", { body: { multicastGroup } }),
  update: (multicastGroup: T.MulticastGroup) =>
    rest("PUT", `/api/multicast-groups/${multicastGroup.id}`, { body: { multicastGroup } }),
  delete: (id: string) => rest("DELETE", `/api/multicast-groups/${id}`),
  addDevice: (id: string, devEui: string) =>
    rest("POST", `/api/multicast-groups/${id}/devices`, { body: { multicastGroupId: id, devEui } }),
  removeDevice: (id: string, devEui: string) => rest("DELETE", `/api/multicast-groups/${id}/devices/${devEui}`),
  addGateway: (id: string, gatewayId: string) =>
    rest("POST", `/api/multicast-groups/${id}/gateways`, { body: { multicastGroupId: id, gatewayId } }),
  removeGateway: (id: string, gatewayId: string) =>
    rest("DELETE", `/api/multicast-groups/${id}/gateways/${gatewayId}`),
  listQueue: (id: string) =>
    rest<{ items: T.MulticastGroupQueueItem[] }>("GET", `/api/multicast-groups/${id}/queue`),
  enqueue: (id: string, queueItem: Omit<T.MulticastGroupQueueItem, "multicastGroupId">) =>
    rest<{ fCnt: number }>("POST", `/api/multicast-groups/${id}/queue`, {
      body: { queueItem: { ...queueItem, multicastGroupId: id } },
    }),
  flushQueue: (id: string) => rest("DELETE", `/api/multicast-groups/${id}/queue`),
};
