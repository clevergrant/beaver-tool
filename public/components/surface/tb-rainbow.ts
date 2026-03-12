/**
 * <tb-rainbow> — Rainbow button surface component.
 *
 * A toggle button that, when ON, cycles through 8 preset colors and
 * emits 'color-pick' events at a configurable interval. Wire it to a
 * lever in the circuitry editor to send rainbow colors to the game.
 *
 * Attributes:
 *   on       - Boolean, current toggle state
 *   label    - Optional display label
 *   fps      - Frames (color changes) per second (default: 2)
 */
class TbRainbow extends TbSurfaceComponent {
  static COLORS: string[] = [
    "#ff4c2e",
    "#fe792e",
    "#fdd42c",
    "#bad015",
    "#64b53c",
    "#89d6e8",
    "#3f5d93",
    "#ff63a8",
  ];

  static get observedAttributes(): string[] {
    return ["on", "label", "fps"];
  }

  static get circuitryPorts(): CircuitryPorts {
    return { inputs: [], outputs: ["color"] };
  }

  static get sizeConstraints(): SizeConstraints {
    return { minW: 2, minH: 2, maxW: 2, maxH: 2 };
  }

  private _colorIndex: number;
  private _timer: ReturnType<typeof setInterval> | null;
  private _disc: HTMLElement;
  private _labelEl: HTMLElement;

  constructor() {
    super();
    this._colorIndex = 0;
    this._timer = null;

    this.attachShadow({ mode: "open" });
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          position: relative;
          cursor: pointer;
          user-select: none;
        }

        .housing {
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

        :host(:hover) .housing {
          border-color: #888;
        }

        .rainbow-ring {
          position: absolute;
          inset: 3px;
          border-radius: 50%;
          background: conic-gradient(
            #ff4c2e 0deg,
            #fe792e 45deg,
            #fdd42c 90deg,
            #bad015 135deg,
            #64b53c 180deg,
            #89d6e8 225deg,
            #3f5d93 270deg,
            #ff63a8 315deg,
            #ff4c2e 360deg
          );
          opacity: 0.25;
          transition: opacity 0.3s;
        }

        :host([on]) .rainbow-ring {
          opacity: 1;
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .disc {
          position: absolute;
          inset: 18%;
          border-radius: 50%;
          background: #2a2a28;
          border: 1px solid rgba(255,255,255,0.06);
          transition: background 0.15s, box-shadow 0.3s;
        }

        :host([on]) .disc {
          box-shadow: 0 0 8px var(--current-color, #ff4c2e);
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

        .rainbow-label {
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

      <div class="housing">
        <span class="bolt bolt-tl"></span>
        <span class="bolt bolt-tr"></span>
        <span class="bolt bolt-bl"></span>
        <span class="bolt bolt-br"></span>
        <div class="rainbow-ring"></div>
        <div class="disc"></div>
      </div>
      <span class="rainbow-label"></span>
    `;

    this._disc = this.shadowRoot!.querySelector(".disc") as HTMLElement;
    this._labelEl = this.shadowRoot!.querySelector(".rainbow-label") as HTMLElement;

    this.addEventListener("click", () => {
      const isOn: boolean = this.hasAttribute("on");
      if (isOn) this.removeAttribute("on");
      else this.setAttribute("on", "");
    });
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._render();
    if (this.hasAttribute("on")) this._startCycling();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopCycling();
  }

  attributeChangedCallback(name: string, _oldValue: string | null, _newValue: string | null): void {
    if (name === "on") {
      if (this.hasAttribute("on")) {
        this._startCycling();
      } else {
        this._stopCycling();
      }
    }
    if (name === "fps" && this._timer) {
      this._stopCycling();
      this._startCycling();
    }
    this._render();
  }

  get fps(): number {
    const val: number = parseFloat(this.getAttribute("fps") as string);
    return val > 0 ? val : 2;
  }
  set fps(val: number) {
    this.setAttribute("fps", String(val));
  }

  private _startCycling(): void {
    if (this._timer) return;
    const ms: number = 1000 / this.fps;
    this._tick();
    this._timer = setInterval(() => this._tick(), ms);
  }

  private _stopCycling(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  private _tick(): void {
    const color: string = TbRainbow.COLORS[this._colorIndex]!;
    this._colorIndex = (this._colorIndex + 1) % TbRainbow.COLORS.length;

    this._disc.style.background = color;
    this.style.setProperty("--current-color", color);

    this.dispatchEvent(new CustomEvent<{ color: string }>("color-pick", {
      bubbles: true,
      detail: { color },
    }));
  }

  private _render(): void {
    const label: string = this.getAttribute("label") || "";
    this._labelEl.textContent = label;
    this._labelEl.style.display = label ? "" : "none";

    if (!this.hasAttribute("on")) {
      this._disc.style.background = "#2a2a28";
      this.style.removeProperty("--current-color");
    }
  }
}

customElements.define("tb-rainbow", TbRainbow);
