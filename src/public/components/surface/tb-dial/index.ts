import styles from './tb-dial.scss';
import { TbSurfaceComponent, type CircuitryPorts, type SizeConstraints } from '../tb-surface-component';

const sheet = new CSSStyleSheet();
sheet.replaceSync(styles);

/**
 * <tb-dial> — Sun/Moon dial surface component.
 *
 * A half-circle gauge showing day (sun) and night (moon) halves.
 * The disc rotates based on the 'on' attribute (on = day, off = night).
 *
 * Attributes:
 *   on     - Boolean, true = daytime (sun), false = nighttime (moon)
 *   size   - Width in px (default: 80); height is half the width
 */
class TbDial extends TbSurfaceComponent {
  static get observedAttributes(): string[] {
    return ["on", "size"];
  }

  static get circuitryPorts(): CircuitryPorts {
    return { inputs: ["signal"], outputs: [] };
  }

  static get sizeConstraints(): SizeConstraints {
    return { minW: 4, minH: 2, maxW: null, maxH: null };
  }

  private _frame: HTMLElement;
  private _disc: HTMLElement;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.adoptedStyleSheets = [sheet];
    this.shadowRoot!.innerHTML = `
      <div class="dial-frame">
        <div class="dial-disc">
          <div class="dial-half dial-day">
            <span class="dial-icon">\u2600</span>
          </div>
          <div class="dial-half dial-night">
            <span class="dial-icon">\u263D</span>
          </div>
        </div>
        <div class="dial-center"></div>
        <div class="dial-marker"></div>
      </div>
    `;

    this._frame = this.shadowRoot!.querySelector(".dial-frame") as HTMLElement;
    this._disc = this.shadowRoot!.querySelector(".dial-disc") as HTMLElement;
  }

  connectedCallback(): void { super.connectedCallback(); this._render(); }
  attributeChangedCallback(_name: string, _oldValue: string | null, _newValue: string | null): void { this._render(); }

  private _render(): void {
    const size: number = parseInt(this.getAttribute("size") as string) || 80;
    const halfH: number = size / 2;
    const isDay: boolean = this.hasAttribute("on");

    this._frame.style.width = size + "px";
    this._frame.style.height = halfH + "px";

    // Full circle disc, positioned so center is at bottom of frame
    this._disc.style.width = size + "px";
    this._disc.style.height = size + "px";
    this._disc.style.left = "0";
    this._disc.style.top = "0";

    const iconSize: number = Math.max(12, size * 0.25);
    for (const icon of this.shadowRoot!.querySelectorAll(".dial-icon")) {
      (icon as HTMLElement).style.fontSize = iconSize + "px";
    }

    // Rotate disc: 0deg = day on top, 180deg = night on top
    this._disc.style.transform = isDay ? "rotate(0deg)" : "rotate(180deg)";
  }
}

customElements.define("tb-dial", TbDial);
