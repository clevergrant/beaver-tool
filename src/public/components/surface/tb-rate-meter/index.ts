import styles from './tb-rate-meter.scss';
import { TbSurfaceComponent, type CircuitryPorts, type SizeConstraints } from '../tb-surface-component';

const sheet = new CSSStyleSheet();
sheet.replaceSync(styles);

const WINDOW_MS = 5000;
const REFRESH_MS = 250;

/**
 * <tb-rate-meter> — Signal rate odometer surface component.
 *
 * Displays the rate at which the input signal toggles, shown as
 * an LCD-style numeric readout with auto-scaling units (/s or /m).
 *
 * Attributes:
 *   on   - Boolean, toggled by connected lever/adapter signal
 *   size - Display size hint in px
 */
class TbRateMeter extends TbSurfaceComponent {
  static get observedAttributes(): string[] {
    return ["on", "size"];
  }

  static get circuitryPorts(): CircuitryPorts {
    return { inputs: ["signal"], outputs: [] };
  }

  static get sizeConstraints(): SizeConstraints {
    return { minW: 3, minH: 2, maxW: null, maxH: null };
  }

  private _digitsEl: HTMLElement;
  private _unitEl: HTMLElement;
  private _labelEl: HTMLElement;
  private _toggleTimestamps: number[] = [];
  private _refreshTimer: number | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.adoptedStyleSheets = [sheet];
    this.shadowRoot!.innerHTML = `
      <div class="meter-housing">
        <div class="meter-display">
          <span class="meter-digits">0.0</span>
          <span class="meter-unit">/s</span>
        </div>
        <div class="meter-label">RATE</div>
      </div>
    `;

    this._digitsEl = this.shadowRoot!.querySelector(".meter-digits") as HTMLElement;
    this._unitEl = this.shadowRoot!.querySelector(".meter-unit") as HTMLElement;
    this._labelEl = this.shadowRoot!.querySelector(".meter-label") as HTMLElement;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._render();
    this._refreshTimer = window.setInterval(() => this._render(), REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._refreshTimer !== null) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (name === "on") {
      const wasOn = oldValue !== null;
      const isOn = newValue !== null;
      if (wasOn !== isOn) {
        this._toggleTimestamps.push(performance.now());
      }
    }
    this._render();
  }

  private _computeRate(): { value: number; unit: string } {
    const now = performance.now();
    this._toggleTimestamps = this._toggleTimestamps.filter(t => now - t < WINDOW_MS);
    const count = this._toggleTimestamps.length;
    if (count < 2) return { value: 0, unit: "/s" };

    const span = (this._toggleTimestamps[count - 1] - this._toggleTimestamps[0]) / 1000;
    if (span === 0) return { value: 0, unit: "/s" };

    const ratePerSec = (count - 1) / span;
    if (ratePerSec >= 1.0) {
      return { value: Math.round(ratePerSec * 10) / 10, unit: "/s" };
    }
    return { value: Math.round(ratePerSec * 60 * 10) / 10, unit: "/m" };
  }

  private _render(): void {
    if (!this._digitsEl) return;

    const { value, unit } = this._computeRate();
    this._digitsEl.textContent = value.toFixed(1);
    this._unitEl.textContent = unit;

    const rect = this.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const fontSize = Math.max(12, Math.min(rect.width * 0.2, rect.height * 0.35));
      this._digitsEl.style.fontSize = fontSize + "px";
      this._unitEl.style.fontSize = (fontSize * 0.5) + "px";
      this._labelEl.style.fontSize = Math.max(8, fontSize * 0.3) + "px";
    }
  }
}

customElements.define("tb-rate-meter", TbRateMeter);
