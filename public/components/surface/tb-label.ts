/**
 * <tb-label> — Text label surface component.
 *
 * Attributes:
 *   text       - Label text content
 *   style-type - "dymo" (black bg, white text), "embossed" (raised text), "plain" (simple text)
 *   font-size  - CSS font-size (default: "0.65rem")
 *   align      - Text alignment: "left", "center", "right" (default: "center")
 *   color      - Text color override
 *
 * Scroll-on-hover: when text overflows the label width, hovering triggers a
 * smooth back-and-forth scroll animation revealing the full text.
 */
class TbLabel extends TbSurfaceComponent {
  static get observedAttributes(): string[] {
    return ["text", "style-type", "font-size", "align", "color", "overwrite-text"];
  }

  static get circuitryPorts(): CircuitryPorts {
    return { inputs: ["text"], outputs: [] };
  }

  static get sizeConstraints(): SizeConstraints {
    return { minW: 2, minH: 1, maxW: null, maxH: 1 };
  }

  static get overwritableProperties(): OverwritableProperty[] {
    return [
      { name: "text", overwriteAttr: "overwrite-text", label: "Text", type: "text" } as OverwritableProperty,
    ];
  }

  private _deviceText: string;
  private _label: HTMLElement;
  private _textInner: HTMLElement;

  constructor() {
    super();
    this._deviceText = "";
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: grid;
          place-items: center;
          width: 100%;
          height: 100%;
        }

        .label {
          box-sizing: border-box;
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          font-family: 'Share Tech Mono', monospace;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          overflow: hidden;
          white-space: nowrap;
        }

        .text-inner {
          display: inline-block;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          max-width: 100%;
        }

        .text-inner.scrolling {
          overflow: visible;
          text-overflow: clip;
          max-width: none;
          animation: label-scroll var(--scroll-duration, 2s) ease-in-out infinite alternate;
          animation-delay: 0.3s;
        }

        @keyframes label-scroll {
          0%, 15%   { transform: translateX(0); }
          85%, 100% { transform: translateX(var(--scroll-dist)); }
        }

        .label.dymo {
          background: #1a1a18;
          color: #e8e4d4;
          border-radius: 2px;
          border: 1px solid #333;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);
        }

        .label.embossed {
          color: rgba(255,255,255,0.7);
          text-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 -1px 0 rgba(255,255,255,0.1);
        }

        .label.plain {
          color: #e0ddd0;
        }
      </style>
      <div class="label"><span class="text-inner"></span></div>
    `;

    this._label = this.shadowRoot!.querySelector(".label") as HTMLElement;
    this._textInner = this.shadowRoot!.querySelector(".text-inner") as HTMLElement;

    this._onMouseEnter = this._onMouseEnter.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);
    this._label.addEventListener("mouseenter", this._onMouseEnter);
    this._label.addEventListener("mouseleave", this._onMouseLeave);
  }

  connectedCallback(): void { super.connectedCallback(); this._render(); }
  attributeChangedCallback(_name: string, _oldValue: string | null, _newValue: string | null): void { this._render(); }

  /** Text supplied by the connected in-game device (ephemeral, not persisted). */
  get deviceText(): string { return this._deviceText; }
  set deviceText(val: string) {
    this._deviceText = val || "";
    this._render();
  }

  private _onMouseEnter(): void {
    const overflowPx: number = this._textInner.scrollWidth - this._label.clientWidth;
    if (overflowPx <= 0) return;

    const duration: number = Math.max(1.5, overflowPx / 40);
    this._textInner.style.setProperty("--scroll-dist", `-${overflowPx}px`);
    this._textInner.style.setProperty("--scroll-duration", `${duration}s`);
    this._textInner.classList.add("scrolling");
  }

  private _onMouseLeave(): void {
    this._textInner.classList.remove("scrolling");
  }

  private _render(): void {
    const customText: string = this.getAttribute("text") || "";
    const overwrite: boolean = this.hasAttribute("overwrite-text");
    const deviceText: string = this._deviceText || "";
    const styleType: string = this.getAttribute("style-type") || "dymo";
    const fontSize: string = this.getAttribute("font-size") || "0.65rem";
    const align: string = this.getAttribute("align") || "center";
    const color: string | null = this.getAttribute("color");

    // Show custom text only when overwrite is ON and text is non-empty.
    // Otherwise fall back to the device-supplied text, then custom text.
    const displayText: string = (overwrite && customText)
      ? customText
      : (deviceText || customText);

    this._label.className = "label " + styleType;
    this._textInner.textContent = displayText;
    this._label.style.fontSize = fontSize;
    this._label.style.justifyItems = align === "left" ? "start" : align === "right" ? "end" : "center";
    if (color) this._label.style.color = color;
  }
}

customElements.define("tb-label", TbLabel);
