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
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: grid;
          place-items: center;
        }

        .dial-frame {
          position: relative;
          border-radius: 999px 999px 0 0;
          background: #3a3830;
          box-shadow:
            inset 0 2px 8px rgba(0,0,0,0.7),
            inset 0 1px 2px rgba(0,0,0,0.5),
            0 1px 0 rgba(255,255,255,0.08);
          overflow: hidden;
        }

        .dial-disc {
          position: absolute;
          border-radius: 50%;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .dial-half {
          position: absolute;
          width: 100%;
          height: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2em;
        }

        .dial-day {
          top: 0;
          background: linear-gradient(180deg, #87ceeb 0%, #4a90d9 100%);
          border-radius: 50% 50% 0 0;
        }

        .dial-night {
          bottom: 0;
          background: linear-gradient(0deg, #2a3050 0%, #4a5080 100%);
          border-radius: 0 0 50% 50%;
        }

        .dial-icon {
          font-size: inherit;
          line-height: 1;
        }

        .dial-day .dial-icon {
          color: #f5c518;
        }

        .dial-center {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translate(-50%, 50%);
          width: 12%;
          height: 0;
          padding-bottom: 12%;
          border-radius: 50%;
          background: radial-gradient(circle, #aaa89e, #6a6860);
          box-shadow:
            inset 0 1px 2px rgba(0,0,0,0.4),
            0 -1px 0 rgba(255,255,255,0.1);
          z-index: 2;
        }

        .dial-marker {
          position: absolute;
          top: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 6px solid #ff3030;
          z-index: 3;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
        }
      </style>

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
