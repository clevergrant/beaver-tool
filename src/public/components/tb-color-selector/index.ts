import styles from './tb-color-selector.scss';
import { PALETTES, getPalette } from '../../js/palettes';
import { loadSettings, saveSettings } from '../../js/settings';

const sheet = new CSSStyleSheet();
sheet.replaceSync(styles);

const HARMONY_LABELS: [number, string][] = [
  [0, "Complementary"],
  [17, "Split-compl."],
  [33, "Triadic"],
  [50, "Monochromatic"],
  [67, "Triadic"],
  [83, "Split-compl."],
  [100, "Complementary"],
];

function harmonyLabel(value: number): string {
  let closest = HARMONY_LABELS[0]!;
  let minDist = Infinity;
  for (const entry of HARMONY_LABELS) {
    const dist = Math.abs(value - entry[0]);
    if (dist < minDist) { minDist = dist; closest = entry; }
  }
  return minDist <= 5 ? closest[1] : "Custom";
}

/**
 * <tb-color-selector> — FAB color picker for component base color.
 *
 * Renders as a small colored circle (FAB). Click to expand a palette popup
 * with decade-themed palette tabs, color swatches, custom color input,
 * and a hue offset slider for accent color harmony control.
 *
 * Fires:
 *   'color-change'      { color: "#rrggbb" }
 *   'palette-change'    { paletteId: string }
 *   'hue-offset-change' { offset: number }
 *
 * Attributes:
 *   color - Current selected color
 */
class TbColorSelector extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["color"];
  }

  private _expanded: boolean;
  private _activePaletteId: string;
  private _fab: HTMLElement;
  private _palette: HTMLElement;
  private _tabsEl: HTMLElement;
  private _swatchesEl: HTMLElement;
  private _colorInput: HTMLInputElement;
  private _hueSlider: HTMLInputElement;
  private _harmonyLabel: HTMLElement;
  private _outsideHandler: (e: MouseEvent) => void;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._expanded = false;

    const settings = loadSettings();
    this._activePaletteId = settings.paletteId;

    this.shadowRoot!.adoptedStyleSheets = [sheet];
    this.shadowRoot!.innerHTML = `
      <div class="palette">
        <div class="palette-tabs"></div>
        <div class="swatches"></div>
        <div class="custom-wrap">
          <input type="color" title="Custom color">
        </div>
        <div class="hue-slider-wrap">
          <label class="hue-label">Accent hue</label>
          <input type="range" min="0" max="100" value="${settings.hueOffset}" class="hue-slider">
          <span class="harmony-label">${harmonyLabel(settings.hueOffset)}</span>
        </div>
      </div>
      <div class="fab"></div>
    `;

    this._fab = this.shadowRoot!.querySelector(".fab") as HTMLElement;
    this._palette = this.shadowRoot!.querySelector(".palette") as HTMLElement;
    this._tabsEl = this.shadowRoot!.querySelector(".palette-tabs") as HTMLElement;
    this._swatchesEl = this.shadowRoot!.querySelector(".swatches") as HTMLElement;
    this._colorInput = this.shadowRoot!.querySelector('input[type="color"]') as HTMLInputElement;
    this._hueSlider = this.shadowRoot!.querySelector(".hue-slider") as HTMLInputElement;
    this._harmonyLabel = this.shadowRoot!.querySelector(".harmony-label") as HTMLElement;

    this._fab.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      this._toggle();
    });

    this._colorInput.addEventListener("input", (e: Event) => {
      this._selectColor((e.target as HTMLInputElement).value);
    });

    this._hueSlider.addEventListener("input", () => {
      const offset = parseInt(this._hueSlider.value, 10);
      this._harmonyLabel.textContent = harmonyLabel(offset);
      const settings = loadSettings();
      settings.hueOffset = offset;
      saveSettings(settings);
      this.dispatchEvent(new CustomEvent("hue-offset-change", {
        bubbles: true,
        detail: { offset },
      }));
    });

    // Close when clicking outside
    this._outsideHandler = (e: MouseEvent) => {
      if (this._expanded && !this.shadowRoot!.contains(e.target as Node)) {
        this._collapse();
      }
    };

    this._renderTabs();
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

  private _selectPalette(id: string): void {
    this._activePaletteId = id;
    const settings = loadSettings();
    settings.paletteId = id;
    saveSettings(settings);
    this._renderTabs();
    this._renderSwatches();
    this.dispatchEvent(new CustomEvent("palette-change", {
      bubbles: true,
      detail: { paletteId: id },
    }));
  }

  private _renderTabs(): void {
    this._tabsEl.innerHTML = "";
    for (const palette of PALETTES) {
      const tab = document.createElement("button");
      tab.className = "palette-tab";
      tab.textContent = palette.name;
      if (palette.id === this._activePaletteId) {
        tab.classList.add("active");
      }
      tab.addEventListener("click", (e: MouseEvent) => {
        e.stopPropagation();
        this._selectPalette(palette.id);
      });
      this._tabsEl.appendChild(tab);
    }
  }

  private _renderSwatches(): void {
    const current: string = (this.getAttribute("color") || "#d4cdb8").toLowerCase();
    this._fab.style.background = current;

    const palette = getPalette(this._activePaletteId);
    this._swatchesEl.innerHTML = "";
    for (const color of palette.colors) {
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
