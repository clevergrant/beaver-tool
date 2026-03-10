/**
 * <tb-color-picker> — Color picker surface component.
 *
 * A 2×2 industrial color swatch. Click to open a popup panel with
 * HSV/RGB sliders and number inputs. Fires 'color-pick' event with
 * the selected hex color when the user clicks Send.
 *
 * The popup panel is appended to document.body so it escapes any
 * overflow:hidden containers in the component hierarchy.
 *
 * Attributes:
 *   color     - Current hex color (default: "#ffaa20")
 *   label     - Optional text label
 */
class TbColorPicker extends TbSurfaceComponent {
  static get observedAttributes() {
    return ["color", "label"];
  }

  static get circuitryPorts() {
    return { inputs: [], outputs: ["color"] };
  }

  static get sizeConstraints() {
    return { minW: 2, minH: 2, maxW: 2, maxH: 2 };
  }

  // --- HSV / RGB conversion ---

  static _hsvToRgb(h, s, v) {
    s /= 100; v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r, g, b;
    if (h < 60)       { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }

  static _rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r)      h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else                h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    const s = max === 0 ? 0 : (d / max) * 100;
    const v = max * 100;
    return [Math.round(h), Math.round(s), Math.round(v)];
  }

  static _hexToRgb(hex) {
    hex = hex.replace("#", "");
    return [
      parseInt(hex.substring(0, 2), 16) || 0,
      parseInt(hex.substring(2, 4), 16) || 0,
      parseInt(hex.substring(4, 6), 16) || 0,
    ];
  }

  static _rgbToHex(r, g, b) {
    const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
    return "#" + toHex(r) + toHex(g) + toHex(b);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._open = false;
    this._mode = "rgb"; // "rgb" or "hsv"
    // Internal color state (RGB)
    this._r = 255; this._g = 170; this._b = 32;
    this._panel = null; // created on first open, appended to body

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          overflow: visible;
          position: relative;
        }

        /* ── Swatch housing (same style as alert lamp) ── */

        .swatch-housing {
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
          cursor: pointer;
        }

        .swatch-housing:hover {
          border-color: #888;
        }

        .swatch-disc {
          position: absolute;
          inset: 10%;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.06);
          transition: background 0.15s;
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

        .picker-label {
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

      <div class="swatch-housing">
        <span class="bolt bolt-tl"></span>
        <span class="bolt bolt-tr"></span>
        <span class="bolt bolt-bl"></span>
        <span class="bolt bolt-br"></span>
        <div class="swatch-disc"></div>
      </div>
      <span class="picker-label"></span>
    `;

    this._disc = this.shadowRoot.querySelector(".swatch-disc");
    this._labelEl = this.shadowRoot.querySelector(".picker-label");
    this._housing = this.shadowRoot.querySelector(".swatch-housing");

    // Housing click toggles popup
    this._housing.addEventListener("click", (e) => {
      e.stopPropagation();
      this._togglePanel();
    });

    // Close on outside click
    this._outsideHandler = (e) => {
      if (this._open && this._panel && !this._panel.contains(e.target) && !this.shadowRoot.contains(e.target)) {
        this._closePanel();
      }
    };

    this._syncDisc();
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._outsideHandler);
    this._render();
  }

  /**
   * Called when attached to a parent component's surface grid.
   * Loads persisted color and auto-sends it to the game.
   */
  _onAttachedToSurface(parentComponent) {
    super._onAttachedToSurface(parentComponent);
    // Fire color-pick on next microtask so circuitry wiring is ready
    queueMicrotask(() => this._emitColor());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("click", this._outsideHandler);
    this._closePanel();
  }

  attributeChangedCallback() {
    const hex = this.getAttribute("color");
    if (hex) {
      const [r, g, b] = TbColorPicker._hexToRgb(hex);
      this._r = r; this._g = g; this._b = b;
    }
    this._render();
  }

  _render() {
    const label = this.getAttribute("label") || "";
    this._labelEl.textContent = label;
    this._labelEl.style.display = label ? "" : "none";
    this._syncDisc();
    if (this._open) {
      this._syncSliders();
      this._syncPreview();
    }
  }

  _syncDisc() {
    const hex = TbColorPicker._rgbToHex(this._r, this._g, this._b);
    this._disc.style.background = hex;
  }

  _syncPreview() {
    if (!this._previewBar) return;
    const hex = TbColorPicker._rgbToHex(this._r, this._g, this._b);
    this._previewBar.style.background = hex;
    this._hexDisplay.textContent = hex.toUpperCase();
  }

  // --- Panel (appended to document.body) ---

  _createPanel() {
    // Inject spinner-hiding styles once into <head>
    if (!document.getElementById("tb-color-picker-styles")) {
      const style = document.createElement("style");
      style.id = "tb-color-picker-styles";
      style.textContent = `
        .tb-color-picker-panel input[type=number]::-webkit-outer-spin-button,
        .tb-color-picker-panel input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `;
      document.head.appendChild(style);
    }

    const panel = document.createElement("div");
    panel.className = "tb-color-picker-panel";
    panel.style.cssText = `
      position: fixed;
      width: 220px;
      background: rgba(30, 30, 28, 0.97);
      border: 1px solid #5a5a54;
      border-radius: 6px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.7);
      padding: 10px;
      z-index: 10000;
      font-family: 'Share Tech Mono', monospace;
      color: #e8e4d4;
    `;

    // Mode toggle
    const modeToggle = document.createElement("div");
    modeToggle.style.cssText = "display:flex;margin-bottom:8px;border:1px solid #4a4a44;border-radius:3px;overflow:hidden;";

    for (const mode of ["rgb", "hsv"]) {
      const btn = document.createElement("button");
      btn.textContent = mode.toUpperCase();
      btn.dataset.mode = mode;
      btn.style.cssText = `
        flex:1;padding:3px 0;border:none;font-family:'Share Tech Mono',monospace;
        font-size:0.65rem;letter-spacing:0.1em;cursor:pointer;text-align:center;
        background:${mode === this._mode ? "#4a4a44" : "#2a2a26"};
        color:${mode === this._mode ? "#ffaa20" : "#8a8a7a"};
      `;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._setMode(mode);
      });
      modeToggle.appendChild(btn);
    }
    panel.appendChild(modeToggle);
    this._modeToggle = modeToggle;

    // Sliders container
    const slidersEl = document.createElement("div");
    panel.appendChild(slidersEl);
    this._slidersEl = slidersEl;

    // Preview bar
    const previewBar = document.createElement("div");
    previewBar.style.cssText = "height:18px;border-radius:3px;border:1px solid #4a4a44;margin:8px 0 6px;";
    panel.appendChild(previewBar);
    this._previewBar = previewBar;

    // Hex display
    const hexDisplay = document.createElement("div");
    hexDisplay.style.cssText = "text-align:center;font-size:0.6rem;color:#8a8a7a;letter-spacing:0.1em;";
    panel.appendChild(hexDisplay);
    this._hexDisplay = hexDisplay;

    return panel;
  }

  _togglePanel() {
    this._open ? this._closePanel() : this._openPanel();
  }

  _openPanel() {
    if (!this._panel) {
      this._panel = this._createPanel();
      this._buildSliders();
    }
    document.body.appendChild(this._panel);
    this._positionPanel();
    this._open = true;
    this._syncSliders();
    this._syncPreview();
  }

  _closePanel() {
    if (this._panel && this._panel.parentNode) {
      this._panel.remove();
    }
    this._open = false;
  }

  _positionPanel() {
    const rect = this._housing.getBoundingClientRect();
    const panelHeight = 220; // approximate
    const panelWidth = 220;

    // Try above the swatch first
    let top = rect.top - panelHeight - 8;
    let left = rect.left + rect.width / 2 - panelWidth / 2;

    // If it would go above the viewport, place below instead
    if (top < 4) {
      top = rect.bottom + 8;
    }

    // Clamp horizontally
    left = Math.max(4, Math.min(window.innerWidth - panelWidth - 4, left));

    this._panel.style.left = left + "px";
    this._panel.style.top = top + "px";
  }

  // --- Mode ---

  _setMode(mode) {
    this._mode = mode;
    if (this._modeToggle) {
      for (const btn of this._modeToggle.children) {
        const isActive = btn.dataset.mode === mode;
        btn.style.background = isActive ? "#4a4a44" : "#2a2a26";
        btn.style.color = isActive ? "#ffaa20" : "#8a8a7a";
      }
    }
    this._buildSliders();
    this._syncSliders();
    this._syncPreview();
  }

  _emitColor() {
    const hex = TbColorPicker._rgbToHex(this._r, this._g, this._b);
    this.setAttribute("color", hex);
    this.dispatchEvent(new CustomEvent("color-pick", {
      bubbles: true,
      detail: { color: hex },
    }));
  }

  // --- Sliders ---

  _buildSliders() {
    if (!this._slidersEl) return;

    const channels = this._mode === "hsv"
      ? [
          { key: "h", label: "H", min: 0, max: 360 },
          { key: "s", label: "S", min: 0, max: 100 },
          { key: "v", label: "V", min: 0, max: 100 },
        ]
      : [
          { key: "r", label: "R", min: 0, max: 255 },
          { key: "g", label: "G", min: 0, max: 255 },
          { key: "b", label: "B", min: 0, max: 255 },
        ];

    this._slidersEl.innerHTML = "";
    this._sliderInputs = {};

    for (const ch of channels) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:5px;";

      const lbl = document.createElement("label");
      lbl.textContent = ch.label;
      lbl.style.cssText = "width:14px;font-size:0.6rem;color:#8a8a7a;text-align:right;flex-shrink:0;";

      const range = document.createElement("input");
      range.type = "range";
      range.min = ch.min;
      range.max = ch.max;
      range.step = 1;
      range.style.cssText = "flex:1;height:4px;-webkit-appearance:none;appearance:none;background:#3a3a36;border-radius:2px;outline:none;";

      const num = document.createElement("input");
      num.type = "number";
      num.min = ch.min;
      num.max = ch.max;
      num.step = 1;
      num.style.cssText = `
        width:44px;background:#2a2a26;border:1px solid #4a4a44;border-radius:2px;
        color:#e8e4d4;font-family:'Share Tech Mono',monospace;font-size:0.6rem;
        text-align:center;padding:2px;flex-shrink:0;
        -moz-appearance:textfield;
      `;

      this._sliderInputs[ch.key] = { range, num };

      const onInput = (e) => {
        e.stopPropagation();
        const val = parseInt(range.value);
        num.value = val;
        this._onChannelChange(ch.key, val);
      };

      const onNumInput = (e) => {
        e.stopPropagation();
        let val = parseInt(num.value);
        if (isNaN(val)) val = ch.min;
        val = Math.max(ch.min, Math.min(ch.max, val));
        range.value = val;
        this._onChannelChange(ch.key, val);
      };

      range.addEventListener("input", onInput);
      range.addEventListener("mouseup", () => this._emitColor());
      range.addEventListener("touchend", () => this._emitColor());
      num.addEventListener("input", onNumInput);
      num.addEventListener("change", () => this._emitColor());

      row.appendChild(lbl);
      row.appendChild(range);
      row.appendChild(num);
      this._slidersEl.appendChild(row);
    }
  }

  _onChannelChange(key, val) {
    if (this._mode === "hsv") {
      const [h, s, v] = TbColorPicker._rgbToHsv(this._r, this._g, this._b);
      let nh = h, ns = s, nv = v;
      if (key === "h") nh = val;
      if (key === "s") ns = val;
      if (key === "v") nv = val;
      [this._r, this._g, this._b] = TbColorPicker._hsvToRgb(nh, ns, nv);
    } else {
      if (key === "r") this._r = val;
      if (key === "g") this._g = val;
      if (key === "b") this._b = val;
    }
    this._syncDisc();
    this._syncPreview();
  }

  _syncSliders() {
    if (!this._sliderInputs) return;

    if (this._mode === "hsv") {
      const [h, s, v] = TbColorPicker._rgbToHsv(this._r, this._g, this._b);
      if (this._sliderInputs.h) {
        this._sliderInputs.h.range.value = h;
        this._sliderInputs.h.num.value = h;
      }
      if (this._sliderInputs.s) {
        this._sliderInputs.s.range.value = s;
        this._sliderInputs.s.num.value = s;
      }
      if (this._sliderInputs.v) {
        this._sliderInputs.v.range.value = v;
        this._sliderInputs.v.num.value = v;
      }
    } else {
      if (this._sliderInputs.r) {
        this._sliderInputs.r.range.value = this._r;
        this._sliderInputs.r.num.value = this._r;
      }
      if (this._sliderInputs.g) {
        this._sliderInputs.g.range.value = this._g;
        this._sliderInputs.g.num.value = this._g;
      }
      if (this._sliderInputs.b) {
        this._sliderInputs.b.range.value = this._b;
        this._sliderInputs.b.num.value = this._b;
      }
    }
  }
}

customElements.define("tb-color-picker", TbColorPicker);
