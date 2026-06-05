import type { Chart } from "chart.js";

export interface Sample {
  seq: number;
  receivedAtMs: number;
  tSec: number;
  speed: number;
  cadence: number;
  strideLen: number | null;
  totalDist: number | null;
  distancePlotM: number | null;
  paceSecPerKm: number | null;
  paceMinPerKm: number | null;
  isRunning: boolean;
  hex: string;
}

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "cancelled"
  | "error";

export interface BleState {
  bleConnected: boolean;
  device: BluetoothDevice | null;
  connectionState: ConnectionState;
  connectedAtMs: number | null;
}

export interface AccumStats {
  sumSpd: number;
  maxSpd: number;
  sumCad: number;
  maxCad: number;
  sumSL: number;
  cntSL: number;
}

export interface RunMeta {
  startedAtMs: number;
  updatedAtMs: number;
  nextSeq: number;
}

export interface Refs {
  banner: HTMLElement;
  statusPill: HTMLButtonElement;
  statusDot: HTMLElement;
  statusText: HTMLElement;
  btnConnect: HTMLButtonElement;
  btnToggleLog: HTMLButtonElement;
  packetLogChevron: HTMLElement;
  scrubRange: HTMLInputElement;
  scrubWindow: HTMLElement;
  scrubTotal: HTMLButtonElement;
  mainContent: HTMLElement;
  bottomDock: HTMLElement;
  logArea: HTMLElement;
  logResizeGrip: HTMLElement;
  logScroller: HTMLElement;
  pktCount: HTMLElement;
  vSpeed: HTMLElement;
  vPace: HTMLElement;
  vCadence: HTMLElement;
  vStride: HTMLElement;
  vDistance: HTMLElement;
  vMode: HTMLElement;
  ssSpd: HTMLElement;
  ssCad: HTMLElement;
  ssSlAvg: HTMLElement;
  ssElapsed: HTMLElement;
  btnExport: HTMLButtonElement;
  btnClearRun: HTMLButtonElement;
}

export type ChartKey = "distance" | "pace" | "speed" | "cadence";

export type Charts = Record<ChartKey, Chart>;

export interface LogRow {
  sort: number;
  tSec: number | null;
  hex: string;
  msg: string;
  sys: boolean;
}

export interface BleSupport {
  ok: boolean;
  title?: string;
  body?: string;
}

export interface UiContext {
  getBleState: () => BleState;
  isPreviewActive: () => boolean;
  isPacketLogVisible: () => boolean;
}
