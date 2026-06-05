import './styles/main.css';

import {
    bindChartPreview,
    clearChartPreview,
    createCharts,
    renderCharts,
    setChartPreview,
} from './charts';
import { bindActionsMenu } from './components/actions-menu';
import { bindConnectionDialog } from './components/connection-dialog';
import { renderApp } from './components/layout';
import { parseRSC } from './rsc';
import {
    applyBleSupportUI,
    doConnect,
    doDisconnect,
    getBleState,
    getBleSupport,
    initBle,
} from './ble';
import { clearTransientRows, initLog, scheduleLogRender } from './log';
import {
    clearRunData,
    flushPending,
    getRunStartMs,
    getSamples,
    hydrateRun,
    makeSample,
    nearestSampleAtTime,
    pushSample,
} from './run';
import type { Charts, Refs, Sample } from './types';
import {
    clampViewStart,
    getMaxViewStart,
    initUI,
    setConnectButton,
    setStatus,
    STATUS_LABELS,
    updateLatestStats,
    updateMainContentInset,
    updateScrubControls,
    updateSessionStats,
} from './ui';

const VIEW_WINDOW_SECONDS = 120;

const redirectFromBindAll =
    location.hostname === '0.0.0.0' && location.protocol.startsWith('http');

let refs = {} as Refs;
let charts: Charts | null = null;

let viewStart = 0;
let followTail = true;
let chartFrame: number | null = null;
let packetLogVisible = false;
let previewSample: Sample | null = null;

function $(id: string): HTMLElement | null {
    return document.getElementById(id);
}

function collectRefs(): void {
    refs = {
        banner: $('unsupported-banner')!,
        statusPill: $('status-pill') as HTMLButtonElement,
        statusDot: $('status-dot')!,
        statusText: $('status-text')!,
        btnConnect: $('btn-connect') as HTMLButtonElement,
        btnToggleLog: $('btn-toggle-log') as HTMLButtonElement,
        packetLogChevron: $('packet-log-chevron')!,
        scrubRange: $('scrub-range') as HTMLInputElement,
        scrubWindow: $('scrub-window')!,
        scrubTotal: $('scrub-total') as HTMLButtonElement,
        mainContent: $('main-content')!,
        bottomDock: $('bottom-dock')!,
        logArea: $('log-area')!,
        logResizeGrip: $('log-resize-grip')!,
        logScroller: $('log-scroller')!,
        pktCount: $('pkt-count')!,
        vSpeed: $('v-speed')!,
        vPace: $('v-pace')!,
        vCadence: $('v-cadence')!,
        vStride: $('v-stride')!,
        vDistance: $('v-distance')!,
        vMode: $('v-mode')!,
        ssSpd: $('ss-spd')!,
        ssCad: $('ss-cad')!,
        ssSlAvg: $('ss-sl-avg')!,
        ssElapsed: $('ss-elapsed')!,
        btnExport: null as unknown as HTMLButtonElement,
        btnClearRun: null as unknown as HTMLButtonElement,
    };
}

function syncScrubControls(): { viewStart: number; followTail: boolean } {
    const result = updateScrubControls(viewStart, followTail, VIEW_WINDOW_SECONDS);
    viewStart = result.viewStart;
    followTail = result.followTail;
    return result;
}

function scheduleChartRender(): void {
    if (chartFrame || !charts) return;
    chartFrame = requestAnimationFrame(() => {
        chartFrame = null;
        renderCharts(charts!, getSamples(), viewStart, viewStart + VIEW_WINDOW_SECONDS);
        if (previewSample) setChartPreview(charts!, previewSample);
    });
}

function showSamplePreview(sample: Sample): void {
    previewSample = sample;
    updateLatestStats(sample, false, true);
    if (charts) setChartPreview(charts, sample);
}

function previewAtTime(tSec: number): void {
    const sample = nearestSampleAtTime(tSec);
    if (!sample) return;
    showSamplePreview(sample);
}

function clearSamplePreview(): void {
    if (!previewSample) return;
    previewSample = null;
    if (charts) clearChartPreview(charts);
    const samples = getSamples();
    updateLatestStats(samples[samples.length - 1] || null);
}

function onPacket(ev: Event): void {
    const now = Date.now();
    const target = ev.target as BluetoothRemoteGATTCharacteristic;
    const dv = target.value!;
    const parsed = parseRSC(dv);
    const sample = makeSample(parsed, dv, now);

    pushSample(sample);

    if (!previewSample) updateLatestStats(sample, true);
    updateSessionStats(true);
    syncScrubControls();
    if (followTail) viewStart = getMaxViewStart(VIEW_WINDOW_SECONDS);
    scheduleChartRender();
    scheduleLogRender();
}

async function exportCsv(): Promise<void> {
    await flushPending();
    const samples = getSamples();
    if (!samples.length) return;

    const header = 'time_s,speed_ms,cadence_spm,stride_length_m,total_distance_m,is_running\n';
    const rows = samples.map(sample => [
        sample.tSec.toFixed(3),
        sample.speed.toFixed(6),
        sample.cadence,
        sample.strideLen !== null ? sample.strideLen.toFixed(4) : '',
        sample.totalDist !== null ? sample.totalDist.toFixed(2) : '',
        sample.isRunning ? 1 : 0,
    ].join(','));

    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `openstride_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

async function clearRun(): Promise<void> {
    const samples = getSamples();
    if (!samples.length && !getRunStartMs()) return;
    const { bleConnected } = getBleState();
    if (!confirm('Clear the current run and all persisted packets?')) return;

    clearSamplePreview();

    const cleared = await clearRunData(bleConnected, () => {
        clearTransientRows();
        viewStart = 0;
        followTail = true;
        updateLatestStats(null);
        updateSessionStats();
        syncScrubControls();
        scheduleChartRender();
        scheduleLogRender();
    });

    if (!cleared) return;
}

function setPacketLogVisible(next: boolean): void {
    packetLogVisible = next;
    refs.logArea.classList.toggle('hidden', !packetLogVisible);
    refs.logArea.classList.toggle('flex', packetLogVisible);
    refs.btnToggleLog.setAttribute('aria-expanded', String(packetLogVisible));
    refs.packetLogChevron.classList.toggle('is-open', packetLogVisible);
    if (packetLogVisible) scheduleLogRender();
    updateMainContentInset();
}

function bindLogResize(): void {
    let startY = 0;
    let startHeight = 0;

    refs.logResizeGrip.addEventListener('pointerdown', event => {
        startY = event.clientY;
        startHeight = refs.logArea.getBoundingClientRect().height;
        refs.logResizeGrip.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    refs.logResizeGrip.addEventListener('pointermove', event => {
        if (!refs.logResizeGrip.hasPointerCapture(event.pointerId)) return;
        const delta = event.clientY - startY;
        const maxHeight = Math.max(120, window.innerHeight * 0.58);
        const nextHeight = Math.min(Math.max(90, startHeight - delta), maxHeight);
        refs.logArea.style.height = `${nextHeight}px`;
        updateMainContentInset();
    });

    refs.logResizeGrip.addEventListener('pointerup', event => {
        if (refs.logResizeGrip.hasPointerCapture(event.pointerId)) {
            refs.logResizeGrip.releasePointerCapture(event.pointerId);
        }
    });

    refs.logResizeGrip.addEventListener('pointercancel', event => {
        if (refs.logResizeGrip.hasPointerCapture(event.pointerId)) {
            refs.logResizeGrip.releasePointerCapture(event.pointerId);
        }
    });
}

function bindDockInset(): void {
    const observer = new ResizeObserver(() => updateMainContentInset());
    observer.observe(refs.bottomDock);
    observer.observe(refs.logArea);
    window.addEventListener('resize', updateMainContentInset);
    updateMainContentInset();
}

function bindEvents(): void {
    refs.btnConnect.addEventListener('click', () => {
        const { bleConnected, device } = getBleState();
        if (bleConnected || device?.gatt?.connected) doDisconnect();
        else void doConnect();
    });
    refs.btnToggleLog.addEventListener('click', () => setPacketLogVisible(!packetLogVisible));
    refs.scrubTotal.addEventListener('click', () => {
        clearSamplePreview();
        followTail = true;
        viewStart = getMaxViewStart(VIEW_WINDOW_SECONDS);
        syncScrubControls();
        scheduleChartRender();
    });
    refs.scrubRange.addEventListener('input', event => {
        clearSamplePreview();
        viewStart = clampViewStart(
            Number((event.target as HTMLInputElement).value),
            VIEW_WINDOW_SECONDS
        );
        followTail = Math.abs(viewStart - getMaxViewStart(VIEW_WINDOW_SECONDS)) < 0.2;
        syncScrubControls();
        scheduleChartRender();
    });
    bindLogResize();
    bindDockInset();
    if (charts) {
        bindChartPreview(charts, {
            onPreview: previewAtTime,
            onClear: clearSamplePreview,
        });
    }
}

async function init(): Promise<void> {
    if (redirectFromBindAll) {
        location.replace(
            `http://127.0.0.1:${location.port}${location.pathname}${location.search}`
        );
        return;
    }

    renderApp($('app')!);
    const menu = bindActionsMenu({
        onExport: () => void exportCsv(),
        onClearRun: () => void clearRun(),
    });
    bindConnectionDialog();
    collectRefs();
    refs.btnExport = menu.btnExport;
    refs.btnClearRun = menu.btnClearRun;

    initUI(refs, {
        getBleState,
        isPreviewActive: () => previewSample !== null,
        isPacketLogVisible: () => packetLogVisible,
    });
    initLog(refs.logScroller);
    initBle(refs, onPacket, () => syncScrubControls());

    charts = createCharts();
    bindEvents();
    setStatus('disconnected', STATUS_LABELS.disconnected);
    setConnectButton(false);
    await hydrateRun();
    updateLatestStats(getSamples()[getSamples().length - 1] || null);
    updateSessionStats();
    syncScrubControls();
    scheduleChartRender();
    scheduleLogRender();
    applyBleSupportUI(getBleSupport());
}

void init();
