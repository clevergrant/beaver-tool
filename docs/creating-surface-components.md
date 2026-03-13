# Creating Surface Components

Surface components are the visual building blocks that live on a TbComponent's surface grid (LEDs, toggles, dials, etc.). Each one is a web component that extends `TbSurfaceComponent` and integrates with the circuitry system.

This guide covers every file you need to touch when adding a new surface component.

## Overview of Files to Modify

| # | File | What to do |
| --- | ---- | ---------- |
| 1 | `src/public/components/surface/tb-<name>/index.ts` | Create the web component |
| 1b | `src/public/components/surface/tb-<name>/tb-<name>.scss` | Component styles (optional) |
| 2 | `src/public/components/surface/index.ts` | Import the new component |
| 3 | `src/public/js/app.ts` | Add a `case` in `createSurfaceElement()` |
| 4 | `src/public/components/tb-component/index.ts` | Add to the `elementTypes` context menu array |
| 5 | `src/public/components/tb-component/index.ts` | (If configurable) Add a `_sync<Name>Config()` method |
| 6 | `src/public/components/tb-node-editor/index.ts` | Add display name + config UI in the circuitry editor |
| 7 | `src/public/js/surface-registry.ts` | Register a factory for the outer-grid context menu |

## Step 1: Create the Web Component

Create a directory `src/public/components/surface/tb-<name>/` with an `index.ts` file and an optional `tb-<name>.scss` for styles. Extend `TbSurfaceComponent` and override the required static getters.

```ts
import { TbSurfaceComponent } from '../tb-surface-component';
import styles from './tb-example.scss';

class TbExample extends TbSurfaceComponent {
  static get observedAttributes() {
    return ["on", "label" /* , ...other attributes */];
  }

  // Declare circuitry ports.
  //   inputs:  values that flow INTO this component (e.g. "signal", "text")
  //   outputs: values that flow OUT from this component (e.g. "state", "color")
  static get circuitryPorts() {
    return { inputs: [], outputs: ["state"] };
  }

  // Grid size constraints (each cell is 20x20px).
  //   Set maxW/maxH to null for unlimited resizing.
  //   Use defaultW/defaultH to set the initial placement size.
  static get sizeConstraints() {
    return { minW: 2, minH: 2, maxW: 2, maxH: 2 };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
      <!-- template HTML -->
    `;
    // Cache DOM refs, bind event listeners, etc.
  }

  connectedCallback() {
    super.connectedCallback();  // required
    this._render();
  }

  disconnectedCallback() {
    super.disconnectedCallback();  // required
    // Clean up timers, external listeners, etc.
  }

  attributeChangedCallback() {
    this._render();
  }

  _render() {
    // Update shadow DOM to reflect current attribute state
  }
}

customElements.define("tb-example", TbExample);
```

### Key Conventions

- **Shadow DOM** is required. All styles are scoped inside it.
- **`super.connectedCallback()` / `super.disconnectedCallback()`** must be called. The base class handles circuitry node registration/cleanup.
- **Events** that affect the game should bubble (`bubbles: true`) and use `CustomEvent` with a `detail` object. Common event names:
  - `toggle-change` with `{ name, on }` for on/off controls
  - `color-pick` with `{ color }` for color output (hex string like `"#ff4c2e"`)
- **Attributes** are the public API. Props via `get`/`set` should map to attributes.
- Use `--comp-hl` CSS custom property for the component's highlight/accent color (set by the parent TbComponent's color selector).

### Optional: Overwritable Properties

If your component displays a value that can optionally be overridden by the user (instead of showing the device-supplied value), declare `overwritableProperties`:

```ts
static get overwritableProperties() {
  return [
    { name: "text", overwriteAttr: "overwrite-text", label: "Text", type: "text" },
  ];
}
```

Types: `"text"`, `"color"`, `"number"`.

## Step 2: Import the Component

In `src/public/components/surface/index.ts`, add a side-effect import for your new component:

```ts
import './tb-example';
```

The barrel file re-exports the base class and registers all surface components as custom elements. No `<script>` tags needed -- the bundler handles everything from the single entry point in `index.html`.

## Step 3: Register in `createSurfaceElement()`

In `src/public/js/app.ts`, find the `createSurfaceElement()` function and add a case to the `switch (elem.type)` block:

```ts
case "example":
    el = document.createElement("tb-example")
    // Wire up any events that need app-level handling:
    el.addEventListener("toggle-change", (e) => {
        if (el.surfaceId && el.parentComponent) {
            handleToggleViaCircuitry(el.parentComponent, el.surfaceId, e.detail.on)
        }
    })
    break
```

If the component is purely visual (no events that affect the game), just create the element with no listeners.

The `applySurfaceProps(el, props)` call after the switch applies all saved `props` from the component config as element attributes automatically.

## Step 4: Add to the Surface Editor Context Menu

In `src/public/components/tb-component/index.ts`, find the `elementTypes` array inside the surface editor right-click handler and add an entry:

```ts
const elementTypes = [
    // ... existing entries ...
    { type: "example", tag: "tb-example", name: "Example Widget", icon: "★" },
].map(et => { ... });
```

Fields:
- `type` must match the `case` string in `createSurfaceElement()` and the `type` field in surface config
- `tag` is the custom element tag name
- `name` is the display label in the menu
- `icon` is a single character/emoji shown in the menu

The `.map()` call auto-reads `sizeConstraints` from the element class to determine the default placement size.

## Step 5: Add Config Sync (if the component has circuitry-editable parameters)

If the component has parameters that should be editable from the circuitry node editor (like a toggle's orientation, or a rainbow's interval), add a sync method in `src/public/components/tb-component/index.ts`:

```ts
_syncExampleConfig() {
    const { nodes } = this._circuitryData;
    if (!nodes?.length) return;

    for (const node of nodes) {
        if (node.type !== "surface-example" || !node.config?.surfaceManaged) continue;
        const sid = node.config.surfaceId;
        const surfaceEl = this.shadowRoot?.querySelector(`[surface-id="${sid}"]`);
        if (!surfaceEl) continue;

        // Read config values and apply as attributes
        const myParam = node.config.myParam;
        if (myParam) surfaceEl.setAttribute("my-param", String(myParam));
    }
}
```

The node `type` is auto-generated as `"surface-"` + the tag name minus `"tb-"` (e.g., `tb-example` becomes `surface-example`). This happens in `_registerSurfaceNode()`.

Call this method from **all four sync sites** (search for `_syncToggleConfig` to find them):

1. `connectedCallback()` — initial load
2. The mode-switch handler (switching from circuitry back to surface mode)
3. The node editor data sync (after circuitry edits)
4. The edit-mode exit handler (leaving editor entirely)

## Step 6: Add Circuitry Node Editor UI

In `src/public/components/tb-node-editor/index.ts`, make three changes:

### 6a. Display Name

Add an entry to the `_nodeDisplayName()` method's `names` object:

```ts
"surface-example": "Example",
```

### 6b. Node Body Content (config fields)

In `_nodeBodyContent()`, add a block **before** the generic `surface-` fallback:

```ts
if (node.type === "surface-example") {
    const label = node.config?.label || node.config?.surfaceId || "\u2014";
    const myParam = node.config?.myParam || "default";
    return `
        <span style="color:#60a0ff;">${label}</span>
        <div class="node-param-row">
            <span class="node-param-label">param</span>
            <input class="node-select example-param" type="number" value="${myParam}" style="width:60px;" />
        </div>`;
}
```

Use class `node-select` for inputs/selects to inherit the node editor styling. Use `node-param-row` and `node-param-label` for layout.

### 6c. Event Handlers

In `_renderNode()`, after the existing toggle/label handlers, wire up change listeners:

```ts
const exampleParam = el.querySelector(".example-param");
if (exampleParam) {
    exampleParam.addEventListener("mousedown", (e) => e.stopPropagation());
    exampleParam.addEventListener("change", () => {
        if (!node.config) node.config = {};
        node.config.myParam = exampleParam.value;
        this._emitToggleConfigChange(node);
    });
}
```

Always call `e.stopPropagation()` on `mousedown` to prevent the node drag handler from capturing input interactions. Use `_emitToggleConfigChange(node)` to notify the parent TbComponent that config has changed.

## Step 7: Register a Factory (Outer Grid)

In `src/public/js/surface-registry.ts`, register a factory so the component can also be placed as a standalone widget from the outer grid context menu:

```ts
SurfaceComponents.register({
    type: "example",
    name: "Example Widget",
    icon: '<svg width="16" height="16" viewBox="0 0 16 16">...</svg>',
    category: "control",  // "control", "indicator", or "display"
    width: 2,
    height: 2,
    resizable: false,
    factory(id, gridX, gridY) {
        return {
            id,
            name: "Example Widget",
            x: gridX,
            y: gridY,
            minWidth: 2,
            minHeight: 2,
            color: "#1a1a18",
            surface: [{
                type: "example",
                x: 0, y: 0,
                width: 2, height: 2,
                props: {},
            }],
            circuitry: { nodes: [], edges: [] },
        };
    },
});
```

## Checklist

- [ ] Created `src/public/components/surface/tb-<name>/index.ts` (and optional `.scss`)
- [ ] Extended `TbSurfaceComponent`, overrode `circuitryPorts` and `sizeConstraints`
- [ ] Called `super.connectedCallback()` and `super.disconnectedCallback()`
- [ ] Added side-effect import in `src/public/components/surface/index.ts`
- [ ] Added `case` in `createSurfaceElement()` in `src/public/js/app.ts`
- [ ] Added entry to `elementTypes` array in `src/public/components/tb-component/index.ts`
- [ ] (If configurable) Added `_sync<Name>Config()` and called it from all 4 sync sites
- [ ] Added display name in `_nodeDisplayName()` in `src/public/components/tb-node-editor/index.ts`
- [ ] (If configurable) Added config UI in `_nodeBodyContent()` and event handlers in `_renderNode()`
- [ ] Registered factory in `src/public/js/surface-registry.ts`
