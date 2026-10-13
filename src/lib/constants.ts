export const REGIONS = [
  "EU868", "US915", "CN779", "EU433", "AU915", "CN470", "AS923", "AS923_2", "AS923_3", "AS923_4", "KR920", "IN865", "RU864", "ISM2400",
] as const;

export const MAC_VERSIONS = [
  "LORAWAN_1_0_0", "LORAWAN_1_0_1", "LORAWAN_1_0_2", "LORAWAN_1_0_3", "LORAWAN_1_0_4", "LORAWAN_1_1_0",
] as const;

export const REG_PARAMS = ["A", "B", "RP002_1_0_0", "RP002_1_0_1", "RP002_1_0_2", "RP002_1_0_3", "RP002_1_0_4", "RP002_1_0_5"] as const;

export const CODEC_RUNTIMES = ["NONE", "CAYENNE_LPP", "JS"] as const;

export const MEASUREMENT_KINDS = ["UNKNOWN", "COUNTER", "ABSOLUTE", "GAUGE", "STRING"] as const;
