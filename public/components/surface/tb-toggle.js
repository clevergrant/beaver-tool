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
    return { minW: 1, minH: 2, maxW: null, maxH: null };
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
          background: linear-gradient(180deg, #e74c3c, #c0392b);
        }

        :host([orientation="horizontal"]) .switch-handle.on {
          top: 50%;
          right: 4px;
          left: auto;
          transform: translateY(-50%);
          background: linear-gradient(90deg, #e74c3c, #c0392b);
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

        /* ── Rounded / Material Design style ── */

        :host([switch-style="rounded"]) .switch-housing {
          width: 24px;
          height: 44px;
          border-radius: 12px;
          border: 2px solid #4a4a44;
          background: #3a3a36;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.4);
          transition: background 0.2s ease, border-color 0.2s ease;
        }

        :host([switch-style="rounded"][orientation="horizontal"]) .switch-housing {
          width: 44px;
          height: 24px;
        }

        :host([switch-style="rounded"]) .switch-plate {
          display: none;
        }

        :host([switch-style="rounded"]) .switch-handle {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          left: auto;
          transform: none;
          transition: all 0.2s ease;
        }

        /* Rounded – vertical (default) */
        :host([switch-style="rounded"]) .switch-handle.off {
          top: auto;
          bottom: 3px;
          left: 50%;
          transform: translateX(-50%);
          background: #8a8a7a;
        }

        :host([switch-style="rounded"]) .switch-handle.on {
          top: 3px;
          bottom: auto;
          left: 50%;
          right: auto;
          transform: translateX(-50%);
          background: #e74c3c;
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

        /* ── Small size variants (1x2) ── */

        /* Small squared – vertical */
        :host([size="small"]) .switch-housing {
          width: 18px;
          height: 30px;
          border-radius: 3px;
        }

        :host([size="small"]) .switch-plate {
          width: 3px;
          height: 18px;
        }

        :host([size="small"]) .switch-handle {
          width: 14px;
          height: 9px;
          border-radius: 2px;
        }

        /* Small squared – horizontal */
        :host([size="small"][orientation="horizontal"]) .switch-housing {
          width: 30px;
          height: 18px;
        }

        :host([size="small"][orientation="horizontal"]) .switch-plate {
          width: 18px;
          height: 3px;
        }

        :host([size="small"][orientation="horizontal"]) .switch-handle {
          width: 9px;
          height: 14px;
        }

        /* Small rounded – vertical */
        :host([size="small"][switch-style="rounded"]) .switch-housing {
          width: 16px;
          height: 28px;
          border-radius: 8px;
        }

        :host([size="small"][switch-style="rounded"]) .switch-handle {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        /* Small rounded – horizontal */
        :host([size="small"][switch-style="rounded"][orientation="horizontal"]) .switch-housing {
          width: 28px;
          height: 16px;
          border-radius: 8px;
        }

        :host([size="small"][switch-style="rounded"][orientation="horizontal"]) .switch-handle {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        /* ── Large size variants (3x3) ── */

        /* Large squared – vertical: 2x1 housing (wider) */
        :host([size="large"]) .switch-housing {
          width: 56px;
          height: 48px;
        }

        :host([size="large"]) .switch-plate {
          width: 4px;
          height: 30px;
        }

        :host([size="large"]) .switch-handle {
          width: 44px;
          height: 14px;
        }

        /* Large squared – horizontal: 1x2 housing (taller) */
        :host([size="large"][orientation="horizontal"]) .switch-housing {
          width: 48px;
          height: 56px;
        }

        :host([size="large"][orientation="horizontal"]) .switch-plate {
          width: 30px;
          height: 4px;
        }

        :host([size="large"][orientation="horizontal"]) .switch-handle {
          width: 14px;
          height: 44px;
        }

        /* Large rounded – vertical */
        :host([size="large"][switch-style="rounded"]) .switch-housing {
          width: 48px;
          height: 44px;
          border-radius: 22px;
        }

        :host([size="large"][switch-style="rounded"]) .switch-handle {
          width: 36px;
          height: 18px;
          border-radius: 9px;
        }

        /* Large rounded – horizontal */
        :host([size="large"][switch-style="rounded"][orientation="horizontal"]) .switch-housing {
          width: 44px;
          height: 48px;
          border-radius: 22px;
        }

        :host([size="large"][switch-style="rounded"][orientation="horizontal"]) .switch-handle {
          width: 18px;
          height: 36px;
          border-radius: 9px;
        }

        .switch-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.5rem;
          color: #8a8a7a;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        :host(:hover) .switch-housing {
          border-color: #8a8a7a;
        }

        :host([switch-style="rounded"]:hover) .switch-housing {
          border-color: #6a6a60;
        }
      </style>

      <div class="switch-housing">
        <div class="switch-plate"></div>
        <div class="switch-handle"></div>
      </div>
      <span class="switch-label"></span>
    `;

    this._handle = this.shadowRoot.querySelector(".switch-handle");
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

    this._handle.className = "switch-handle " + (isOn ? "on" : "off");
    this._labelEl.textContent = label;
    this._labelEl.style.display = label ? "" : "none";
  }
}

customElements.define("tb-toggle", TbToggle);
