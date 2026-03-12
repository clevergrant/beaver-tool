import styles from './tb-toggle.scss';
import { TbSurfaceComponent, type CircuitryPorts, type SizeConstraints } from '../tb-surface-component';

const sheet = new CSSStyleSheet();
sheet.replaceSync(styles);

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
  static get observedAttributes(): string[] {
    return ["on", "name", "label", "orientation", "switch-style", "size"];
  }

  static get circuitryPorts(): CircuitryPorts {
    return { inputs: [], outputs: ["state"] };
  }

  static get sizeConstraints(): SizeConstraints & { defaultW: number; defaultH: number } {
    return { minW: 1, minH: 2, maxW: null, maxH: null, defaultW: 2, defaultH: 3 };
  }

  private _housing: HTMLElement;
  private _handle: HTMLElement;
  private _pbRing: HTMLElement;
  private _pbFace: HTMLElement;
  private _labelEl: HTMLElement;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.adoptedStyleSheets = [sheet];
    this.shadowRoot!.innerHTML = `
      <div class="switch-housing">
        <div class="switch-plate"></div>
        <div class="switch-handle"></div>
      </div>
      <div class="pushbutton">
        <div class="pb-bezel"></div>
        <div class="pb-ring"></div>
        <div class="pb-face"><div class="pb-pip"></div></div>
      </div>
      <span class="switch-label"></span>
    `;

    this._housing = this.shadowRoot!.querySelector(".switch-housing") as HTMLElement;
    this._handle = this.shadowRoot!.querySelector(".switch-handle") as HTMLElement;
    this._pbRing = this.shadowRoot!.querySelector(".pb-ring") as HTMLElement;
    this._pbFace = this.shadowRoot!.querySelector(".pb-face") as HTMLElement;
    this._labelEl = this.shadowRoot!.querySelector(".switch-label") as HTMLElement;

    this.addEventListener("click", () => {
      const isOn: boolean = this.hasAttribute("on");
      if (isOn) this.removeAttribute("on");
      else this.setAttribute("on", "");

      this.dispatchEvent(new CustomEvent<{ name: string; on: boolean }>("toggle-change", {
        bubbles: true,
        detail: { name: this.getAttribute("name") || "", on: !isOn },
      }));
    });
  }

  connectedCallback(): void { super.connectedCallback(); this._render(); }
  attributeChangedCallback(_name: string, _oldValue: string | null, _newValue: string | null): void { this._render(); }

  private _render(): void {
    const isOn: boolean = this.hasAttribute("on");
    const label: string = this.getAttribute("label") || "";

    const state: string = isOn ? "on" : "off";
    this._housing.className = "switch-housing " + state;
    this._handle.className = "switch-handle " + state;
    this._pbRing.className = "pb-ring " + state;
    this._pbFace.className = "pb-face " + state;
    this._labelEl.textContent = label;
    this._labelEl.style.display = label ? "" : "none";
  }
}

customElements.define("tb-toggle", TbToggle);
