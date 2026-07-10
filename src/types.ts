export type Language = "fa" | "en";

export enum TestType {
  TCP = "tcp",
  HTTP = "http"
}

export interface IPScanResult {
  ip: string;
  latency?: number;
  success: boolean;
  error?: string;
  speedMbps?: number;
  speedMbPerSec?: number;
  speedTesting?: boolean;
  speedTested?: boolean;
  pingHistory?: number[];
  packetLoss?: number;
  jitter?: number;
  minLatency?: number;
  maxLatency?: number;
  pingCount?: number;
}

export interface VpnConfig {
  raw: string;
  protocol: string;
  uuid: string;
  address: string;
  port: number;
  params: Record<string, string>;
  remarks: string;
}

export interface CloudflareSubnet {
  cidr: string;
  name: string;
  description: string;
  descriptionFa: string;
}
