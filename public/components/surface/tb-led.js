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
  static get observedAttributes() {
    return ["color", "size", "on", "label", "label-pos", "pulse"];
  }

  static get circuitryPorts() {
    return { inputs: ["signal"], outputs: [] };
  }

  static get sizeConstraints() {
    return { minW: 1, minH: 1, maxW: 1, maxH: 1 };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        :host([label-pos="top"]),
        :host([label-pos="bottom"]) {
          flex-direction: column;
        }

        :host([label-pos="left"]) {
          flex-direction: row-reverse;
        }

        .led {
          border-radius: 50%;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.4);
          transition: background 0.3s, box-shadow 0.3s;
          flex-shrink: 0;
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

    this._led = this.shadowRoot.querySelector(".led");
    this._label = this.shadowRoot.querySelector(".label");
  }

  connectedCallback() { super.connectedCallback(); this._render(); }
  attributeChangedCallback() { this._render(); }

  get on() { return this.hasAttribute("on"); }
  set on(val) {
    if (val) this.setAttribute("on", "");
    else this.removeAttribute("on");
  }

  _render() {
    const size = parseInt(this.getAttribute("size")) || 16;
    const colorName = this.getAttribute("color") || "green";
    const isOn = this.hasAttribute("on");
    const label = this.getAttribute("label") || "";
    const pulse = this.hasAttribute("pulse");

    this._led.style.width = size + "px";
    this._led.style.height = size + "px";
    this._led.classList.toggle("on", isOn);
    this._led.classList.toggle("pulse", pulse && isOn);

    const colors = {
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
