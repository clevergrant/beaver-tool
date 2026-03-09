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
  static get observedAttributes() {
    return ["color"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._expanded = false;

    this._presets = [
      "#d4cdb8", // tan (default)
      "#b8c4d4", // steel blue
      "#c8d4b8", // sage green
      "#d4b8b8", // dusty rose
      "#d4d0b8", // warm cream
      "#b8b8d4", // lavender
      "#d4c4b0", // sand
      "#a8b8a8", // muted green
    ];

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
        }

        .fab {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.25);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          position: relative;
          z-index: 2;
        }

        .fab:hover {
          transform: scale(1.1);
          border-color: rgba(255,255,255,0.5);
          box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }

        .fab.open {
          border-color: #fff;
          box-shadow: 0 0 12px rgba(255,255,255,0.3);
        }

        .palette {
          position: absolute;
          bottom: 44px;
          right: 0;
          transform: scale(0.5);
          transform-origin: bottom right;
          opacity: 0;
          pointer-events: none;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: center;
          width: 120px;
          padding: 8px;
          background: rgba(30, 30, 28, 0.95);
          border: 1px solid #5a5a54;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6);
          transition: opacity 0.2s, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 1;
        }

        .palette.open {
          opacity: 1;
          transform: scale(1);
          pointer-events: auto;
        }

        .swatch {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.15);
          cursor: pointer;
          transition: transform 0.15s, border-color 0.15s;
          flex-shrink: 0;
        }

        .swatch:hover {
          transform: scale(1.15);
          border-color: rgba(255,255,255,0.5);
        }

        .swatch.selected {
          border-color: #fff;
          box-shadow: 0 0 6px rgba(255,255,255,0.4);
        }

        .custom-wrap {
          width: 22px;
          height: 22px;
          flex-shrink: 0;
        }

        .custom-wrap input[type="color"] {
          width: 22px;
          height: 22px;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          background: none;
          padding: 0;
        }

        .custom-wrap input[type="color"]::-webkit-color-swatch-wrapper {
          padding: 0;
        }

        .custom-wrap input[type="color"]::-webkit-color-swatch {
          border: 2px solid rgba(255,255,255,0.15);
          border-radius: 50%;
        }
      </style>

      <div class="palette">
        <div class="swatches"></div>
        <div class="custom-wrap">
          <input type="color" title="Custom color">
        </div>
      </div>
      <div class="fab"></div>
    `;

    this._fab = this.shadowRoot.querySelector(".fab");
    this._palette = this.shadowRoot.querySelector(".palette");
    this._swatchesEl = this.shadowRoot.querySelector(".swatches");
    this._colorInput = this.shadowRoot.querySelector('input[type="color"]');

    this._swatchesEl.style.display = "contents";

    this._fab.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggle();
    });

    this._colorInput.addEventListener("input", (e) => {
      this._selectColor(e.target.value);
    });

    // Close when clicking outside
    this._outsideHandler = (e) => {
      if (this._expanded && !this.shadowRoot.contains(e.target)) {
        this._collapse();
      }
    };

    this._renderSwatches();
  }

  connectedCallback() {
    document.addEventListener("click", this._outsideHandler);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._outsideHandler);
  }

  attributeChangedCallback() {
    const color = this.getAttribute("color") || "#d4cdb8";
    this._fab.style.background = color;
    this._colorInput.value = color;
    this._renderSwatches();
  }

  _toggle() {
    this._expanded ? this._collapse() : this._expand();
  }

  _expand() {
    this._expanded = true;
    this._fab.classList.add("open");
    this._palette.classList.add("open");
  }

  _collapse() {
    this._expanded = false;
    this._fab.classList.remove("open");
    this._palette.classList.remove("open");
  }

  _selectColor(color) {
    this.setAttribute("color", color);
    this._renderSwatches();
    this.dispatchEvent(new CustomEvent("color-change", {
      bubbles: true,
      detail: { color },
    }));
    this._collapse();
  }

  _renderSwatches() {
    const current = (this.getAttribute("color") || "#d4cdb8").toLowerCase();
    this._fab.style.background = current;

    this._swatchesEl.innerHTML = "";
    for (const color of this._presets) {
      const swatch = document.createElement("div");
      swatch.className = "swatch";
      swatch.style.background = color;
      if (color.toLowerCase() === current) {
        swatch.classList.add("selected");
      }
      swatch.addEventListener("click", (e) => {
        e.stopPropagation();
        this._selectColor(color);
      });
      this._swatchesEl.appendChild(swatch);
    }
  }
}

customElements.define("tb-color-selector", TbColorSelector);
