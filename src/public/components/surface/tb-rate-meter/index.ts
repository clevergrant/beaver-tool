import styles from './tb-rate-meter.scss';
import { TbSurfaceComponent, type CircuitryPorts, type SizeConstraints } from '../tb-surface-component';

const sheet = new CSSStyleSheet();
sheet.replaceSync(styles);

const WINDOW_MS = 5000;
const REFRESH_MS = 250;
const DIAL_MIN_DEG = -90;
const DIAL_MAX_DEG = 90;
const DIAL_TICK_COUNT = 10;

/**
 * <tb-rate-meter> — Signal rate surface component.
 *
 * Displays the rate at which the input signal toggles.
 * Two variants controlled by the `meter-style` attribute:
 *   "lcd"  (default) — LCD-style numeric readout
 *   "dial" — Analog gauge dial with a rotating needle
 *
 * Attributes:
 *   on          - Boolean, toggled by connected lever/adapter signal
 *   size        - Display size hint in px
 *   meter-style - "lcd" (default) or "dial"
 */
class TbRateMeter extends TbSurfaceComponent {
  static get observedAttributes(): string[] {
    return ["on", "size", "meter-style"];
  }

  static get circuitryPorts(): CircuitryPorts {
    return { inputs: ["signal"], outputs: [] };
  }

  static get sizeConstraints(): SizeConstraints {
    return { minW: 3, minH: 2, maxW: null, maxH: null };
  }

  private _container: HTMLElement;
  private _toggleTimestamps: number[] = [];
  private _refreshTimer: number | null = null;
  private _currentStyle: string = "lcd";

  // LCD variant elements
  private _digitsEl: HTMLElement | null = null;
  private _unitEl: HTMLElement | null = null;
  private _labelEl: HTMLElement | null = null;

  // Dial variant elements
  private _needleEl: HTMLElement | null = null;
  private _dialValueEl: HTMLElement | null = null;
  private _dialUnitEl: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.adoptedStyleSheets = [sheet];

    this._container = document.createElement("div");
    this.shadowRoot!.appendChild(this._container);

    this._buildLcd();
  }

  private _buildLcd(): void {
    this._currentStyle = "lcd";
    this._container.className = "meter-housing";
    this._container.innerHTML = `
      <div class="meter-display">
        <span class="meter-digits">0.0</span>
        <span class="meter-unit">/s</span>
      </div>
      <div class="meter-label">RATE</div>
    `;
    this._digitsEl = this._container.querySelector(".meter-digits");
    this._unitEl = this._container.querySelector(".meter-unit");
    this._labelEl = this._container.querySelector(".meter-label");
    this._needleEl = null;
    this._dialValueEl = null;
    this._dialUnitEl = null;
  }

  private _buildDial(): void {
    this._currentStyle = "dial";
    this._container.className = "dial-housing";

    // Build tick marks along the semicircle arc
    // Ticks radiate outward from center-bottom; rotation origin is center-bottom
    let ticksHtml = "";
    for (let i = 0; i <= DIAL_TICK_COUNT; i++) {
      const deg = DIAL_MIN_DEG + (i / DIAL_TICK_COUNT) * (DIAL_MAX_DEG - DIAL_MIN_DEG);
      const isMajor = i % 5 === 0;
      ticksHtml += `<div class="dial-tick ${isMajor ? "dial-tick-major" : ""}" style="transform: rotate(${deg}deg)"></div>`;
    }

    // Scale labels positioned along inner arc
    let labelsHtml = "";
    for (let i = 0; i <= DIAL_TICK_COUNT; i += 5) {
      const deg = DIAL_MIN_DEG + (i / DIAL_TICK_COUNT) * (DIAL_MAX_DEG - DIAL_MIN_DEG);
      // Convert to radians: 0deg = up, so offset by -90 for standard math
      const rad = (deg - 90) * Math.PI / 180;
      const labelR = 0.62;
      // Position relative to center-bottom of the frame (50%, 100%)
      const lx = 50 + labelR * 50 * Math.cos(rad);
      const ly = 100 + labelR * 100 * Math.sin(rad);
      labelsHtml += `<span class="dial-scale-label" style="left:${lx}%;top:${ly}%">${i}</span>`;
    }

    this._container.innerHTML = `
      <div class="dial-frame">
        ${ticksHtml}
        ${labelsHtml}
        <div class="dial-needle"></div>
        <div class="dial-cap"></div>
        <div class="dial-marker"></div>
      </div>
      <div class="dial-footer">
        <span class="dial-value">0.0</span>
        <span class="dial-unit">/s</span>
      </div>
    `;
    this._needleEl = this._container.querySelector(".dial-needle");
    this._dialValueEl = this._container.querySelector(".dial-value");
    this._dialUnitEl = this._container.querySelector(".dial-unit");
    this._digitsEl = null;
    this._unitEl = null;
    this._labelEl = null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._syncStyle();
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
    if (name === "meter-style") {
      this._syncStyle();
    }
    this._render();
  }

  private _syncStyle(): void {
    const style = this.getAttribute("meter-style") || "lcd";
    if (style === this._currentStyle) return;
    if (style === "dial") {
      this._buildDial();
    } else {
      this._buildLcd();
    }
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
    const { value, unit } = this._computeRate();
    const rect = this.getBoundingClientRect();

    if (this._currentStyle === "dial") {
      this._renderDial(value, unit, rect);
    } else {
      this._renderLcd(value, unit, rect);
    }
  }

  private _renderLcd(value: number, unit: string, rect: DOMRect): void {
    if (!this._digitsEl) return;
    this._digitsEl.textContent = value.toFixed(1);
    this._unitEl!.textContent = unit;

    if (rect.width > 0 && rect.height > 0) {
      const fontSize = Math.max(12, Math.min(rect.width * 0.2, rect.height * 0.35));
      this._digitsEl.style.fontSize = fontSize + "px";
      this._unitEl!.style.fontSize = (fontSize * 0.5) + "px";
      this._labelEl!.style.fontSize = Math.max(8, fontSize * 0.3) + "px";
    }
  }

  private _renderDial(value: number, unit: string, rect: DOMRect): void {
    if (!this._needleEl) return;

    // Clamp to 0–10 range for the dial sweep
    const clamped = Math.min(value, DIAL_TICK_COUNT);
    const pct = clamped / DIAL_TICK_COUNT;
    const deg = DIAL_MIN_DEG + pct * (DIAL_MAX_DEG - DIAL_MIN_DEG);
    this._needleEl.style.transform = `rotate(${deg}deg)`;

    this._dialValueEl!.textContent = value.toFixed(1);
    this._dialUnitEl!.textContent = unit;

    if (rect.width > 0 && rect.height > 0) {
      // Size the half-circle frame to fit the container
      const frame = this._container.querySelector(".dial-frame") as HTMLElement;
      if (frame) {
        const size = Math.min(rect.width * 0.9, (rect.height - 16) * 1.8);
        frame.style.width = size + "px";
        frame.style.height = (size / 2) + "px";
      }

      const footerSize = Math.max(8, Math.min(rect.width * 0.09, rect.height * 0.14));
      this._dialValueEl!.style.fontSize = footerSize + "px";
      this._dialUnitEl!.style.fontSize = (footerSize * 0.8) + "px";

      const labelSize = Math.max(6, Math.min(rect.width * 0.06, rect.height * 0.1));
      const labels = this._container.querySelectorAll(".dial-scale-label") as NodeListOf<HTMLElement>;
      labels.forEach(l => { l.style.fontSize = labelSize + "px"; });
    }
  }
}

customElements.define("tb-rate-meter", TbRateMeter);
