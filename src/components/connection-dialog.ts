import { PLACEHOLDER } from "../format";

const LABEL = "text-label";
const VALUE = "text-text";

const ROW = "grid grid-cols-[88px_minmax(0,1fr)] gap-2 px-3 py-1.5";

const BATTERY_ICON = `
    <div id="pill-battery" class="hidden shrink-0 flex items-center gap-1">
        <div class="flex items-center">
            <div class="relative flex h-2 w-5 overflow-hidden rounded-[1.5px] border border-current p-px">
                <div id="pill-bat-fill" class="h-full rounded-[0.5px] bg-current transition-all duration-500" style="width:0%"></div>
            </div>
            <div class="-ml-px h-[5px] w-[2px] rounded-r-[0.5px] bg-current"></div>
        </div>
        <span id="pill-bat-pct" class="text-[9px] font-mono tabular-nums leading-none"></span>
    </div>`;

export function renderConnectionDialog(): string {
  return `
        <div id="connection-info" class="relative min-w-0">
            <button
                id="status-pill"
                type="button"
                class="status-pill-btn flex h-[30px] max-w-full items-center gap-2 rounded border border-border bg-surface-raised px-3 text-[10px] font-semibold uppercase tracking-[0.04em] text-muted transition hover:border-accent hover:bg-accent-bg hover:text-accent"
                aria-haspopup="dialog"
                aria-expanded="false"
                aria-controls="connection-dialog-panel"
            >
                <span id="status-dot"></span>
                <span id="status-text" class="truncate normal-case">DISCONNECTED</span>
                ${BATTERY_ICON}
            </button>
            <div
                id="connection-dialog-panel"
                class="absolute left-0 top-[calc(100%+6px)] z-50 hidden w-[340px] max-w-[calc(100vw-36px)] overflow-hidden rounded border border-border bg-surface-raised py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
                role="dialog"
                aria-label="Connection details"
            >
                <div class="text-[11px]">
                    <div class="${ROW}">
                        <span class="${LABEL} uppercase tracking-[0.06em]">Status</span>
                        <span id="conn-status" class="${VALUE}">DISCONNECTED</span>
                    </div>
                    <div class="${ROW}">
                        <span class="${LABEL} uppercase tracking-[0.06em]">Device</span>
                        <span id="conn-device" class="${VALUE} truncate">${PLACEHOLDER}</span>
                    </div>
                    <div class="${ROW}">
                        <span class="${LABEL} uppercase tracking-[0.06em]">Battery</span>
                        <span id="conn-bat-pct" class="${VALUE}">${PLACEHOLDER}</span>
                    </div>
                    <div class="${ROW}">
                        <span class="${LABEL} uppercase tracking-[0.06em]">BLE ID</span>
                        <span id="conn-id" class="${VALUE} font-mono text-[10px]">${PLACEHOLDER}</span>
                    </div>
                    <div class="${ROW}">
                        <span class="${LABEL} uppercase tracking-[0.06em]">Service</span>
                        <span id="conn-service" class="${VALUE}">0x1814 · RSC</span>
                    </div>
                    <div class="${ROW}">
                        <span class="${LABEL} uppercase tracking-[0.06em]">Uptime</span>
                        <span id="conn-uptime" class="${VALUE}">${PLACEHOLDER}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function bindConnectionDialog({
  onOpenChange,
}: { onOpenChange?: (open: boolean) => void } = {}): { close: () => void } {
  const root = document.getElementById("connection-info")!;
  const btn = document.getElementById("status-pill")!;
  const panel = document.getElementById("connection-dialog-panel")!;

  function setOpen(open: boolean): void {
    panel.classList.toggle("hidden", !open);
    btn.setAttribute("aria-expanded", String(open));
    onOpenChange?.(open);
  }

  function close(): void {
    setOpen(false);
  }

  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(panel.classList.contains("hidden"));
  });

  document.addEventListener("click", (event) => {
    if (!root.contains(event.target as Node)) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return { close };
}

export function updateConnectionDialog({
  statusLabel,
  deviceName,
  deviceId,
  uptime,
}: {
  statusLabel?: string;
  deviceName?: string;
  deviceId?: string;
  uptime?: string;
}): void {
  const connStatus = document.getElementById("conn-status");
  const connDevice = document.getElementById("conn-device");
  const connId = document.getElementById("conn-id");
  const connUptime = document.getElementById("conn-uptime");

  if (connStatus) connStatus.textContent = statusLabel ?? PLACEHOLDER;
  if (connDevice) connDevice.textContent = deviceName ?? PLACEHOLDER;
  if (connId) connId.textContent = deviceId ?? PLACEHOLDER;
  if (connUptime) connUptime.textContent = uptime ?? PLACEHOLDER;
}

export function updateConnectionBattery(level: number | null): void {
  const pillBattery = document.getElementById("pill-battery");
  const pillFill = document.getElementById("pill-bat-fill");
  const pillPct = document.getElementById("pill-bat-pct");
  const rowPct = document.getElementById("conn-bat-pct");

  if (level === null) {
    pillBattery?.classList.add("hidden");
    if (rowPct) rowPct.textContent = PLACEHOLDER;
    return;
  }

  pillBattery?.classList.remove("hidden");
  if (pillFill) (pillFill as HTMLElement).style.width = `${level}%`;
  if (pillPct) pillPct.textContent = `${level}%`;
  if (rowPct) rowPct.textContent = `${level}%`;
}
