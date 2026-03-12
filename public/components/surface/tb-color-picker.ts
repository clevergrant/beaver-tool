/**
 * <tb-color-picker> — Color picker surface component.
 *
 * A 2x2 industrial color swatch. Click to open a popup panel with
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
  static get observedAttributes(): string[] {
    return ["color", "label"];
  }

  static get circuitryPorts(): CircuitryPorts {
    return { inputs: [], outputs: ["color"] };
  }

  static get sizeConstraints(): SizeConstraints {
    return { minW: 2, minH: 2, maxW: 2, maxH: 2 };
  }

  // --- HSV / RGB conversion ---

  static _hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    s /= 100; v /= 100;
    const c: number = v * s;
    const x: number = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m: number = v - c;
    let r: number, g: number, b: number;
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

  static _rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max: number = Math.max(r, g, b);
    const min: number = Math.min(r, g, b);
    const d: number = max - min;
    let h: number = 0;
    if (d !== 0) {
      if (max === r)      h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else                h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    const s: number = max === 0 ? 0 : (d / max) * 100;
    const v: number = max * 100;
    return [Math.round(h), Math.round(s), Math.round(v)];
  }

  static _hexToRgb(hex: string): [number, number, number] {
    hex = hex.replace("#", "");
    return [
      parseInt(hex.substring(0, 2), 16) || 0,
      parseInt(hex.substring(2, 4), 16) || 0,
      parseInt(hex.substring(4, 6), 16) || 0,
    ];
  }

  static _rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number): string => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
    return "#" + toHex(r) + toHex(g) + toHex(b);
  }

  private _open: boolean;
  private _mode: "rgb" | "hsv";
  private _r: number;
  private _g: number;
  private _b: number;
  private _panel: HTMLElement | null;
  private _disc: HTMLElement;
  private _labelEl: HTMLElement;
  private _housing: HTMLElement;
  private _outsideHandler: (e: MouseEvent) => void;
  private _sliderInputs: Record<string, { range: HTMLInputElement; num: HTMLInputElement }>;
  private _slidersEl: HTMLElement | null;
  private _modeToggle: HTMLElement | null;
  private _previewBar: HTMLElement | null;
  private _hexDisplay: HTMLElement | null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._open = false;
    this._mode = "rgb";
    // Internal color state (RGB)
    this._r = 255; this._g = 170; this._b = 32;
    this._panel = null; // created on first open, appended to body
    this._sliderInputs = {};
    this._slidersEl = null;
    this._modeToggle = null;
    this._previewBar = null;
    this._hexDisplay = null;

    this.shadowRoot!.innerHTML = `
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

    this._disc = this.shadowRoot!.querySelector(".swatch-disc") as HTMLElement;
    this._labelEl = this.shadowRoot!.querySelector(".picker-label") as HTMLElement;
    this._housing = this.shadowRoot!.querySelector(".swatch-housing") as HTMLElement;

    // Housing click toggles popup
    this._housing.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      this._togglePanel();
    });

    // Close on outside click
    this._outsideHandler = (e: MouseEvent) => {
      if (this._open && this._panel && !this._panel.contains(e.target as Node) && !this.shadowRoot!.contains(e.target as Node)) {
        this._closePanel();
      }
    };

    this._syncDisc();
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("click", this._outsideHandler);
    this._render();
  }

  /**
   * Called when attached to a parent component's surface grid.
   * Loads persisted color and auto-sends it to the game.
   */
  _onAttachedToSurface(parentComponent: SurfaceParent): void {
    super._onAttachedToSurface(parentComponent);
    // Fire color-pick on next microtask so circuitry wiring is ready
    queueMicrotask(() => this._emitColor());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("click", this._outsideHandler);
    this._closePanel();
  }

  attributeChangedCallback(_name: string, _oldValue: string | null, _newValue: string | null): void {
    const hex: string | null = this.getAttribute("color");
    if (hex) {
      const [r, g, b] = TbColorPicker._hexToRgb(hex);
      this._r = r; this._g = g; this._b = b;
    }
    this._render();
  }

  private _render(): void {
    const label: string = this.getAttribute("label") || "";
    this._labelEl.textContent = label;
    this._labelEl.style.display = label ? "" : "none";
    this._syncDisc();
    if (this._open) {
      this._syncSliders();
      this._syncPreview();
    }
  }

  private _syncDisc(): void {
    const hex: string = TbColorPicker._rgbToHex(this._r, this._g, this._b);
    this._disc.style.background = hex;
  }

  private _syncPreview(): void {
    if (!this._previewBar) return;
    const hex: string = TbColorPicker._rgbToHex(this._r, this._g, this._b);
    this._previewBar.style.background = hex;
    this._hexDisplay!.textContent = hex.toUpperCase();
  }

  // --- Panel (appended to document.body) ---

  private _createPanel(): HTMLElement {
    // Inject spinner-hiding styles once into <head>
    if (!document.getElementById("tb-color-picker-styles")) {
      const style: HTMLStyleElement = document.createElement("style");
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

    const panel: HTMLElement = document.createElement("div");
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
    const modeToggle: HTMLElement = document.createElement("div");
    modeToggle.style.cssText = "display:flex;margin-bottom:8px;border:1px solid #4a4a44;border-radius:3px;overflow:hidden;";

    for (const mode of ["rgb", "hsv"] as const) {
      const btn: HTMLButtonElement = document.createElement("button");
      btn.textContent = mode.toUpperCase();
      btn.dataset.mode = mode;
      btn.style.cssText = `
        flex:1;padding:3px 0;border:none;font-family:'Share Tech Mono',monospace;
        font-size:0.65rem;letter-spacing:0.1em;cursor:pointer;text-align:center;
        background:${mode === this._mode ? "#4a4a44" : "#2a2a26"};
        color:${mode === this._mode ? "#ffaa20" : "#8a8a7a"};
      `;
      btn.addEventListener("click", (e: MouseEvent) => {
        e.stopPropagation();
        this._setMode(mode);
      });
      modeToggle.appendChild(btn);
    }
    panel.appendChild(modeToggle);
    this._modeToggle = modeToggle;

    // Sliders container
    const slidersEl: HTMLElement = document.createElement("div");
    panel.appendChild(slidersEl);
    this._slidersEl = slidersEl;

    // Preview bar
    const previewBar: HTMLElement = document.createElement("div");
    previewBar.style.cssText = "height:18px;border-radius:3px;border:1px solid #4a4a44;margin:8px 0 6px;";
    panel.appendChild(previewBar);
    this._previewBar = previewBar;

    // Hex display
    const hexDisplay: HTMLElement = document.createElement("div");
    hexDisplay.style.cssText = "text-align:center;font-size:0.6rem;color:#8a8a7a;letter-spacing:0.1em;";
    panel.appendChild(hexDisplay);
    this._hexDisplay = hexDisplay;

    return panel;
  }

  private _togglePanel(): void {
    this._open ? this._closePanel() : this._openPanel();
  }

  private _openPanel(): void {
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

  private _closePanel(): void {
    if (this._panel && this._panel.parentNode) {
      this._panel.remove();
    }
    this._open = false;
  }

  private _positionPanel(): void {
    const rect: DOMRect = this._housing.getBoundingClientRect();
    const panelHeight: number = 220; // approximate
    const panelWidth: number = 220;

    // Try above the swatch first
    let top: number = rect.top - panelHeight - 8;
    let left: number = rect.left + rect.width / 2 - panelWidth / 2;

    // If it would go above the viewport, place below instead
    if (top < 4) {
      top = rect.bottom + 8;
    }

    // Clamp horizontally
    left = Math.max(4, Math.min(window.innerWidth - panelWidth - 4, left));

    this._panel!.style.left = left + "px";
    this._panel!.style.top = top + "px";
  }

  // --- Mode ---

  private _setMode(mode: "rgb" | "hsv"): void {
    this._mode = mode;
    if (this._modeToggle) {
      for (const btn of Array.from(this._modeToggle.children) as HTMLElement[]) {
        const isActive: boolean = btn.dataset.mode === mode;
        btn.style.background = isActive ? "#4a4a44" : "#2a2a26";
        btn.style.color = isActive ? "#ffaa20" : "#8a8a7a";
      }
    }
    this._buildSliders();
    this._syncSliders();
    this._syncPreview();
  }

  private _emitColor(): void {
    const hex: string = TbColorPicker._rgbToHex(this._r, this._g, this._b);
    this.setAttribute("color", hex);
    this.dispatchEvent(new CustomEvent<{ color: string }>("color-pick", {
      bubbles: true,
      detail: { color: hex },
    }));
  }

  // --- Sliders ---

  private _buildSliders(): void {
    if (!this._slidersEl) return;

    interface ChannelDef {
      key: string;
      label: string;
      min: number;
      max: number;
    }

    const channels: ChannelDef[] = this._mode === "hsv"
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
      const row: HTMLElement = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:5px;";

      const lbl: HTMLLabelElement = document.createElement("label");
      lbl.textContent = ch.label;
      lbl.style.cssText = "width:14px;font-size:0.6rem;color:#8a8a7a;text-align:right;flex-shrink:0;";

      const range: HTMLInputElement = document.createElement("input");
      range.type = "range";
      range.min = String(ch.min);
      range.max = String(ch.max);
      range.step = "1";
      range.style.cssText = "flex:1;height:4px;-webkit-appearance:none;appearance:none;background:#3a3a36;border-radius:2px;outline:none;";

      const num: HTMLInputElement = document.createElement("input");
      num.type = "number";
      num.min = String(ch.min);
      num.max = String(ch.max);
      num.step = "1";
      num.style.cssText = `
        width:44px;background:#2a2a26;border:1px solid #4a4a44;border-radius:2px;
        color:#e8e4d4;font-family:'Share Tech Mono',monospace;font-size:0.6rem;
        text-align:center;padding:2px;flex-shrink:0;
        -moz-appearance:textfield;
      `;

      this._sliderInputs[ch.key] = { range, num };

      const onInput = (e: Event): void => {
        e.stopPropagation();
        const val: number = parseInt(range.value);
        num.value = String(val);
        this._onChannelChange(ch.key, val);
      };

      const onNumInput = (e: Event): void => {
        e.stopPropagation();
        let val: number = parseInt(num.value);
        if (isNaN(val)) val = ch.min;
        val = Math.max(ch.min, Math.min(ch.max, val));
        range.value = String(val);
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

  private _onChannelChange(key: string, val: number): void {
    if (this._mode === "hsv") {
      const [h, s, v] = TbColorPicker._rgbToHsv(this._r, this._g, this._b);
      let nh: number = h, ns: number = s, nv: number = v;
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

  private _syncSliders(): void {
    if (!this._sliderInputs) return;

    if (this._mode === "hsv") {
      const [h, s, v] = TbColorPicker._rgbToHsv(this._r, this._g, this._b);
      if (this._sliderInputs.h) {
        this._sliderInputs.h.range.value = String(h);
        this._sliderInputs.h.num.value = String(h);
      }
      if (this._sliderInputs.s) {
        this._sliderInputs.s.range.value = String(s);
        this._sliderInputs.s.num.value = String(s);
      }
      if (this._sliderInputs.v) {
        this._sliderInputs.v.range.value = String(v);
        this._sliderInputs.v.num.value = String(v);
      }
    } else {
      if (this._sliderInputs.r) {
        this._sliderInputs.r.range.value = String(this._r);
        this._sliderInputs.r.num.value = String(this._r);
      }
      if (this._sliderInputs.g) {
        this._sliderInputs.g.range.value = String(this._g);
        this._sliderInputs.g.num.value = String(this._g);
      }
      if (this._sliderInputs.b) {
        this._sliderInputs.b.range.value = String(this._b);
        this._sliderInputs.b.num.value = String(this._b);
      }
    }
  }
}

customElements.define("tb-color-picker", TbColorPicker);
