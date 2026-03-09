/**
 * TbSurfaceComponent — Base class for all surface components.
 *
 * Surface components are visual elements (LEDs, toggles, dials, etc.) that
 * live on a Component's surface grid. Each declares its circuitry ports so
 * that placing it on a surface automatically creates a corresponding node
 * in the parent Component's circuitry.
 *
 * Subclasses MUST:
 *   - Override static get circuitryPorts() to declare inputs/outputs
 *   - Call super.connectedCallback() / super.disconnectedCallback()
 */
class TbSurfaceComponent extends HTMLElement {
  /**
   * Override in subclass to declare circuitry ports.
   * @returns {{ inputs: string[], outputs: string[] }}
   */
  static get circuitryPorts() {
    return { inputs: [], outputs: [] };
  }

  /**
   * Override in subclass to declare size constraints.
   * @returns {{ minW: number, minH: number, maxW: number|null, maxH: number|null }}
   */
  static get sizeConstraints() {
    return { minW: 1, minH: 1, maxW: null, maxH: null };
  }

  /**
   * Override in subclass to declare properties that can optionally overwrite
   * values provided by connected in-game devices.
   *
   * Each entry:
   *   name              - Internal identifier / attribute for the value
   *   overwriteAttr     - Boolean HTML attribute that enables the overwrite
   *   label             - Display name shown in the editor properties panel
   *   type              - Input type: "text" | "color" | "number"
   *
   * When a device supplies a value for a property, the surface component
   * only uses the user's custom value if BOTH:
   *   1. The overwrite attribute is present (checkbox ON)
   *   2. The custom value is non-empty
   * Otherwise the device-supplied value is shown.
   *
   * @returns {Array<{ name: string, overwriteAttr: string, label: string, type: string }>}
   */
  static get overwritableProperties() {
    return [];
  }

  /** Stable ID linking this surface element to its circuitry node */
  get surfaceId() {
    return this.getAttribute("surface-id");
  }

  set surfaceId(val) {
    this.setAttribute("surface-id", val);
  }

  /** Reference to the parent TbComponent that owns this surface element */
  get parentComponent() {
    return this._parentComponent || null;
  }

  /**
   * Called by the parent Component's surface Grid when this element is added.
   * Triggers auto-registration of a circuitry node.
   */
  _onAttachedToSurface(parentComponent) {
    this._parentComponent = parentComponent;
    if (parentComponent._registerSurfaceNode) {
      parentComponent._registerSurfaceNode(this);
    }
  }

  /**
   * Called when removed from the surface Grid.
   * Cleans up the corresponding circuitry node.
   */
  _onDetachedFromSurface() {
    if (this._parentComponent && this._parentComponent._unregisterSurfaceNode) {
      this._parentComponent._unregisterSurfaceNode(this);
    }
    this._parentComponent = null;
  }

  connectedCallback() {
    // Subclasses should call super.connectedCallback()
  }

  disconnectedCallback() {
    // Subclasses should call super.disconnectedCallback()
  }
}

window.TbSurfaceComponent = TbSurfaceComponent;
