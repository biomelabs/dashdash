import { updateConnectionDialog } from "./components/connection-dialog";
import {
  BUTTON_CLASSES,
  STATUS_DOT_CLASSES,
  statusPillClass,
} from "./components/layout";
import {
  formatPaceSeconds,
  formatSeconds,
  PLACEHOLDER,
  numberOrDash,
} from "./format";
import {
  getAccumStats,
  getDurationSeconds,
  getRunStartMs,
  getSamples,
} from "./run";
import type { ConnectionState, Refs, Sample, UiContext } from "./types";

const STATUS_LABELS: Record<ConnectionState, string> = {
  disconnected: "NO DEVICE",
  connecting: "CONNECTING...",
  connected: "CONNECTED",
  cancelled: "CANCELLED",
  error: "ERROR",
};

let refs: Refs;
let ctx: UiContext;
let elapsedTimer: ReturnType<typeof window.setInterval> | null = null;

export function initUI(refsIn: Refs, context: UiContext): void {
  refs = refsIn;
  ctx = context;
}

function formatStatusText(state: ConnectionState, text: string): string {
  if (state === "connected") return text;
  return STATUS_LABELS[state] ?? text.toUpperCase();
}

function formatConnectionUptime(): string {
  const { connectedAtMs, bleConnected } = ctx.getBleState();
  if (!connectedAtMs || !bleConnected) return PLACEHOLDER;
  return formatSeconds((Date.now() - connectedAtMs) / 1000);
}

function refreshConnectionDialog(): void {
  const { connectionState, device, bleConnected } = ctx.getBleState();
  updateConnectionDialog({
    statusLabel:
      STATUS_LABELS[connectionState] ?? connectionState.toUpperCase(),
    deviceName: device?.name ?? (bleConnected ? "Unknown" : PLACEHOLDER),
    deviceId: device?.id ?? PLACEHOLDER,
    uptime: formatConnectionUptime(),
  });
}

export function setStatus(state: ConnectionState, text: string): void {
  refs.statusPill.className = statusPillClass(state);
  refs.statusDot.className = STATUS_DOT_CLASSES[state];
  refs.statusText.textContent = formatStatusText(state, text);
  refs.statusText.classList.toggle("normal-case", state === "connected");
  refreshConnectionDialog();
}

export function setConnectButton(connected: boolean): void {
  refs.btnConnect.textContent = connected ? "Disconnect" : "Connect";
  refs.btnConnect.className = connected
    ? BUTTON_CLASSES.danger
    : BUTTON_CLASSES.primary;
}

function flash(el: HTMLElement): void {
  el.style.color = "var(--c-success)";
  window.setTimeout(() => {
    if (ctx.isPreviewActive()) return;
    el.style.color = "";
  }, 250);
}

export function updateMainContentInset(): void {
  const logH = ctx.isPacketLogVisible()
    ? refs.logArea.getBoundingClientRect().height
    : 0;
  refs.mainContent.style.paddingBottom = logH > 0 ? `${logH}px` : "";
}

export function updateScrubControls(
  viewStart: number,
  followTail: boolean,
  viewWindowSeconds: number,
): { viewStart: number; followTail: boolean } {
  const { bleConnected } = ctx.getBleState();
  const duration = getDurationSeconds(bleConnected);
  const maxStart = Math.max(0, duration - viewWindowSeconds);

  let nextViewStart = viewStart;
  let nextFollowTail = followTail;
  if (nextFollowTail) nextViewStart = maxStart;
  nextViewStart = Math.min(Math.max(0, nextViewStart), maxStart);

  refs.scrubRange.max = maxStart.toFixed(1);
  refs.scrubRange.value = nextViewStart.toFixed(1);
  refs.scrubRange.disabled = maxStart <= 0;

  const visibleEnd = Math.min(duration, nextViewStart + viewWindowSeconds);
  refs.scrubWindow.textContent = `${formatSeconds(nextViewStart)} - ${formatSeconds(visibleEnd)}`;
  refs.scrubTotal.textContent = `TOTAL ${formatSeconds(duration)}`;

  const behindLive = !nextFollowTail && maxStart > 0;
  refs.scrubTotal.classList.toggle("scrub-total-behind", behindLive);
  refs.scrubTotal.title = behindLive ? "Click to return to live view" : "";

  return { viewStart: nextViewStart, followTail: nextFollowTail };
}

export function getMaxViewStart(viewWindowSeconds: number): number {
  const { bleConnected } = ctx.getBleState();
  return Math.max(0, getDurationSeconds(bleConnected) - viewWindowSeconds);
}

export function clampViewStart(
  value: number,
  viewWindowSeconds: number,
): number {
  return Math.min(Math.max(0, value), getMaxViewStart(viewWindowSeconds));
}

export function updateElapsed(): void {
  const { bleConnected } = ctx.getBleState();
  const runStartMs = getRunStartMs();
  const elapsed =
    runStartMs && bleConnected
      ? (Date.now() - runStartMs) / 1000
      : getDurationSeconds(bleConnected);
  refs.ssElapsed.textContent = formatSeconds(elapsed);
}

export function startElapsedTimer(onTick: () => void): void {
  if (elapsedTimer) window.clearInterval(elapsedTimer);
  elapsedTimer = window.setInterval(() => {
    updateElapsed();
    onTick();
    const { bleConnected } = ctx.getBleState();
    if (bleConnected) refreshConnectionDialog();
  }, 1000);
  updateElapsed();
}

export function stopElapsedTimer(): void {
  if (elapsedTimer) window.clearInterval(elapsedTimer);
  elapsedTimer = null;
  updateElapsed();
}

export function updateSessionStats(shouldFlash = false): void {
  const samples = getSamples();
  const { sumSpd, maxSpd, sumCad, maxCad, sumPace, cntPace, minPace, maxDist } = getAccumStats();
  const pkts = samples.length;
  const runStartMs = getRunStartMs();

  refs.pktCount.textContent = String(pkts);
  refs.btnExport.disabled = pkts === 0;
  refs.btnClearRun.disabled = pkts === 0 && !runStartMs;
  updateElapsed();

  const csSpeed = document.getElementById("cs-speed");
  if (csSpeed) {
    csSpeed.textContent = pkts
      ? `AVG ${(sumSpd / pkts).toFixed(2)}  MAX ${maxSpd.toFixed(2)} M/S`
      : "AVG --  MAX -- M/S";
  }

  const csCad = document.getElementById("cs-cadence");
  if (csCad) {
    csCad.textContent = pkts
      ? `AVG ${Math.round(sumCad / pkts)}  MAX ${maxCad} SPM`
      : "AVG --  MAX -- SPM";
  }

  const csPace = document.getElementById("cs-pace");
  if (csPace) {
    const avgPaceStr = cntPace ? formatPaceSeconds((sumPace / cntPace) * 60) : PLACEHOLDER;
    const bestPaceStr = minPace !== null ? formatPaceSeconds(minPace * 60) : PLACEHOLDER;
    csPace.textContent = `AVG ${avgPaceStr}  BEST ${bestPaceStr} /KM`;
  }

  const csDist = document.getElementById("cs-distance");
  if (csDist) {
    csDist.textContent = `TOTAL ${maxDist > 0 ? maxDist.toFixed(0) : PLACEHOLDER} M`;
  }

  if (shouldFlash) {
    [refs.ssElapsed, refs.pktCount].forEach(flash);
  }
}

function setStatPreviewStyle(isPreview: boolean): void {
  const statEls = [
    refs.vSpeed,
    refs.vPace,
    refs.vCadence,
    refs.vStride,
    refs.vDistance,
    refs.vMode,
  ];

  statEls.forEach((el) => el.classList.toggle("stat-preview", isPreview));
  if (!isPreview) {
    statEls.forEach((el) => {
      el.style.color = "";
    });
  }
}

export function updateLatestStats(
  sample: Sample | null,
  shouldFlash = false,
  isPreview = false,
): void {
  if (!sample) {
    refs.vSpeed.textContent = PLACEHOLDER;
    refs.vPace.textContent = PLACEHOLDER;
    refs.vCadence.textContent = PLACEHOLDER;
    refs.vStride.textContent = PLACEHOLDER;
    refs.vDistance.textContent = PLACEHOLDER;
    refs.vMode.textContent = "";
    setStatPreviewStyle(false);
    return;
  }

  refs.vSpeed.textContent = numberOrDash(sample.speed, 2);
  refs.vPace.textContent =
    sample.paceSecPerKm === null
      ? PLACEHOLDER
      : formatPaceSeconds(sample.paceSecPerKm);
  refs.vCadence.textContent = String(sample.cadence);
  refs.vStride.textContent =
    sample.strideLen !== null ? sample.strideLen.toFixed(2) : PLACEHOLDER;
  refs.vDistance.textContent =
    sample.distancePlotM !== null
      ? sample.distancePlotM.toFixed(1)
      : PLACEHOLDER;
  refs.vMode.textContent = sample.isRunning ? "RUN" : "WALK";
  refs.vMode.className = sample.isRunning
    ? "ml-1 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-success"
    : "ml-1 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-cyan";
  setStatPreviewStyle(isPreview);

  if (shouldFlash) {
    [
      refs.vSpeed,
      refs.vPace,
      refs.vCadence,
      refs.vStride,
      refs.vDistance,
    ].forEach(flash);
  }
}

export { STATUS_LABELS };
