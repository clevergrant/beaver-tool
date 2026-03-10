/**
 * <tb-toggle> — Toggle switch surface component.
 *
 * A physical toggle switch visualization. Click to toggle.
 * Fires 'toggle-change' event with { name, on }.
 *
 * Attributes:
 *   on          - Boolean, current state
 *   name        - Device name (passed in events)
 *   label       - Optional display label
 *   orientation - "vertical" (default) or "horizontal"
 *   switch-style - "squared" (default) or "rounded"
 *   size        - "small" (1x2), "medium" (default, 2x3), or "large" (3x3)
 */
class TbToggle extends TbSurfaceComponent {
  static get observedAttributes() {
    return ["on", "name", "label", "orientation", "switch-style", "size"];
  }

  static get circuitryPorts() {
    return { inputs: [], outputs: ["state"] };
  }

  static get sizeConstraints() {
    return { minW: 1, minH: 2, maxW: null, maxH: null, defaultW: 2, defaultH: 3 };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: grid;
          place-items: center;
          cursor: pointer;
          user-select: none;
        }

        /* ── Squared style (default) ── */

        .switch-housing {
          width: 28px;
          height: 48px;
          background: #3a3a36;
          border-radius: 4px;
          border: 2px solid #5a5a52;
          position: relative;
          box-shadow:
            inset 0 2px 4px rgba(0,0,0,0.5),
            0 1px 0 rgba(255,255,255,0.05);
        }

        :host([orientation="horizontal"]) .switch-housing {
          width: 48px;
          height: 28px;
        }

        .switch-plate {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 4px;
          height: 30px;
          background: #7a7868;
          border-radius: 2px;
        }

        :host([orientation="horizontal"]) .switch-plate {
          width: 30px;
          height: 4px;
        }

        .switch-handle {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          width: 22px;
          height: 14px;
          border-radius: 3px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.4);
        }

        :host([orientation="horizontal"]) .switch-handle {
          top: 50%;
          left: auto;
          transform: translateY(-50%);
          width: 14px;
          height: 22px;
        }

        .switch-handle.on {
          top: 4px;
          background: linear-gradient(180deg,
            var(--comp-hl, #ffaa20),
            color-mix(in srgb, var(--comp-hl, #ffaa20) 70%, black));
        }

        :host([orientation="horizontal"]) .switch-handle.on {
          top: 50%;
          right: 4px;
          left: auto;
          transform: translateY(-50%);
          background: linear-gradient(90deg,
            var(--comp-hl, #ffaa20),
            color-mix(in srgb, var(--comp-hl, #ffaa20) 70%, black));
        }

        .switch-handle.off {
          bottom: 4px;
          top: auto;
          background: linear-gradient(180deg, #8a8a7a, #6a6a60);
        }

        :host([orientation="horizontal"]) .switch-handle.off {
          bottom: auto;
          top: 50%;
          left: 4px;
          transform: translateY(-50%);
          background: linear-gradient(90deg, #8a8a7a, #6a6a60);
        }

        /* ── Rounded style ── */

        :host([switch-style="rounded"]) .switch-housing {
          width: 28px;
          height: 50px;
          border-radius: 14px;
          border: 2px solid #4a4a44;
          background: #2a2a26;
          box-shadow:
            inset 0 2px 6px rgba(0,0,0,0.6),
            0 1px 0 rgba(255,255,255,0.05);
          transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        :host([switch-style="rounded"][orientation="horizontal"]) .switch-housing {
          width: 50px;
          height: 28px;
        }

        /* Track lights up when on */
        :host([switch-style="rounded"]) .switch-housing.on {
          background: color-mix(in srgb, var(--comp-hl, #ffaa20) 12%, #2a2a26);
          border-color: color-mix(in srgb, var(--comp-hl, #ffaa20) 40%, #4a4a44);
          box-shadow:
            inset 0 2px 6px rgba(0,0,0,0.4),
            0 0 8px color-mix(in srgb, var(--comp-hl, #ffaa20) 15%, transparent),
            0 1px 0 rgba(255,255,255,0.05);
        }

        :host([switch-style="rounded"]) .switch-plate {
          display: none;
        }

        :host([switch-style="rounded"]) .switch-handle {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          left: auto;
          transform: none;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }

        /* Rounded – vertical (default) */
        :host([switch-style="rounded"]) .switch-handle.off {
          top: auto;
          bottom: 3px;
          left: 50%;
          transform: translateX(-50%);
          background: radial-gradient(circle at 40% 35%, #9a9a8a, #6a6a60);
        }

        :host([switch-style="rounded"]) .switch-handle.on {
          top: 3px;
          bottom: auto;
          left: 50%;
          right: auto;
          transform: translateX(-50%);
          background: radial-gradient(circle at 40% 35%,
            color-mix(in srgb, var(--comp-hl, #ffaa20) 80%, white),
            var(--comp-hl, #ffaa20));
          box-shadow:
            0 2px 4px rgba(0,0,0,0.4),
            0 0 10px color-mix(in srgb, var(--comp-hl, #ffaa20) 50%, transparent),
            0 0 20px color-mix(in srgb, var(--comp-hl, #ffaa20) 15%, transparent);
        }

        /* Rounded – horizontal overrides */
        :host([switch-style="rounded"][orientation="horizontal"]) .switch-handle.off {
          top: 50%;
          bottom: auto;
          left: 3px;
          transform: translateY(-50%);
        }

        :host([switch-style="rounded"][orientation="horizontal"]) .switch-handle.on {
          top: 50%;
          bottom: auto;
          left: auto;
          right: 3px;
          transform: translateY(-50%);
        }

        /* ── Small size variants (1×2 = 20×40px cell) ── */

        /* Small squared – vertical */
        :host([size="small"]) .switch-housing {
          width: 16px;
          height: 28px;
          border-radius: 3px;
        }

        :host([size="small"]) .switch-plate {
          width: 2px;
          height: 16px;
        }

        :host([size="small"]) .switch-handle {
          width: 12px;
          height: 8px;
          border-radius: 2px;
        }

        :host([size="small"]) .switch-handle.on { top: 3px; }
        :host([size="small"]) .switch-handle.off { bottom: 3px; }

        /* Small squared – horizontal */
        :host([size="small"][orientation="horizontal"]) .switch-housing {
          width: 28px;
          height: 16px;
        }

        :host([size="small"][orientation="horizontal"]) .switch-plate {
          width: 16px;
          height: 2px;
        }

        :host([size="small"][orientation="horizontal"]) .switch-handle {
          width: 8px;
          height: 12px;
        }

        :host([size="small"][orientation="horizontal"]) .switch-handle.on { right: 3px; }
        :host([size="small"][orientation="horizontal"]) .switch-handle.off { left: 3px; }

        /* Small rounded – vertical */
        :host([size="small"][switch-style="rounded"]) .switch-housing {
          width: 16px;
          height: 30px;
          border-radius: 8px;
        }

        :host([size="small"][switch-style="rounded"]) .switch-handle {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        /* Small rounded – horizontal */
        :host([size="small"][switch-style="rounded"][orientation="horizontal"]) .switch-housing {
          width: 30px;
          height: 16px;
          border-radius: 8px;
        }

        :host([size="small"][switch-style="rounded"][orientation="horizontal"]) .switch-handle {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        /* ── Large squared (3×3 = 60×60px cell) ── */

        :host([size="large"]) .switch-housing {
          width: 52px;
          height: 48px;
        }

        :host([size="large"]) .switch-plate {
          width: 4px;
          height: 30px;
        }

        :host([size="large"]) .switch-handle {
          width: 40px;
          height: 14px;
        }

        :host([size="large"][orientation="horizontal"]) .switch-housing {
          width: 48px;
          height: 52px;
        }

        :host([size="large"][orientation="horizontal"]) .switch-plate {
          width: 30px;
          height: 4px;
        }

        :host([size="large"][orientation="horizontal"]) .switch-handle {
          width: 14px;
          height: 40px;
        }

        /* ── Large rounded: Illuminated pushbutton ── */

        :host([size="large"][switch-style="rounded"]) .switch-housing,
        :host([size="large"][switch-style="rounded"]) .switch-plate,
        :host([size="large"][switch-style="rounded"]) .switch-handle {
          display: none;
        }

        :host([size="large"][switch-style="rounded"]) .pushbutton {
          display: flex;
        }

        .pushbutton {
          display: none;
          align-items: center;
          justify-content: center;
          position: relative;
          width: 50px;
          height: 50px;
        }

        /* Outer bezel ring */
        .pb-bezel {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: conic-gradient(from 135deg, #6a6458, #9a9488, #6a6458, #4a4840, #6a6458);
          box-shadow:
            0 2px 6px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.1);
        }

        /* Indicator ring channel */
        .pb-ring {
          position: absolute;
          inset: 4px;
          border-radius: 50%;
          background: #1a1a18;
          transition: all 0.3s ease;
        }

        .pb-ring.on {
          background: #1a1a18;
          box-shadow:
            inset 0 0 4px color-mix(in srgb, var(--comp-hl, #ffaa20) 60%, transparent),
            0 0 8px color-mix(in srgb, var(--comp-hl, #ffaa20) 30%, transparent),
            0 0 16px color-mix(in srgb, var(--comp-hl, #ffaa20) 10%, transparent);
        }

        .pb-ring.on::after {
          content: '';
          position: absolute;
          inset: 2px;
          border-radius: 50%;
          border: 2px solid color-mix(in srgb, var(--comp-hl, #ffaa20) 70%, transparent);
          box-shadow: 0 0 4px color-mix(in srgb, var(--comp-hl, #ffaa20) 40%, transparent);
        }

        /* Button face */
        .pb-face {
          position: absolute;
          inset: 9px;
          border-radius: 50%;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pb-face.off {
          background: radial-gradient(circle at 40% 35%, #5a5a52, #3a3a36);
          box-shadow:
            0 3px 4px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.1);
        }

        .pb-face.on {
          background: radial-gradient(circle at 40% 35%,
            color-mix(in srgb, var(--comp-hl, #ffaa20) 80%, white),
            var(--comp-hl, #ffaa20));
          box-shadow:
            0 1px 2px rgba(0,0,0,0.4),
            inset 0 2px 3px rgba(0,0,0,0.15),
            0 0 12px color-mix(in srgb, var(--comp-hl, #ffaa20) 40%, transparent);
          transform: translateY(1px);
        }

        /* Pip mark on button face */
        .pb-pip {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          transition: all 0.2s ease;
        }

        .pb-face.off .pb-pip {
          background: #3a3a36;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.5);
        }

        .pb-face.on .pb-pip {
          background: rgba(255,255,255,0.6);
          box-shadow: 0 0 4px rgba(255,255,255,0.3);
        }

        .switch-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.5rem;
          color: #8a8a7a;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

      </style>

      <div class="switch-housing">
        <div class="switch-plate"></div>
        <div class="switch-handle"></div>
      </div>
      <div class="pushbutton">
        <div class="pb-bezel"></div>
        <div class="pb-ring"></div>
        <div class="pb-face"><div class="pb-pip"></div></div>
      </div>
      <span class="switch-label"></span>
    `;

    this._housing = this.shadowRoot.querySelector(".switch-housing");
    this._handle = this.shadowRoot.querySelector(".switch-handle");
    this._pbRing = this.shadowRoot.querySelector(".pb-ring");
    this._pbFace = this.shadowRoot.querySelector(".pb-face");
    this._labelEl = this.shadowRoot.querySelector(".switch-label");

    this.addEventListener("click", () => {
      const isOn = this.hasAttribute("on");
      if (isOn) this.removeAttribute("on");
      else this.setAttribute("on", "");

      this.dispatchEvent(new CustomEvent("toggle-change", {
        bubbles: true,
        detail: { name: this.getAttribute("name") || "", on: !isOn },
      }));
    });
  }

  connectedCallback() { super.connectedCallback(); this._render(); }
  attributeChangedCallback() { this._render(); }

  get on() { return this.hasAttribute("on"); }
  set on(val) {
    if (val) this.setAttribute("on", "");
    else this.removeAttribute("on");
  }

  _render() {
    const isOn = this.hasAttribute("on");
    const label = this.getAttribute("label") || "";

    const state = isOn ? "on" : "off";
    this._housing.className = "switch-housing " + state;
    this._handle.className = "switch-handle " + state;
    this._pbRing.className = "pb-ring " + state;
    this._pbFace.className = "pb-face " + state;
    this._labelEl.textContent = label;
    this._labelEl.style.display = label ? "" : "none";
  }
}

customElements.define("tb-toggle", TbToggle);
