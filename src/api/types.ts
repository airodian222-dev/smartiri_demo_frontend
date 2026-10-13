// Types mirror the JSON produced by chirpstack-rest-api (grpc-gateway, camelCase).
// Note: grpc-gateway omits zero values, so most fields are optional.

export type Tags = Record<string, string>;

export interface List<T> {
  totalCount?: number;
  result: T[];
}

export interface Location {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  source?: string;
  accuracy?: number;
}

export interface MetricDataset {
  label: string;
  data: number[];
}

export interface Metric {
  name?: string;
  timestamps: string[];
  datasets: MetricDataset[];
  kind?: "COUNTER" | "ABSOLUTE" | "GAUGE";
}

export type Aggregation = "MINUTE" | "HOUR" | "DAY" | "MONTH";

// ---------- Tenants
export interface Tenant {
  id?: string;
  name: string;
  description?: string;
  canHaveGateways?: boolean;
  maxGatewayCount?: number;
  maxDeviceCount?: number;
  privateGatewaysUp?: boolean;
  privateGatewaysDown?: boolean;
  tags?: Tags;
}
export interface TenantListItem {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  name: string;
  canHaveGateways?: boolean;
  privateGatewaysUp?: boolean;
  privateGatewaysDown?: boolean;
  maxGatewayCount?: number;
  maxDeviceCount?: number;
}
export interface GetTenantResponse {
  tenant: Tenant;
  createdAt?: string;
  updatedAt?: string;
}
export interface TenantUser {
  tenantId: string;
  userId?: string;
  email: string;
  isAdmin?: boolean;
  isDeviceAdmin?: boolean;
  isGatewayAdmin?: boolean;
}
export interface TenantUserListItem extends TenantUser {
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

// ---------- Users
export interface User {
  id?: string;
  email: string;
  isAdmin?: boolean;
  isActive?: boolean;
  note?: string;
}
export interface UserListItem {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  email: string;
  isAdmin?: boolean;
  isActive?: boolean;
}

// ---------- Gateways
export type GatewayState = "NEVER_SEEN" | "ONLINE" | "OFFLINE";
export interface Gateway {
  gatewayId: string;
  name: string;
  description?: string;
  location?: Location;
  tenantId: string;
  tags?: Tags;
  metadata?: Tags;
  statsInterval?: number;
}
export interface GatewayListItem {
  tenantId: string;
  gatewayId: string;
  name: string;
  description?: string;
  location?: Location;
  properties?: Tags;
  createdAt?: string;
  updatedAt?: string;
  lastSeenAt?: string;
  state?: GatewayState;
}
export interface GetGatewayResponse {
  gateway: Gateway;
  createdAt?: string;
  updatedAt?: string;
  lastSeenAt?: string;
}
export interface GatewayMetrics {
  rxPackets?: Metric;
  txPackets?: Metric;
  txPacketsPerFreq?: Metric;
  rxPacketsPerFreq?: Metric;
  txPacketsPerDr?: Metric;
  rxPacketsPerDr?: Metric;
  txPacketsPerStatus?: Metric;
}

// ---------- Applications
export interface Application {
  id?: string;
  name: string;
  description?: string;
  tenantId: string;
  tags?: Tags;
}
export interface ApplicationListItem {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  name: string;
  description?: string;
}
export interface GetApplicationResponse {
  application: Application;
  createdAt?: string;
  updatedAt?: string;
  measurementKeys?: string[];
}

// ---------- Device profiles
export interface Measurement {
  name?: string;
  kind?: string;
}
export interface DeviceProfile {
  id?: string;
  tenantId: string;
  name: string;
  description?: string;
  region: string;
  macVersion: string;
  regParamsRevision: string;
  adrAlgorithmId?: string;
  payloadCodecRuntime?: string;
  payloadCodecScript?: string;
  flushQueueOnActivate?: boolean;
  uplinkInterval?: number;
  deviceStatusReqInterval?: number;
  supportsOtaa?: boolean;
  supportsClassB?: boolean;
  supportsClassC?: boolean;
  classBTimeout?: number;
  classBPingSlotNbK?: number;
  classBPingSlotPeriodicity?: number;
  classBPingSlotDr?: number;
  classBPingSlotFreq?: number;
  classCTimeout?: number;
  abpRx1Delay?: number;
  abpRx1DrOffset?: number;
  abpRx2Dr?: number;
  abpRx2Freq?: number;
  tags?: Tags;
  measurements?: Record<string, Measurement>;
  autoDetectMeasurements?: boolean;
  regionConfigId?: string;
  allowRoaming?: boolean;
  rx1Delay?: number;
}
export interface DeviceProfileListItem {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  name: string;
  region?: string;
  macVersion?: string;
  regParamsRevision?: string;
  supportsOtaa?: boolean;
  supportsClassB?: boolean;
  supportsClassC?: boolean;
}
export interface GetDeviceProfileResponse {
  deviceProfile: DeviceProfile;
  createdAt?: string;
  updatedAt?: string;
}

// ---------- Devices
export interface DeviceStatus {
  margin?: number;
  externalPowerSource?: boolean;
  batteryLevel?: number;
}
export interface Device {
  devEui: string;
  name: string;
  description?: string;
  applicationId: string;
  deviceProfileId: string;
  skipFcntCheck?: boolean;
  isDisabled?: boolean;
  variables?: Tags;
  tags?: Tags;
  joinEui?: string;
}
export interface DeviceListItem {
  devEui: string;
  createdAt?: string;
  updatedAt?: string;
  lastSeenAt?: string;
  name: string;
  description?: string;
  deviceProfileId: string;
  deviceProfileName: string;
  deviceStatus?: DeviceStatus;
  tags?: Tags;
}
export interface GetDeviceResponse {
  device: Device;
  createdAt?: string;
  updatedAt?: string;
  lastSeenAt?: string;
  deviceStatus?: DeviceStatus;
  classEnabled?: "CLASS_A" | "CLASS_B" | "CLASS_C";
}
export interface DeviceKeys {
  devEui?: string;
  nwkKey: string;
  appKey?: string;
  genAppKey?: string;
}
export interface DeviceActivation {
  devEui?: string;
  devAddr: string;
  appSKey: string;
  nwkSEncKey: string;
  sNwkSIntKey: string;
  fNwkSIntKey: string;
  fCntUp?: number;
  nFCntDown?: number;
  aFCntDown?: number;
}
export interface DeviceState {
  name: string;
  value: string;
}
export interface DeviceMetrics {
  metrics: Record<string, Metric>;
  states?: Record<string, DeviceState>;
}
export interface DeviceLinkMetrics {
  rxPackets?: Metric;
  gwRssi?: Metric;
  gwSnr?: Metric;
  rxPacketsPerFreq?: Metric;
  rxPacketsPerDr?: Metric;
  errors?: Metric;
}

// ---------- Internal
export interface DevicesSummary {
  activeCount: number;
  inactiveCount: number;
  neverSeenCount: number;
  drCount: Record<string, number>;
}
export interface GatewaysSummary {
  onlineCount: number;
  offlineCount: number;
  neverSeenCount: number;
}
export interface LogItem {
  id: string;
  time: string;
  description: string;
  body: string; // JSON
  properties: Record<string, string>;
}
export interface GlobalSearchResult {
  kind: "device" | "gateway" | "tenant" | "application" | string;
  score?: number;
  tenantId?: string;
  tenantName?: string;
  applicationId?: string;
  applicationName?: string;
  deviceDevEui?: string;
  deviceName?: string;
  gatewayId?: string;
  gatewayName?: string;
}
export interface Profile {
  user?: User;
  tenants: { tenantId: string; isAdmin?: boolean; isDeviceAdmin?: boolean; isGatewayAdmin?: boolean }[];
}

/** A live event pushed by the simulator (demo) used for the global feed. */
export interface FeedEvent {
  id: string;
  time: string;
  type: string; // up, join, status, ack, txack, log, location
  devEui: string;
  deviceName: string;
  applicationId: string;
  applicationName: string;
  tenantId: string;
  summary: string;
  body: Record<string, unknown>;
}
