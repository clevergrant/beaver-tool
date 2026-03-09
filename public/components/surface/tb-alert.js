/**
 * <tb-alert> — Blinking LED alert surface component.
 *
 * A large LED that blinks when triggered, with configurable blink modes.
 *
 * Attributes:
 *   on        - Boolean, whether alert is triggered
 *   color     - LED color when triggered (default: "red")
 *   size      - LED diameter in px (default: 24)
 *   mode      - Blink mode: "sine", "square", "sawtooth" (default: "sine")
 *   speed     - Blink speed in ms per cycle (default: 1000)
 *   label     - Optional text label
 */
class TbAlert extends TbSurfaceComponent {
  static get observedAttributes() {
    return ["on", "color", "size", "mode", "speed", "label"];
  }

  static get circuitryPorts() {
    return { inputs: ["trigger"], outputs: [] };
  }

  static get sizeConstraints() {
    return { minW: 1, minH: 1, maxW: null, maxH: null };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._animFrame = null;
    this._startTime = 0;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .alert-led {
          border-radius: 50%;
          transition: background 0.1s;
          flex-shrink: 0;
        }

        .alert-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.5rem;
          color: #e8e4d4;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
      </style>
      <div class="alert-led"></div>
      <span class="alert-label"></span>
    `;

    this._led = this.shadowRoot.querySelector(".alert-led");
    this._labelEl = this.shadowRoot.querySelector(".alert-label");
  }

  connectedCallback() {
    super.connectedCallback();
    this._render();
    this._startAnimation();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopAnimation();
  }

  attributeChangedCallback() {
    this._render();
    if (this.hasAttribute("on")) {
      this._startAnimation();
    } else {
      this._stopAnimation();
    }
  }

  get on() { return this.hasAttribute("on"); }
  set on(val) {
    if (val) this.setAttribute("on", "");
    else this.removeAttribute("on");
  }

  _render() {
    const size = parseInt(this.getAttribute("size")) || 24;
    const label = this.getAttribute("label") || "";

    this._led.style.width = size + "px";
    this._led.style.height = size + "px";
    this._labelEl.textContent = label;
    this._labelEl.style.display = label ? "" : "none";

    if (!this.hasAttribute("on")) {
      this._led.style.background = "#3a2020";
      this._led.style.boxShadow = "inset 0 1px 3px rgba(0,0,0,0.4)";
    }
  }

  _getColor() {
    const colorName = this.getAttribute("color") || "red";
    const colors = {
      red: { on: "#ff3030", glow: "rgba(255,48,48,0.6)" },
      amber: { on: "#ffaa20", glow: "rgba(255,170,32,0.6)" },
      green: { on: "#30ff60", glow: "rgba(48,255,96,0.6)" },
      blue: { on: "#4080ff", glow: "rgba(64,128,255,0.6)" },
    };
    return colors[colorName] || { on: colorName, glow: colorName + "99" };
  }

  _startAnimation() {
    if (this._animFrame) return;
    if (!this.hasAttribute("on")) return;

    this._startTime = performance.now();
    const animate = (now) => {
      if (!this.hasAttribute("on")) {
        this._stopAnimation();
        return;
      }

      const speed = parseInt(this.getAttribute("speed")) || 1000;
      const mode = this.getAttribute("mode") || "sine";
      const elapsed = now - this._startTime;
      const t = (elapsed % speed) / speed; // 0..1

      let brightness;
      switch (mode) {
        case "square":
          brightness = t < 0.5 ? 1 : 0;
          break;
        case "sawtooth":
          brightness = t;
          break;
        case "sine":
        default:
          brightness = (Math.sin(t * Math.PI * 2 - Math.PI / 2) + 1) / 2;
          break;
      }

      const color = this._getColor();
      const size = parseInt(this.getAttribute("size")) || 24;
      const glowSize = Math.round(size * 0.5 * brightness);

      this._led.style.background = brightness > 0.1 ? color.on : "#3a2020";
      this._led.style.opacity = 0.3 + brightness * 0.7;
      this._led.style.boxShadow = brightness > 0.1
        ? `inset 0 1px 3px rgba(0,0,0,0.2), 0 0 ${glowSize}px ${color.glow}`
        : "inset 0 1px 3px rgba(0,0,0,0.4)";

      this._animFrame = requestAnimationFrame(animate);
    };

    this._animFrame = requestAnimationFrame(animate);
  }

  _stopAnimation() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }
}

customElements.define("tb-alert", TbAlert);
