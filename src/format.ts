export function paceSecondsPerKm(mps: number): number | null {
    if (mps < 0.15) return null;
    return 1000 / mps;
}

export const PLACEHOLDER = '--';

export function formatPace(mps: number): string {
    const seconds = paceSecondsPerKm(mps);
    if (seconds === null) return PLACEHOLDER;
    return formatPaceSeconds(seconds);
}

export function formatPaceSeconds(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60);
    return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

export function formatElapsed(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatSeconds(seconds: number): string {
    return formatElapsed(seconds * 1000);
}

export function numberOrDash(value: number, digits = 2): string {
    return Number.isFinite(value) ? value.toFixed(digits) : PLACEHOLDER;
}
