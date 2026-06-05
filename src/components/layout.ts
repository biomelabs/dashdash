import { renderActionsMenu } from "./actions-menu";
import { renderConnectionDialog } from "./connection-dialog";
import type { ConnectionState } from "../types";

const LABEL = "text-label";

const BTN =
  "rounded border border-border bg-surface-raised px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-text transition hover:border-accent hover:bg-accent-bg hover:text-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border disabled:hover:bg-surface-raised disabled:hover:text-text";

export const BUTTON_CLASSES = {
  base: BTN,
  primary:
    "rounded border border-accent bg-accent-bg px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-accent transition hover:bg-accent-bg-hover disabled:cursor-not-allowed disabled:opacity-30",
  danger:
    "rounded border border-danger bg-surface-raised px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-danger transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-30",
  compact:
    "rounded border border-border bg-surface-raised px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-text transition hover:border-accent hover:bg-accent-bg hover:text-accent disabled:cursor-not-allowed disabled:opacity-30",
};

const STATUS_TEXT = "transition-colors";
const DOT_BASE = "status-dot h-1.5 w-1.5 shrink-0 rounded-full";

export const STATUS_CLASSES: Record<ConnectionState, string> = {
  disconnected: `${STATUS_TEXT} text-muted`,
  connecting: `${STATUS_TEXT} text-accent`,
  connected: `${STATUS_TEXT} text-success`,
  cancelled: `${STATUS_TEXT} text-accent`,
  error: `${STATUS_TEXT} text-danger`,
};

export const STATUS_DOT_CLASSES: Record<ConnectionState, string> = {
  disconnected: `${DOT_BASE} status-dot-disconnected bg-muted`,
  connecting: `${DOT_BASE} status-dot-connecting bg-accent`,
  connected: `${DOT_BASE} status-dot-connected bg-success`,
  cancelled: `${DOT_BASE} status-dot-cancelled bg-accent`,
  error: `${DOT_BASE} status-dot-error bg-danger`,
};

export const STATUS_PILL_BASE =
  "status-pill-btn flex h-[30px] max-w-full items-center gap-2 rounded border border-border bg-surface-raised px-3 text-[10px] font-semibold uppercase tracking-[0.04em] transition hover:border-accent hover:bg-accent-bg hover:text-accent";

export function statusPillClass(state: ConnectionState): string {
  return `${STATUS_PILL_BASE} ${STATUS_CLASSES[state]}`;
}

const stats: [string, string, string][] = [
  ["Speed", "v-speed", "m/s"],
  ["Pace", "v-pace", "min/km"],
  ["Cadence", "v-cadence", "steps/min"],
  ["Stride Length", "v-stride", "m"],
  [
    "Distance",
    "v-distance",
    'm <span id="v-mode" class="ml-1 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em]"></span>',
  ],
];

const charts: [string, string, string][] = [
  ["Distance", "m", "c-distance"],
  ["Pace", "min/km", "c-pace"],
  ["Speed", "m/s", "c-speed"],
  ["Cadence", "steps/min", "c-cadence"],
];

function statCard([label, id, unit]: [string, string, string]): string {
  return `
        <section class="flex min-w-0 flex-col gap-0.5 bg-surface px-3 py-3">
            <span class="text-[9px] font-semibold uppercase tracking-[0.12em] ${LABEL}">${label}</span>
            <span id="${id}" class="font-mono text-[clamp(1.25rem,4vw,1.875rem)] font-semibold leading-none tracking-[-0.02em] text-text-bright transition-colors">--</span>
            <span class="text-[10px] ${LABEL}">${unit}</span>
        </section>
    `;
}

function chartPanel([label, unit, id]: [string, string, string]): string {
  return `
        <section class="chart-panel flex min-h-[120px] min-w-0 flex-col bg-surface px-3.5 pb-2.5 pt-3">
            <div class="mb-2 flex shrink-0 items-center justify-between">
                <span class="text-[9px] font-semibold uppercase tracking-[0.12em] ${LABEL}">${label} · ${unit}</span>
            </div>
            <div class="relative min-h-[72px] flex-1">
                <canvas id="${id}"></canvas>
            </div>
        </section>
    `;
}

export function renderApp(root: HTMLElement): void {
  root.innerHTML = `
        <header class="flex h-[50px] shrink-0 items-center justify-between gap-3 border-b border-border-grid bg-surface px-[18px]">
            <div class="flex min-w-0 items-center">
                ${renderConnectionDialog()}
            </div>
            <div class="flex shrink-0 items-center gap-2">
                <button id="btn-connect" class="${BUTTON_CLASSES.primary}">Connect</button>
                ${renderActionsMenu()}
            </div>
        </header>

        <div id="unsupported-banner" class="mx-4 my-4 hidden shrink-0 rounded border border-danger-border bg-danger-bg-subtle px-3.5 py-2.5 text-[12px] leading-7 text-danger-light"></div>

        <main class="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
            <div id="main-content" class="flex min-h-0 flex-col overflow-y-auto">
                <section class="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-px border-b border-border-grid bg-border-grid">
                    ${stats.map(statCard).join("")}
                </section>

                <section id="charts-area" class="charts-area grid min-h-[480px] flex-1 grid-cols-1 gap-px border-b border-border-grid bg-border-grid lg:min-h-[240px] lg:grid-cols-2">
                    ${charts.map(chartPanel).join("")}
                </section>
            </div>

            <div id="bottom-dock" class="relative z-10">
                <section id="log-area" class="absolute bottom-full left-0 right-0 z-20 hidden h-[150px] flex-col border-y border-border-grid bg-surface shadow-[0_-18px_40px_rgba(0,0,0,0.35)]">
                    <div id="log-resize-grip" class="log-resize-grip flex h-3 shrink-0 cursor-row-resize items-center justify-center border-b border-border-grid bg-bg"></div>
                    <div class="flex shrink-0 items-center justify-between border-b border-border-grid px-3.5 py-1.5">
                        <span class="text-[9px] font-semibold uppercase tracking-[0.12em] ${LABEL}">Packet Log</span>
                        <span id="pkt-count" class="text-[9px] font-semibold ${LABEL}">0 pkts</span>
                    </div>
                    <div id="log-scroller" class="min-h-0 flex-1 overflow-y-auto py-1"></div>
                </section>

                <section class="shrink-0 border-t border-border-grid bg-bg px-4 py-2.5">
                    <div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                        <span id="scrub-window" class="whitespace-nowrap">0:00 - 0:00</span>
                        <input id="scrub-range" class="scrub-range w-full" type="range" min="0" max="0" value="0" step="0.1" disabled>
                        <button id="scrub-total" class="whitespace-nowrap border-0 bg-transparent p-0 text-right text-[inherit] transition hover:text-accent" type="button">TOTAL 0:00</button>
                    </div>
                </section>

                <section class="flex shrink-0 items-center gap-3 overflow-hidden border-t border-border-grid bg-bg pl-4 pr-2 py-1 text-[10px]">
                    <div class="flex min-w-0 flex-1 items-center gap-5 overflow-hidden">
                        <span class="whitespace-nowrap"><span class="${LABEL} tracking-[0.06em]">SPD avg/max</span> <strong id="ss-spd" class="text-text">--/--</strong></span>
                        <span class="whitespace-nowrap"><span class="${LABEL} tracking-[0.06em]">CAD avg/max</span> <strong id="ss-cad" class="text-text">--/--</strong></span>
                        <span class="whitespace-nowrap"><span class="${LABEL} tracking-[0.06em]">SL avg</span> <strong id="ss-sl-avg" class="text-text">--</strong></span>
                        <span class="whitespace-nowrap"><span class="${LABEL} tracking-[0.06em]">ET</span> <strong id="ss-elapsed" class="text-text">0:00</strong></span>
                    </div>
                    <button id="btn-toggle-log" class="flex shrink-0 items-center gap-2.5 rounded-full my-px py-px px-2 text-[10px] font-semibold uppercase tracking-[0.06em] ${LABEL} transition hover:text-text" aria-controls="log-area" aria-expanded="false">
                        <span id="packet-log-chevron" class="packet-log-chevron"></span>
                        <span>PKT LOG</span>
                    </button>
                </section>
            </div>
        </main>
    `;
}
