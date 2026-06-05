import { getRunStartMs, getSamples } from "./run";
import type { LogRow } from "./types";

const MAX_LOG_ROWS = 300;

let logScroller: HTMLElement | null = null;
let transientLogRows: LogRow[] = [];
let logFrame: number | null = null;

export function initLog(logScrollerEl: HTMLElement): void {
  logScroller = logScrollerEl;
}

export function setTransientRows(rows: LogRow[]): void {
  transientLogRows = rows;
}

export function clearTransientRows(): void {
  transientLogRows = [];
}

function sampleLogMessage(sample: {
  speed: number;
  cadence: number;
  strideLen: number | null;
  totalDist: number | null;
}): string {
  return (
    `spd=${sample.speed.toFixed(3)} cad=${sample.cadence}` +
    (sample.strideLen !== null ? ` sl=${sample.strideLen.toFixed(2)}` : "") +
    (sample.totalDist !== null ? ` dist=${sample.totalDist.toFixed(1)}` : "")
  );
}

function appendLogRow(fragment: DocumentFragment, row: LogRow): void {
  const el = document.createElement("div");
  el.className =
    "grid grid-cols-[64px_200px_1fr] gap-2.5 border-b border-border-grid-faint px-3.5 py-0.5 text-[11px] leading-6 max-sm:grid-cols-[52px_1fr]";

  const t = document.createElement("span");
  t.className = "text-muted";
  t.textContent = row.tSec === null ? "--" : `${row.tSec.toFixed(2)}s`;

  const hex = document.createElement("span");
  hex.className = "self-center text-[10px] text-hex max-sm:hidden";
  hex.textContent = row.hex;

  const msg = document.createElement("span");
  msg.className = row.sys ? "italic text-accent" : "text-text";
  msg.textContent = row.msg;

  el.append(t, hex, msg);
  fragment.appendChild(el);
}

function renderLog(): void {
  if (!logScroller) return;

  logScroller.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const samples = getSamples();

  const packetRows: LogRow[] = samples.slice(-MAX_LOG_ROWS).map((sample) => ({
    sort: sample.receivedAtMs,
    tSec: sample.tSec,
    hex: sample.hex,
    msg: sampleLogMessage(sample),
    sys: false,
  }));
  const rows = [...packetRows, ...transientLogRows]
    .sort((a, b) => b.sort - a.sort)
    .slice(0, MAX_LOG_ROWS);

  if (!rows.length) {
    appendLogRow(fragment, {
      sort: 0,
      tSec: null,
      hex: "",
      msg: "Waiting for connection...",
      sys: true,
    });
  } else {
    rows.forEach((row) => appendLogRow(fragment, row));
  }

  logScroller.appendChild(fragment);
}

export function scheduleLogRender(): void {
  if (logFrame) return;
  logFrame = requestAnimationFrame(() => {
    logFrame = null;
    renderLog();
  });
}

export function addSystemLog(msg: string): void {
  const runStartMs = getRunStartMs();
  transientLogRows.push({
    sort: Date.now(),
    tSec: runStartMs ? (Date.now() - runStartMs) / 1000 : null,
    hex: "",
    msg,
    sys: true,
  });
  transientLogRows = transientLogRows.slice(-30);
  scheduleLogRender();
}
