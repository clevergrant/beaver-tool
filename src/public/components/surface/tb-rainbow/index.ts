import styles from './tb-rainbow.scss';
import { TbSurfaceComponent, type CircuitryPorts, type SizeConstraints } from '../tb-surface-component';

const sheet = new CSSStyleSheet();
sheet.replaceSync(styles);

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
    this.shadowRoot!.adoptedStyleSheets = [sheet];
    this.shadowRoot!.innerHTML = `
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
