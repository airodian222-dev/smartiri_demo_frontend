export const REGIONS = [
  "EU868", "US915", "CN779", "EU433", "AU915", "CN470", "AS923", "AS923_2", "AS923_3", "AS923_4", "KR920", "IN865", "RU864", "ISM2400",
] as const;

export const MAC_VERSIONS = [
  "LORAWAN_1_0_0", "LORAWAN_1_0_1", "LORAWAN_1_0_2", "LORAWAN_1_0_3", "LORAWAN_1_0_4", "LORAWAN_1_1_0",
] as const;

export const REG_PARAMS = ["A", "B", "RP002_1_0_0", "RP002_1_0_1", "RP002_1_0_2", "RP002_1_0_3", "RP002_1_0_4", "RP002_1_0_5"] as const;

export const CODEC_RUNTIMES = ["NONE", "CAYENNE_LPP", "JS"] as const;

export const MEASUREMENT_KINDS = ["UNKNOWN", "COUNTER", "ABSOLUTE", "GAUGE", "STRING"] as const;

export const INTEGRATIONS: { kind: string; slug: string; name: string; description: string }[] = [
  { kind: "HTTP", slug: "http", name: "HTTP", description: "Forward events to an HTTP endpoint (JSON or Protobuf)." },
  { kind: "INFLUX_DB", slug: "influxdb", name: "InfluxDB", description: "Write decoded measurements to InfluxDB v1/v2/v3." },
  { kind: "THINGS_BOARD", slug: "thingsboard", name: "ThingsBoard", description: "Publish telemetry and attributes to ThingsBoard." },
  { kind: "MY_DEVICES", slug: "mydevices", name: "myDevices", description: "Forward to the myDevices Cayenne platform." },
  { kind: "GCP_PUB_SUB", slug: "gcp-pub-sub", name: "GCP Pub/Sub", description: "Publish events to a Google Cloud Pub/Sub topic." },
  { kind: "AWS_SNS", slug: "aws-sns", name: "AWS SNS", description: "Publish events to an AWS SNS topic." },
  { kind: "AZURE_SERVICE_BUS", slug: "azure-service-bus", name: "Azure Service Bus", description: "Publish events to an Azure Service Bus." },
  { kind: "PILOT_THINGS", slug: "pilot-things", name: "Pilot Things", description: "Forward events to Pilot Things." },
  { kind: "IFTTT", slug: "ifttt", name: "IFTTT", description: "Trigger IFTTT Webhooks from uplink values." },
  { kind: "BLYNK", slug: "blynk", name: "Blynk", description: "Forward uplinks to the Blynk IoT platform." },
];

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "password" | "select" | "textarea" | "bool" | "list";
  options?: string[];
  help?: string;
};

export const INTEGRATION_FIELDS: Record<string, FieldDef[]> = {
  http: [
    { key: "eventEndpointUrl", label: "Event endpoint URL(s)", help: "Multiple URLs can be separated with a comma." },
    { key: "encoding", label: "Payload encoding", type: "select", options: ["JSON", "PROTOBUF"] },
  ],
  influxdb: [
    { key: "version", label: "InfluxDB version", type: "select", options: ["INFLUXDB_1", "INFLUXDB_2", "INFLUXDB_3"] },
    { key: "endpoint", label: "API endpoint (write)" },
    { key: "db", label: "Database name (v1)" },
    { key: "username", label: "Username (v1)" },
    { key: "password", label: "Password (v1)", type: "password" },
    { key: "retentionPolicyName", label: "Retention policy (v1)" },
    { key: "precision", label: "Precision", type: "select", options: ["NS", "U", "MS", "S", "M", "H"] },
    { key: "organization", label: "Organization (v2/v3)" },
    { key: "bucket", label: "Bucket (v2/v3)" },
    { key: "token", label: "Token (v2/v3)", type: "password" },
  ],
  thingsboard: [{ key: "server", label: "ThingsBoard server", help: "e.g. https://thingsboard.example.com" }],
  mydevices: [{ key: "endpoint", label: "Endpoint" }],
  "gcp-pub-sub": [
    { key: "encoding", label: "Payload encoding", type: "select", options: ["JSON", "PROTOBUF"] },
    { key: "credentialsFile", label: "GCP service-account credentials file (JSON)", type: "textarea" },
    { key: "projectId", label: "Project ID" },
    { key: "topicName", label: "Topic name" },
  ],
  "aws-sns": [
    { key: "encoding", label: "Payload encoding", type: "select", options: ["JSON", "PROTOBUF"] },
    { key: "region", label: "AWS region" },
    { key: "accessKeyId", label: "Access key ID" },
    { key: "secretAccessKey", label: "Secret access key", type: "password" },
    { key: "topicArn", label: "Topic ARN" },
  ],
  "azure-service-bus": [
    { key: "encoding", label: "Payload encoding", type: "select", options: ["JSON", "PROTOBUF"] },
    { key: "connectionString", label: "Connection string", type: "password" },
    { key: "publishName", label: "Publish name (topic / queue)" },
  ],
  "pilot-things": [
    { key: "server", label: "Server" },
    { key: "token", label: "Authentication token", type: "password" },
  ],
  ifttt: [
    { key: "key", label: "Webhooks key", type: "password" },
    { key: "eventPrefix", label: "Event prefix" },
    { key: "uplinkValues", label: "Uplink values (decoded object keys, max 2)", type: "list" },
    { key: "arbitraryJson", label: "Arbitrary JSON", type: "bool" },
  ],
  blynk: [{ key: "token", label: "Blynk token", type: "password" }],
};
