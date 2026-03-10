/**
 * <tb-toggle> — Toggle switch surface component.
 *
 * A physical toggle switch visualization. Click to toggle.
 * Fires 'toggle-change' event with { name, on }.
 *
 * Attributes:
 *   on    - Boolean, current state
 *   name  - Device name (passed in events)
 *   label - Optional display label
 */
class TbToggle extends TbSurfaceComponent {
  static get observedAttributes() {
    return ["on", "name", "label"];
  }

  static get circuitryPorts() {
    return { inputs: [], outputs: ["state"] };
  }

  static get sizeConstraints() {
    return { minW: 2, minH: 2, maxW: null, maxH: null };
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

        .switch-handle.on {
          top: 4px;
          background: linear-gradient(180deg, #e74c3c, #c0392b);
        }

        .switch-handle.off {
          bottom: 4px;
          top: auto;
          background: linear-gradient(180deg, #8a8a7a, #6a6a60);
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
