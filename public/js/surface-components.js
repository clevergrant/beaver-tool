/**
 * Surface Component Registry
 *
 * Defines pre-built surface component types that can be placed directly
 * on the grid via right-click context menu. Unlike blank "box" panels,
 * surface components have forced sizing, custom displays, and may include
 * multiple sub-elements.
 *
 * Each entry:
 *   type        - Unique key (matches componentType in config)
 *   name        - Display name in context menu
 *   icon        - Small SVG icon string for the menu
 *   category    - Grouping: "indicator", "control", "display"
 *   width       - Default width in grid cells
 *   height      - Default height in grid cells
 *   resizable   - Whether the user can resize on the grid
 *   aspectRatio - If set, height/width ratio is locked during resize (e.g. 1 = square)
 *   factory(id, gridX, gridY) - Returns a component config object
 */

(function () {
  const registry = new Map();

  /**
   * Register a surface component type.
   * @param {Object} def - Component definition
   */
  function register(def) {
    if (!def.type) throw new Error("Surface component must have a type");
    registry.set(def.type, def);
  }

  /**
   * Get all registered surface component definitions.
   * @returns {Array} Array of definitions
   */
  function getAll() {
    return Array.from(registry.values());
  }

  /**
   * Get a definition by type.
   * @param {string} type
   * @returns {Object|undefined}
   */
  function get(type) {
    return registry.get(type);
  }

  /**
   * Build a config object for a surface component placement.
   * @param {string} type - Component type key
   * @param {number} gridX - Grid x position
   * @param {number} gridY - Grid y position
   * @returns {Object|null} Component config or null if type unknown
   */
  function createConfig(type, gridX, gridY) {
    const def = registry.get(type);
    if (!def) return null;

    const id = type + "-" + Date.now().toString(36);
    return def.factory(id, gridX, gridY);
  }

  window.SurfaceComponents = { register, getAll, get, createConfig };
})();
