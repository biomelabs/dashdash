const MENU_BTN =
  "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded border border-border bg-surface-raised text-text transition hover:border-accent hover:bg-accent-bg hover:text-accent";

const MENU_ITEM =
  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text transition hover:bg-accent-bg-subtle hover:text-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text";

const ICON_EXPORT = `
    <svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
`;

const ICON_CLEAR = `
    <svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
`;

export function renderActionsMenu(): string {
  return `
        <div id="actions-menu" class="relative">
            <button
                id="btn-actions-menu"
                class="${MENU_BTN}"
                type="button"
                aria-haspopup="menu"
                aria-expanded="false"
                aria-controls="actions-menu-panel"
                title="More actions"
            >
                <svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <circle cx="3" cy="8" r="1.25"/>
                    <circle cx="8" cy="8" r="1.25"/>
                    <circle cx="13" cy="8" r="1.25"/>
                </svg>
            </button>
            <div
                id="actions-menu-panel"
                class="absolute right-0 top-[calc(100%+6px)] z-50 hidden min-w-[148px] overflow-hidden rounded border border-border bg-surface-raised py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
                role="menu"
            >
                <button
                    id="btn-export"
                    class="${MENU_ITEM}"
                    type="button"
                    role="menuitem"
                    disabled
                    title="Export run as CSV"
                >
                    ${ICON_EXPORT}
                    <span>Export</span>
                </button>
                <button
                    id="btn-clear-run"
                    class="${MENU_ITEM} text-danger hover:text-danger"
                    type="button"
                    role="menuitem"
                    disabled
                    title="Clear persisted run data"
                >
                    ${ICON_CLEAR}
                    <span>Clear Run</span>
                </button>
            </div>
        </div>
    `;
}

export function bindActionsMenu({
  onExport,
  onClearRun,
}: {
  onExport: () => void;
  onClearRun: () => void;
}): {
  btnExport: HTMLButtonElement;
  btnClearRun: HTMLButtonElement;
  close: () => void;
} {
  const root = document.getElementById("actions-menu")!;
  const btnMenu = document.getElementById("btn-actions-menu")!;
  const panel = document.getElementById("actions-menu-panel")!;
  const btnExport = document.getElementById("btn-export") as HTMLButtonElement;
  const btnClearRun = document.getElementById(
    "btn-clear-run",
  ) as HTMLButtonElement;

  function setOpen(open: boolean): void {
    panel.classList.toggle("hidden", !open);
    btnMenu.setAttribute("aria-expanded", String(open));
  }

  function close(): void {
    setOpen(false);
  }

  btnMenu.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(panel.classList.contains("hidden"));
  });

  btnExport.addEventListener("click", () => {
    close();
    onExport();
  });

  btnClearRun.addEventListener("click", () => {
    close();
    onClearRun();
  });

  document.addEventListener("click", (event) => {
    if (!root.contains(event.target as Node)) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return {
    btnExport,
    btnClearRun,
    close,
  };
}
