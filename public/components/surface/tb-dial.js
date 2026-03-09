/**
 * <tb-dial> — Sun/Moon dial surface component.
 *
 * A rotating disc showing day (sun) and night (moon) halves.
 * The disc rotates based on the 'on' attribute (on = day, off = night).
 *
 * Attributes:
 *   on     - Boolean, true = daytime (sun), false = nighttime (moon)
 *   size   - Diameter in px (default: 80)
 */
class TbDial extends TbSurfaceComponent {
  static get observedAttributes() {
    return ["on", "size"];
  }

  static get circuitryPorts() {
    return { inputs: ["signal"], outputs: [] };
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
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dial-frame {
          position: relative;
          border-radius: 50%;
          background: #4a4840;
          box-shadow:
            0 2px 8px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.1);
          overflow: hidden;
        }

        .dial-disc {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
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
          background: linear-gradient(180deg, #ffd080 0%, #ffaa40 100%);
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

        .dial-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 12%;
          height: 12%;
          border-radius: 50%;
          background: radial-gradient(circle, #aaa89e, #6a6860);
          box-shadow: 0 1px 3px rgba(0,0,0,0.5);
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
          border-top: 6px solid #ffaa20;
          z-index: 3;
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

    this._frame = this.shadowRoot.querySelector(".dial-frame");
    this._disc = this.shadowRoot.querySelector(".dial-disc");
  }

  connectedCallback() { super.connectedCallback(); this._render(); }
  attributeChangedCallback() { this._render(); }

  get on() { return this.hasAttribute("on"); }
  set on(val) {
    if (val) this.setAttribute("on", "");
    else this.removeAttribute("on");
  }

  _render() {
    const size = parseInt(this.getAttribute("size")) || 80;
    const isDay = this.hasAttribute("on");

    this._frame.style.width = size + "px";
    this._frame.style.height = size + "px";

    const iconSize = Math.max(12, size * 0.25);
    for (const icon of this.shadowRoot.querySelectorAll(".dial-icon")) {
      icon.style.fontSize = iconSize + "px";
    }

    // Rotate disc: 0deg = day on top, 180deg = night on top
    this._disc.style.transform = isDay ? "rotate(0deg)" : "rotate(180deg)";
  }
}

customElements.define("tb-dial", TbDial);
