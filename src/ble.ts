/// <reference types="web-bluetooth" />

import { addSystemLog } from "./log";
import { onBleConnected } from "./run";
import {
  setConnectButton,
  setStatus,
  startElapsedTimer,
  stopElapsedTimer,
  STATUS_LABELS,
} from "./ui";
import { SVC_RSC, CHR_MEAS, SVC_BAS, CHR_BAT_LEVEL } from "./rsc";
import { updateConnectionBattery } from "./components/connection-dialog";
import type { BleState, BleSupport, ConnectionState, Refs } from "./types";

const SECURE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

let refs: Refs;
let onPacketHandler: ((ev: Event) => void) | null = null;
let onScrubTick: (() => void) | null = null;

let device: BluetoothDevice | null = null;
let measurementChar: BluetoothRemoteGATTCharacteristic | null = null;
let batteryChar: BluetoothRemoteGATTCharacteristic | null = null;
let bleConnected = false;
let connectionState: ConnectionState = "disconnected";
let connectedAtMs: number | null = null;

export function initBle(
  refsIn: Refs,
  onPacket: (ev: Event) => void,
  onTick?: () => void,
): void {
  refs = refsIn;
  onPacketHandler = onPacket;
  onScrubTick = onTick ?? null;
}

export function getBleState(): BleState {
  return { bleConnected, device, connectionState, connectedAtMs };
}

function isLocalSecureHost(): boolean {
  return SECURE_HOSTS.has(location.hostname);
}

export function getBleSupport(): BleSupport {
  if ("bluetooth" in navigator) return { ok: true };

  if (location.protocol === "file:") {
    return {
      ok: false,
      title: "Opened as a local file",
      body: "Web Bluetooth does not work on <code>file://</code>. Serve this folder over HTTP, then open <code>http://127.0.0.1:8080/</code>.",
    };
  }

  if (location.hostname === "0.0.0.0") {
    const url = `http://127.0.0.1:${location.port || "8080"}${location.pathname}`;
    return {
      ok: false,
      title: "Wrong host in the address bar",
      body: `<code>0.0.0.0</code> is not a secure context for Web Bluetooth. Open <a href="${url}">${url}</a> instead.`,
    };
  }

  if (!window.isSecureContext) {
    const local = `http://127.0.0.1:${location.port || "8080"}${location.pathname}`;
    return {
      ok: false,
      title: "Not a secure context",
      body: `This page is at <code>${location.origin}</code>. For local dev use <code>http://127.0.0.1</code>, <code>http://localhost</code>, or <code>https://</code>. Try <a href="${local}">${local}</a>.`,
    };
  }

  const ua = window.navigator.userAgent;
  const isFirefox = /Firefox\//i.test(ua);
  const isChrome = /Chrome\//i.test(ua) && !/Edg\//i.test(ua);
  const onLinux = /Linux/i.test(ua);

  if (isChrome && onLinux && isLocalSecureHost()) {
    return {
      ok: false,
      title: "Enable Web Bluetooth on Linux Chrome",
      body: "You are on a secure local URL, but Chrome hides Web Bluetooth on Linux until you enable <code>chrome://flags/#enable-experimental-web-platform-features</code> and restart.",
    };
  }

  return {
    ok: false,
    title: isFirefox
      ? "Firefox does not support Web Bluetooth"
      : "Web Bluetooth not available in this browser",
    body:
      "<strong>Desktop:</strong> Chrome or Edge.<br><strong>Android:</strong> Chrome.<br><strong>iOS:</strong> Bluefy app (App Store)." +
      (isLocalSecureHost()
        ? "<br>Embedded IDE browsers often omit Web Bluetooth. Open this URL in system Chrome/Edge."
        : ""),
  };
}

function showUnsupportedBanner(support: BleSupport): void {
  refs.banner.innerHTML = `!! <strong>${support.title}</strong><br>${support.body ?? ""}`;
  refs.banner.classList.remove("hidden");
}

export function applyBleSupportUI(support: BleSupport): void {
  if (support.ok) return;
  showUnsupportedBanner(support);
  refs.btnConnect.disabled = true;
}

function onBatteryLevelChanged(ev: Event): void {
  const char = ev.target as BluetoothRemoteGATTCharacteristic;
  const level = char.value!.getUint8(0);
  updateConnectionBattery(level);
}

function onDrop(): void {
  const wasConnected = bleConnected;
  bleConnected = false;
  connectedAtMs = null;
  connectionState = "disconnected";
  batteryChar = null;
  updateConnectionBattery(null);
  setStatus("disconnected", STATUS_LABELS.disconnected);
  setConnectButton(false);
  refs.btnConnect.disabled = false;
  stopElapsedTimer();

  if (wasConnected) addSystemLog("Disconnected");
}

export async function doConnect(): Promise<void> {
  const support = getBleSupport();
  if (!support.ok) {
    showUnsupportedBanner(support);
    return;
  }

  connectionState = "connecting";
  setStatus("connecting", STATUS_LABELS.connecting);
  refs.btnConnect.disabled = true;

  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SVC_RSC] }],
      optionalServices: [SVC_BAS],
    });

    device.addEventListener("gattserverdisconnected", onDrop);
    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(SVC_RSC);
    measurementChar = await service.getCharacteristic(CHR_MEAS);
    measurementChar.addEventListener(
      "characteristicvaluechanged",
      onPacketHandler!,
    );
    await measurementChar.startNotifications();

    /* Battery Service is optional, ignore if device doesn't expose it */
    try {
      const batService = await server.getPrimaryService(SVC_BAS);
      batteryChar = await batService.getCharacteristic(CHR_BAT_LEVEL);
      batteryChar.addEventListener("characteristicvaluechanged", onBatteryLevelChanged);
      await batteryChar.startNotifications();
      const initVal = await batteryChar.readValue();
      updateConnectionBattery(initVal.getUint8(0));
    } catch {
      updateConnectionBattery(null);
    }

    await onBleConnected();

    bleConnected = true;
    connectedAtMs = Date.now();
    connectionState = "connected";
    setStatus("connected", device.name || "Unknown Device");
    setConnectButton(true);
    refs.btnConnect.disabled = false;
    refs.btnClearRun.disabled = false;
    startElapsedTimer(() => {
      onScrubTick?.();
    });
    addSystemLog(`Connected to "${device.name || "Unknown"}"`);
  } catch (error) {
    console.error(error);
    connectedAtMs = null;
    const err = error as Error;
    if (err.name === "NotFoundError") {
      connectionState = "cancelled";
      setStatus("cancelled", STATUS_LABELS.cancelled);
    } else {
      connectionState = "error";
      setStatus("error", STATUS_LABELS.error);
    }
    setConnectButton(false);
    refs.btnConnect.disabled = false;
  }
}

export function doDisconnect(): void {
  if (device?.gatt?.connected) {
    device.gatt.disconnect();
  } else {
    onDrop();
  }
}
