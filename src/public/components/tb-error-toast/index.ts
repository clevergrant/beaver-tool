import styles from './tb-error-toast.scss';
import type { TbError } from '../../js/errors';

const sheet = new CSSStyleSheet();
sheet.replaceSync(styles);

const MAX_TOASTS = 5;
const DEDUP_WINDOW_MS = 2000;
const DISMISS_ERROR = 0;       // errors persist
const DISMISS_WARNING = 8000;
const DISMISS_NOTE = 5000;

interface ToastEntry {
  el: HTMLDivElement;
  error: TbError;
  count: number;
  timestamp: number;
  timer: ReturnType<typeof setTimeout> | null;
}

class TbErrorToast extends HTMLElement {
  private _toasts: ToastEntry[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.adoptedStyleSheets = [sheet];
  }

  connectedCallback(): void {
    window.addEventListener("tb-error", ((e: CustomEvent<TbError>) => {
      this._handleError(e.detail);
    }) as EventListener);
  }

  private _handleError(err: TbError): void {
    const now = Date.now();

    // Deduplicate: same code within window
    const existing = this._toasts.find(
      t => t.error.code === err.code && now - t.timestamp < DEDUP_WINDOW_MS
    );
    if (existing) {
      existing.count++;
      existing.timestamp = now;
      this._updateCount(existing);
      return;
    }

    // Evict oldest if at max
    while (this._toasts.length >= MAX_TOASTS) {
      this._removeToast(this._toasts[0]!);
    }

    const el = this._buildToast(err);
    const entry: ToastEntry = { el, error: err, count: 1, timestamp: now, timer: null };

    // Auto-dismiss for non-errors
    const duration = err.severity === "error" ? DISMISS_ERROR
      : err.severity === "warning" ? DISMISS_WARNING
      : DISMISS_NOTE;

    if (duration > 0) {
      const progress = el.querySelector(".toast-progress") as HTMLElement;
      if (progress) {
        progress.style.animation = `progress-shrink ${duration}ms linear forwards`;
      }
      entry.timer = setTimeout(() => this._dismissToast(entry), duration);
    }

    this._toasts.push(entry);
    this.shadowRoot!.appendChild(el);
  }

  private _buildToast(err: TbError): HTMLDivElement {
    const el = document.createElement("div");
    el.className = `toast toast--${err.severity}`;
    el.setAttribute("role", "alert");

    // Header: severity[CODE]: title
    let html = `<div class="toast-header">`;
    html += `<span class="toast-severity">${err.severity}</span>`;
    html += `[<span class="toast-code">${err.code}</span>]: `;
    html += `<span class="toast-title">${esc(err.title)}</span>`;
    html += `<button class="toast-dismiss" aria-label="Dismiss">\u2715</button>`;
    html += `</div>`;

    // Context block
    if (err.context?.length) {
      html += `<div class="toast-context"><pre>${err.context.map(esc).join("\n")}</pre></div>`;
    }

    // Help line
    if (err.help) {
      html += `<div class="toast-help"><span class="toast-label toast-label--help">help: </span><span class="toast-text">${esc(err.help)}</span></div>`;
    }

    // Note line
    if (err.note) {
      html += `<div class="toast-note"><span class="toast-label toast-label--note">note: </span><span class="toast-text">${esc(err.note)}</span></div>`;
    }

    // Progress bar (for auto-dismiss)
    html += `<div class="toast-progress"></div>`;

    el.innerHTML = html;

    // Dismiss button handler
    el.querySelector(".toast-dismiss")!.addEventListener("click", () => {
      const entry = this._toasts.find(t => t.el === el);
      if (entry) this._dismissToast(entry);
    });

    return el;
  }

  private _updateCount(entry: ToastEntry): void {
    const title = entry.el.querySelector(".toast-title");
    if (!title) return;
    let badge = title.querySelector(".toast-count");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "toast-count";
      title.appendChild(badge);
    }
    badge.textContent = `\u00d7${entry.count}`;
  }

  private _dismissToast(entry: ToastEntry): void {
    if (entry.timer) clearTimeout(entry.timer);
    entry.el.classList.add("dismissing");
    entry.el.addEventListener("animationend", () => this._removeToast(entry), { once: true });
  }

  private _removeToast(entry: ToastEntry): void {
    if (entry.timer) clearTimeout(entry.timer);
    entry.el.remove();
    this._toasts = this._toasts.filter(t => t !== entry);
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

customElements.define("tb-error-toast", TbErrorToast);
