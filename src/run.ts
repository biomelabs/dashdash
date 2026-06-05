import { paceSecondsPerKm } from "./format";
import { hexStr, type ParsedRSC } from "./rsc";
import { clearPersistedRun, loadRun, saveSamples } from "./storage";
import type { AccumStats, RunMeta, Sample } from "./types";

let runStartMs: number | null = null;
let nextSeq = 1;
let samples: Sample[] = [];
let lastDistancePlot: number | null = null;

let sumSpd = 0;
let maxSpd = 0;
let sumCad = 0;
let maxCad = 0;
let sumSL = 0;
let cntSL = 0;

let pendingSamples: Sample[] = [];
let persistTimer: ReturnType<typeof window.setTimeout> | null = null;
let persistBusy = false;

export function getSamples(): Sample[] {
  return samples;
}

export function getRunStartMs(): number | null {
  return runStartMs;
}

export function getAccumStats(): AccumStats {
  return { sumSpd, maxSpd, sumCad, maxCad, sumSL, cntSL };
}

export function currentMeta(): RunMeta | null {
  if (!runStartMs) return null;
  return {
    startedAtMs: runStartMs,
    updatedAtMs: Date.now(),
    nextSeq,
  };
}

export function schedulePersist(delay = 120): void {
  if (persistTimer) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    void flushPending();
  }, delay);
}

export async function flushPending(): Promise<void> {
  if (persistBusy) {
    schedulePersist(80);
    return;
  }

  if (persistTimer) {
    window.clearTimeout(persistTimer);
    persistTimer = null;
  }

  const meta = currentMeta();
  const batch = pendingSamples.splice(0);
  if (!batch.length && !meta) return;

  persistBusy = true;
  await saveSamples(batch, meta);
  persistBusy = false;

  if (pendingSamples.length) schedulePersist(0);
}

export function queueSamplePersist(sample: Sample): void {
  pendingSamples.push(sample);
  if (pendingSamples.length >= 40) void flushPending();
  else schedulePersist();
}

export function getDurationSeconds(bleConnected: boolean): number {
  if (samples.length) return samples[samples.length - 1].tSec;
  if (runStartMs && bleConnected) return (Date.now() - runStartMs) / 1000;
  return 0;
}

export function nearestSampleAtTime(tSec: number): Sample | null {
  if (!samples.length) return null;

  let lo = 0;
  let hi = samples.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].tSec < tSec) lo = mid + 1;
    else hi = mid;
  }

  if (lo <= 0) return samples[0];
  if (lo >= samples.length) return samples[samples.length - 1];

  const prev = samples[lo - 1];
  const next = samples[lo];
  return Math.abs(prev.tSec - tSec) <= Math.abs(next.tSec - tSec) ? prev : next;
}

export function resetAccum(): void {
  sumSpd = 0;
  maxSpd = 0;
  sumCad = 0;
  maxCad = 0;
  sumSL = 0;
  cntSL = 0;
}

export function accumulateSample(sample: Sample): void {
  sumSpd += sample.speed;
  maxSpd = Math.max(maxSpd, sample.speed);
  sumCad += sample.cadence;
  maxCad = Math.max(maxCad, sample.cadence);
  if (sample.strideLen !== null) {
    sumSL += sample.strideLen;
    cntSL += 1;
  }
}

export function rebuildAccum(): void {
  resetAccum();
  for (const sample of samples) accumulateSample(sample);
}

export function normalizeSample(sample: Sample): Sample {
  const paceSec = sample.paceSecPerKm ?? paceSecondsPerKm(sample.speed);
  const distancePlotM = sample.distancePlotM ?? sample.totalDist ?? null;
  return {
    ...sample,
    strideLen: sample.strideLen ?? null,
    totalDist: sample.totalDist ?? null,
    distancePlotM,
    paceSecPerKm: paceSec,
    paceMinPerKm: paceSec === null ? null : paceSec / 60,
    isRunning: Boolean(sample.isRunning),
  };
}

export async function hydrateRun(): Promise<void> {
  const persisted = await loadRun();
  samples = persisted.samples.map(normalizeSample);
  runStartMs = persisted.meta?.startedAtMs ?? null;
  nextSeq = Math.max(
    persisted.meta?.nextSeq ?? 1,
    samples.length ? Math.max(...samples.map((sample) => sample.seq)) + 1 : 1,
  );

  const lastDistanceSample = [...samples]
    .reverse()
    .find((sample) => Number.isFinite(sample.distancePlotM));
  lastDistancePlot = lastDistanceSample?.distancePlotM ?? null;

  rebuildAccum();
}

export function makeSample(
  parsed: ParsedRSC,
  dv: DataView,
  now: number,
): Sample {
  if (!runStartMs) runStartMs = now;

  const tSec = (now - runStartMs) / 1000;
  const paceSec = paceSecondsPerKm(parsed.speed);
  const distancePlotM =
    parsed.totalDist !== null ? parsed.totalDist : lastDistancePlot;
  if (parsed.totalDist !== null) lastDistancePlot = parsed.totalDist;

  return {
    seq: nextSeq++,
    receivedAtMs: now,
    tSec,
    speed: parsed.speed,
    cadence: parsed.cadence,
    strideLen: parsed.strideLen,
    totalDist: parsed.totalDist,
    distancePlotM,
    paceSecPerKm: paceSec,
    paceMinPerKm: paceSec === null ? null : paceSec / 60,
    isRunning: parsed.isRunning,
    hex: hexStr(dv),
  };
}

export function pushSample(sample: Sample): void {
  samples.push(sample);
  accumulateSample(sample);
  queueSamplePersist(sample);
}

export async function onBleConnected(): Promise<void> {
  if (!runStartMs) {
    runStartMs = Date.now();
    await saveSamples([], currentMeta());
  }
}

export async function clearRunData(
  bleConnected: boolean,
  onReset: () => void,
): Promise<boolean> {
  if (!samples.length && !runStartMs) return false;

  pendingSamples = [];
  await clearPersistedRun();

  samples = [];
  nextSeq = 1;
  lastDistancePlot = null;
  resetAccum();

  runStartMs = bleConnected ? Date.now() : null;
  if (runStartMs) await saveSamples([], currentMeta());

  onReset();
  return true;
}
