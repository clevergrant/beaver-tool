import { TbSurfaceComponent, type CircuitryPorts, type SizeConstraints } from './tb-surface-component';

/**
 * <tb-led> — LED indicator surface component.
 *
 * Attributes:
 *   color      - LED color: "green", "red", "amber", "blue", or CSS color (default: "green")
 *   size       - Diameter in px (default: 16)
 *   on         - Boolean, whether LED is lit
 *   label      - Optional text label
 *   label-pos  - Label position: "right", "left", "top", "bottom" (default: "right")
 *   pulse      - Boolean, enable pulsing glow animation
 */
class TbLed extends TbSurfaceComponent {
  static get observedAttributes(): string[] {
    return ["color", "size", "on", "label", "label-pos", "pulse"];
  }

  static get circuitryPorts(): CircuitryPorts {
    return { inputs: ["signal"], outputs: [] };
  }

  static get sizeConstraints(): SizeConstraints {
    return { minW: 1, minH: 1, maxW: 1, maxH: 1 };
  }

  private _led: HTMLElement;
  private _label: HTMLElement;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: grid;
          place-items: center;
        }

        .led {
          border-radius: 50%;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.4);
          transition: background 0.3s, box-shadow 0.3s;
        }

        .led.on {
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
        }

        .led.pulse {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        @keyframes pulse-glow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.3); }
        }

        .label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.55rem;
          color: #e8e4d4;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          white-space: nowrap;
        }
      </style>
      <div class="led"></div>
      <span class="label"></span>
    `;

    this._led = this.shadowRoot!.querySelector(".led") as HTMLElement;
    this._label = this.shadowRoot!.querySelector(".label") as HTMLElement;
  }

  connectedCallback(): void { super.connectedCallback(); this._render(); }
  attributeChangedCallback(_name: string, _oldValue: string | null, _newValue: string | null): void { this._render(); }

  private _render(): void {
    const size: number = parseInt(this.getAttribute("size") as string) || 16;
    const colorName: string = this.getAttribute("color") || "green";
    const isOn: boolean = this.hasAttribute("on");
    const label: string = this.getAttribute("label") || "";
    const pulse: boolean = this.hasAttribute("pulse");

    this._led.style.width = size + "px";
    this._led.style.height = size + "px";
    this._led.classList.toggle("on", isOn);
    this._led.classList.toggle("pulse", pulse && isOn);

    const colors: Record<string, { on: string; off: string; glow: string }> = {
      green: { on: "#30ff60", off: "#1a3a1a", glow: "0 0 8px rgba(48,255,96,0.5)" },
      red: { on: "#ff3030", off: "#3a1a1a", glow: "0 0 8px rgba(255,48,48,0.5)" },
      amber: { on: "#ffaa20", off: "#3a2a1a", glow: "0 0 8px rgba(255,170,32,0.5)" },
      blue: { on: "#4080ff", off: "#1a1a3a", glow: "0 0 8px rgba(64,128,255,0.5)" },
    };

    const preset = colors[colorName];
    if (preset) {
      this._led.style.background = isOn ? preset.on : preset.off;
      this._led.style.boxShadow = isOn
        ? `inset 0 1px 3px rgba(0,0,0,0.2), ${preset.glow}`
        : "inset 0 1px 3px rgba(0,0,0,0.4)";
    } else {
      // Custom CSS color
      this._led.style.background = isOn ? colorName : "#2a2a2a";
      this._led.style.boxShadow = isOn
        ? `inset 0 1px 3px rgba(0,0,0,0.2), 0 0 8px ${colorName}40`
        : "inset 0 1px 3px rgba(0,0,0,0.4)";
    }

    this._label.textContent = label;
    this._label.style.display = label ? "" : "none";
  }
}

customElements.define("tb-led", TbLed);
