import styles from './tb-color-selector.scss';

const sheet = new CSSStyleSheet();
sheet.replaceSync(styles);

/**
 * <tb-color-selector> — FAB color picker for component base color.
 *
 * Renders as a small colored circle (FAB). Click to expand a radial
 * swatch palette. Fires 'color-change' event with { color: "#rrggbb" }.
 *
 * Attributes:
 *   color - Current selected color
 */
class TbColorSelector extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["color"];
  }

  private _expanded: boolean;
  private _presets: string[];
  private _fab: HTMLElement;
  private _palette: HTMLElement;
  private _swatchesEl: HTMLElement;
  private _colorInput: HTMLInputElement;
  private _outsideHandler: (e: MouseEvent) => void;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._expanded = false;

    this._presets = [
      "#ff4c2e", // red
      "#fe792e", // orange
      "#fdd42c", // yellow
      "#bad015", // lime
      "#64b53c", // green
      "#89d6e8", // blue
      "#3f5d93", // indigo
      "#ff63a8", // violet
      "#151f21", // black
      "#5b3314", // brown
      "#f2f1dd", // beige
      "#feffef", // white
    ];

    this.shadowRoot!.adoptedStyleSheets = [sheet];
    this.shadowRoot!.innerHTML = `
      <div class="palette">
        <div class="swatches"></div>
        <div class="custom-wrap">
          <input type="color" title="Custom color">
        </div>
      </div>
      <div class="fab"></div>
    `;

    this._fab = this.shadowRoot!.querySelector(".fab") as HTMLElement;
    this._palette = this.shadowRoot!.querySelector(".palette") as HTMLElement;
    this._swatchesEl = this.shadowRoot!.querySelector(".swatches") as HTMLElement;
    this._colorInput = this.shadowRoot!.querySelector('input[type="color"]') as HTMLInputElement;

    this._swatchesEl.style.display = "contents";

    this._fab.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      this._toggle();
    });

    this._colorInput.addEventListener("input", (e: Event) => {
      this._selectColor((e.target as HTMLInputElement).value);
    });

    // Close when clicking outside
    this._outsideHandler = (e: MouseEvent) => {
      if (this._expanded && !this.shadowRoot!.contains(e.target as Node)) {
        this._collapse();
      }
    };

    this._renderSwatches();
  }

  connectedCallback(): void {
    document.addEventListener("click", this._outsideHandler);
  }

  disconnectedCallback(): void {
    document.removeEventListener("click", this._outsideHandler);
  }

  attributeChangedCallback(_name: string, _oldValue: string | null, _newValue: string | null): void {
    const color: string = this.getAttribute("color") || "#d4cdb8";
    this._fab.style.background = color;
    this._colorInput.value = color;
    this._renderSwatches();
  }

  private _toggle(): void {
    this._expanded ? this._collapse() : this._expand();
  }

  private _expand(): void {
    this._expanded = true;
    this._fab.classList.add("open");
    this._palette.classList.add("open");
  }

  private _collapse(): void {
    this._expanded = false;
    this._fab.classList.remove("open");
    this._palette.classList.remove("open");
  }

  private _selectColor(color: string): void {
    this.setAttribute("color", color);
    this._renderSwatches();
    this.dispatchEvent(new CustomEvent<{ color: string }>("color-change", {
      bubbles: true,
      detail: { color },
    }));
    this._collapse();
  }

  private _renderSwatches(): void {
    const current: string = (this.getAttribute("color") || "#d4cdb8").toLowerCase();
    this._fab.style.background = current;

    this._swatchesEl.innerHTML = "";
    for (const color of this._presets) {
      const swatch: HTMLDivElement = document.createElement("div");
      swatch.className = "swatch";
      swatch.style.background = color;
      if (color.toLowerCase() === current) {
        swatch.classList.add("selected");
      }
      swatch.addEventListener("click", (e: MouseEvent) => {
        e.stopPropagation();
        this._selectColor(color);
      });
      this._swatchesEl.appendChild(swatch);
    }
  }
}

customElements.define("tb-color-selector", TbColorSelector);
