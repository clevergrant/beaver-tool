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
  static get observedAttributes() {
    return ["on", "color", "speed", "label"];
  }

  static get circuitryPorts() {
    return { inputs: ["trigger"], outputs: [] };
  }

  static get sizeConstraints() {
    return { minW: 2, minH: 2, maxW: 2, maxH: 2 };
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
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .lamp-housing {
          position: relative;
          width: 85%;
          aspect-ratio: 1;
          max-width: 85%;
          max-height: 85%;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 35%, #4a4a48, #2a2a28);
          border: 2px solid #555;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3);
          overflow: hidden;
          flex-shrink: 0;
        }

        .lamp-dome {
          position: absolute;
          inset: 10%;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 35%, #5a3030, #2a1515);
          border: 1px solid rgba(255,255,255,0.06);
          transition: background 0.05s;
        }

        /* Mounting bolts */
        .bolt {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #888, #555);
          box-shadow: inset 0 0.5px 1px rgba(255,255,255,0.15);
        }
        .bolt-tl { top: 2px; left: 2px; }
        .bolt-tr { top: 2px; right: 2px; }
        .bolt-bl { bottom: 2px; left: 2px; }
        .bolt-br { bottom: 2px; right: 2px; }

        .alert-label {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          text-align: center;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.45rem;
          color: #e8e4d4;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          line-height: 1;
        }
      </style>
      <div class="lamp-housing">
        <span class="bolt bolt-tl"></span>
        <span class="bolt bolt-tr"></span>
        <span class="bolt bolt-bl"></span>
        <span class="bolt bolt-br"></span>
        <div class="lamp-dome"></div>
      </div>
      <span class="alert-label"></span>
    `;

    this._housing = this.shadowRoot.querySelector(".lamp-housing");
    this._dome = this.shadowRoot.querySelector(".lamp-dome");
    this._labelEl = this.shadowRoot.querySelector(".alert-label");
  }

  connectedCallback() {
    super.connectedCallback();
    this._render();
    if (this.hasAttribute("on")) this._startAnimation();
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
      this._setOff();
    }
  }

  get on() { return this.hasAttribute("on"); }
  set on(val) {
    if (val) this.setAttribute("on", "");
    else this.removeAttribute("on");
  }

  _getColor() {
    const colorName = this.getAttribute("color") || "red";
    const colors = {
      red:   { on: "#ff3030", dim: "#5a3030", glow: "rgba(255,48,48," },
      amber: { on: "#ffaa20", dim: "#5a4020", glow: "rgba(255,170,32," },
      green: { on: "#30ff60", dim: "#305a30", glow: "rgba(48,255,96," },
      blue:  { on: "#4080ff", dim: "#30305a", glow: "rgba(64,128,255," },
    };
    return colors[colorName] || colors.red;
  }

  _render() {
    const label = this.getAttribute("label") || "";
    this._labelEl.textContent = label;
    this._labelEl.style.display = label ? "" : "none";

    if (!this.hasAttribute("on")) {
      this._setOff();
    }
  }

  _setOff() {
    const c = this._getColor();
    this._dome.style.background = `radial-gradient(circle at 40% 35%, ${c.dim}, #2a1515)`;
    this._housing.style.boxShadow = "inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)";
  }

  _startAnimation() {
    if (this._animFrame) return;
    if (!this.hasAttribute("on")) return;

    this._startTime = performance.now();
    const animate = (now) => {
      if (!this.hasAttribute("on")) {
        this._stopAnimation();
        this._setOff();
        return;
      }

      const speed = parseInt(this.getAttribute("speed")) || 800;
      const elapsed = now - this._startTime;
      const t = (elapsed % speed) / speed;
      // Sharp on/off flash with a sine envelope for smooth brightness
      const brightness = t < 0.5
        ? (Math.sin(t / 0.5 * Math.PI - Math.PI / 2) + 1) / 2
        : 0;

      const c = this._getColor();
      const glowSize = Math.round(12 * brightness);

      this._dome.style.background = brightness > 0.05
        ? `radial-gradient(circle at 40% 35%, ${c.on}, ${c.glow}0.6))`
        : `radial-gradient(circle at 40% 35%, ${c.dim}, #2a1515)`;
      this._dome.style.opacity = brightness > 0.05 ? (0.4 + brightness * 0.6) : 1;

      this._housing.style.boxShadow = brightness > 0.05
        ? `inset 0 2px 4px rgba(0,0,0,0.5), 0 0 ${glowSize}px ${c.glow}${(brightness * 0.6).toFixed(2)})`
        : "inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)";

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
