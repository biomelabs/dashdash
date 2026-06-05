import { formatSeconds } from './format';
import type { ChartKey, Charts, Sample } from './types';
import { Chart } from 'chart.js/auto';

const MAX_RENDER_POINTS = 700;

function color(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const chartDefs: Record<ChartKey, {
    id: string;
    color: string;
    fill: string;
    y: (sample: Sample) => number | null;
}> = {
    distance: {
        id: 'c-distance',
        color: color('--c-success'),
        fill: 'var(--c-success-fill)',
        y: sample => sample.distancePlotM,
    },
    pace: {
        id: 'c-pace',
        color: color('--c-purple'),
        fill: 'var(--c-purple-fill)',
        y: sample => sample.paceMinPerKm,
    },
    speed: {
        id: 'c-speed',
        color: color('--c-accent'),
        fill: 'var(--c-accent-fill)',
        y: sample => sample.speed,
    },
    cadence: {
        id: 'c-cadence',
        color: color('--c-cyan'),
        fill: 'var(--c-cyan-fill)',
        y: sample => sample.cadence,
    },
};

function baseOptions(): Chart['options'] {
    return {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        normalized: true,
        parsing: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: color('--c-surface'),
                borderColor: color('--c-border-grid'),
                borderWidth: 1,
                titleColor: color('--c-label'),
                bodyColor: color('--c-text-bright'),
                padding: 8,
                titleFont: { family: "'IBM Plex Mono', monospace", size: 10 },
                bodyFont: { family: "'IBM Plex Mono', monospace", size: 12, weight: 600 },
            },
        },
        scales: {
            x: {
                type: 'linear',
                min: 0,
                max: 120,
                grid: { color: color('--c-border-grid') },
                border: { color: color('--c-border-grid') },
                ticks: {
                    color: color('--c-label'),
                    font: { family: "'IBM Plex Mono', monospace", size: 9 },
                    callback: (value: string | number) => formatSeconds(Number(value)),
                    maxTicksLimit: 7,
                },
            },
            y: {
                grid: { color: color('--c-border-grid') },
                border: { color: color('--c-border-grid') },
                ticks: {
                    color: color('--c-label'),
                    font: { family: "'IBM Plex Mono', monospace", size: 9 },
                },
                beginAtZero: true,
            },
        },
    };
}

function makeChart(def: (typeof chartDefs)[ChartKey]): Chart {
    const ctx = (document.getElementById(def.id) as HTMLCanvasElement).getContext('2d')!;
    return new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                data: [],
                borderColor: def.color,
                backgroundColor: def.fill,
                borderWidth: 1.5,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHitRadius: 12,
                pointBackgroundColor: color('--c-accent'),
                pointBorderColor: color('--c-surface'),
                pointBorderWidth: 1,
                fill: true,
                spanGaps: false,
                tension: 0.25,
            }],
        },
        options: baseOptions(),
    });
}

export function createCharts(): Charts {
    return Object.fromEntries(
        Object.entries(chartDefs).map(([key, def]) => [key, makeChart(def)])
    ) as Charts;
}

function nearestDataIndex(
    data: { x: number; y: number | null }[],
    tSec: number
): number {
    if (!data.length) return -1;

    let bestIdx = -1;
    let bestDelta = Infinity;
    for (let i = 0; i < data.length; i += 1) {
        const point = data[i];
        if (!Number.isFinite(point.y)) continue;

        const delta = Math.abs(point.x - tSec);
        if (delta < bestDelta) {
            bestDelta = delta;
            bestIdx = i;
        }
    }

    return bestIdx;
}

export function setChartPreview(charts: Charts, sample: Sample | null): void {
    if (!sample) {
        clearChartPreview(charts);
        return;
    }

    for (const chart of Object.values(charts)) {
        const data = chart.data.datasets[0].data as { x: number; y: number | null }[];
        const index = nearestDataIndex(data, sample.tSec);

        if (index === -1) {
            chart.setActiveElements([]);
            chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
            chart.update('none');
            continue;
        }

        const point = data[index];
        const active = [{ datasetIndex: 0, index }];
        chart.setActiveElements(active);
        chart.tooltip?.setActiveElements(active, {
            x: chart.scales.x!.getPixelForValue(point.x),
            y: chart.scales.y!.getPixelForValue(point.y!),
        });
        chart.update('none');
    }
}

export function clearChartPreview(charts: Charts): void {
    for (const chart of Object.values(charts)) {
        chart.setActiveElements([]);
        chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
        chart.update('none');
    }
}

function chartTimeFromPointer(chart: Chart, event: PointerEvent): number {
    const rect = chart.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    return chart.scales.x!.getValueForPixel(x) as number;
}

export function bindChartPreview(
    charts: Charts,
    { onPreview, onClear }: { onPreview: (tSec: number) => void; onClear: () => void }
): void {
    for (const chart of Object.values(charts)) {
        const canvas = chart.canvas;

        canvas.addEventListener('pointerdown', event => {
            canvas.setPointerCapture(event.pointerId);
            onPreview(chartTimeFromPointer(chart, event));
        });

        canvas.addEventListener('pointermove', event => {
            if (event.pointerType === 'touch' && !canvas.hasPointerCapture(event.pointerId)) return;
            onPreview(chartTimeFromPointer(chart, event));
        });

        canvas.addEventListener('pointerup', event => {
            if (canvas.hasPointerCapture(event.pointerId)) {
                canvas.releasePointerCapture(event.pointerId);
            }
            if (event.pointerType !== 'mouse') onClear();
        });

        canvas.addEventListener('pointercancel', event => {
            if (canvas.hasPointerCapture(event.pointerId)) {
                canvas.releasePointerCapture(event.pointerId);
            }
            onClear();
        });

        canvas.addEventListener('pointerleave', event => {
            if (!canvas.hasPointerCapture(event.pointerId)) onClear();
        });
    }
}

function lowerBound(samples: Sample[], value: number): number {
    let lo = 0;
    let hi = samples.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (samples[mid].tSec < value) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

function upperBound(samples: Sample[], value: number): number {
    let lo = 0;
    let hi = samples.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (samples[mid].tSec <= value) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

function decimate(samples: Sample[]): Sample[] {
    if (samples.length <= MAX_RENDER_POINTS) return samples;

    const stride = Math.ceil(samples.length / MAX_RENDER_POINTS);
    const out: Sample[] = [];
    for (let i = 0; i < samples.length; i += stride) {
        out.push(samples[i]);
    }

    const last = samples[samples.length - 1];
    if (out[out.length - 1] !== last) out.push(last);
    return out;
}

export function renderCharts(
    charts: Charts,
    samples: Sample[],
    viewStart: number,
    viewEnd: number
): void {
    const startIdx = lowerBound(samples, viewStart);
    const endIdx = upperBound(samples, viewEnd);
    const visible = decimate(samples.slice(startIdx, endIdx));

    for (const [key, chart] of Object.entries(charts) as [ChartKey, Chart][]) {
        const def = chartDefs[key];
        chart.options!.scales!.x!.min = viewStart;
        chart.options!.scales!.x!.max = viewEnd;
        chart.data.datasets[0].data = visible.map(sample => {
            const y = def.y(sample);
            return { x: sample.tSec, y: Number.isFinite(y) ? y : null };
        });
        chart.update('none');
    }
}
