import styles from './tb-alert.scss';
import { TbSurfaceComponent, type CircuitryPorts, type SizeConstraints } from '../tb-surface-component';

const sheet = new CSSStyleSheet();
sheet.replaceSync(styles);

/**
 * <tb-alert> — Alert lamp surface component.
 *
 * A 2x2 flashing lamp that activates when triggered.
 * Features a dome housing with a pulsing glow effect.
 *
 * Attributes:
 *   on        - Boolean, whether alert is triggered
 *   color     - Lamp color: "red", "amber", "green", "blue" (default: "red")
 *   speed     - Flash speed in ms per cycle (default: 800)
 *   label     - Optional text label
 */
class TbAlert extends TbSurfaceComponent {
  static get observedAttributes(): string[] {
    return ["on", "color", "speed", "label"];
  }

  static get circuitryPorts(): CircuitryPorts {
    return { inputs: ["trigger"], outputs: [] };
  }

  static get sizeConstraints(): SizeConstraints {
    return { minW: 2, minH: 2, maxW: 2, maxH: 2 };
  }

  private _animFrame: number | null;
  private _startTime: number;
  private _housing: HTMLElement;
  private _dome: HTMLElement;
  private _labelEl: HTMLElement;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._animFrame = null;
    this._startTime = 0;

    this.shadowRoot!.adoptedStyleSheets = [sheet];
    this.shadowRoot!.innerHTML = `
      <div class="lamp-housing">
        <span class="bolt bolt-tl"></span>
        <span class="bolt bolt-tr"></span>
        <span class="bolt bolt-bl"></span>
        <span class="bolt bolt-br"></span>
        <div class="lamp-dome"></div>
      </div>
      <span class="alert-label"></span>
    `;

    this._housing = this.shadowRoot!.querySelector(".lamp-housing") as HTMLElement;
    this._dome = this.shadowRoot!.querySelector(".lamp-dome") as HTMLElement;
    this._labelEl = this.shadowRoot!.querySelector(".alert-label") as HTMLElement;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._render();
    if (this.hasAttribute("on")) this._startAnimation();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopAnimation();
  }

  attributeChangedCallback(_name: string, _oldValue: string | null, _newValue: string | null): void {
    this._render();
    if (this.hasAttribute("on")) {
      this._startAnimation();
    } else {
      this._stopAnimation();
      this._setOff();
    }
  }

  private _getColor(): { on: string; dim: string; glow: string } {
    const colorName: string = this.getAttribute("color") || "red";
    const colors: Record<string, { on: string; dim: string; glow: string }> = {
      red:   { on: "#ff3030", dim: "#5a3030", glow: "rgba(255,48,48," },
      amber: { on: "#ffaa20", dim: "#5a4020", glow: "rgba(255,170,32," },
      green: { on: "#30ff60", dim: "#305a30", glow: "rgba(48,255,96," },
      blue:  { on: "#4080ff", dim: "#30305a", glow: "rgba(64,128,255," },
    };
    return colors[colorName] ?? colors["red"]!;
  }

  private _render(): void {
    const label: string = this.getAttribute("label") || "";
    this._labelEl.textContent = label;
    this._labelEl.style.display = label ? "" : "none";

    if (!this.hasAttribute("on")) {
      this._setOff();
    }
  }

  private _setOff(): void {
    const c = this._getColor();
    this._dome.style.background = `radial-gradient(circle at 40% 35%, ${c.dim}, #2a1515)`;
    this._housing.style.boxShadow = "inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)";
  }

  private _startAnimation(): void {
    if (this._animFrame) return;
    if (!this.hasAttribute("on")) return;

    this._startTime = performance.now();
    const animate = (now: number): void => {
      if (!this.hasAttribute("on")) {
        this._stopAnimation();
        this._setOff();
        return;
      }

      const speed: number = parseInt(this.getAttribute("speed") as string) || 800;
      const elapsed: number = now - this._startTime;
      const t: number = (elapsed % speed) / speed;
      // Sharp on/off flash with a sine envelope for smooth brightness
      const brightness: number = t < 0.5
        ? (Math.sin(t / 0.5 * Math.PI - Math.PI / 2) + 1) / 2
        : 0;

      const c = this._getColor();
      const glowSize: number = Math.round(12 * brightness);

      this._dome.style.background = brightness > 0.05
        ? `radial-gradient(circle at 40% 35%, ${c.on}, ${c.glow}0.6))`
        : `radial-gradient(circle at 40% 35%, ${c.dim}, #2a1515)`;
      this._dome.style.opacity = brightness > 0.05 ? String(0.4 + brightness * 0.6) : "1";

      this._housing.style.boxShadow = brightness > 0.05
        ? `inset 0 2px 4px rgba(0,0,0,0.5), 0 0 ${glowSize}px ${c.glow}${(brightness * 0.6).toFixed(2)})`
        : "inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)";

      this._animFrame = requestAnimationFrame(animate);
    };

    this._animFrame = requestAnimationFrame(animate);
  }

  private _stopAnimation(): void {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }
}

customElements.define("tb-alert", TbAlert);
