/**
 * Store — Two-layer localStorage persistence for dashboard components.
 *
 * Layer 1: Root key "tb-tool-db" stores the dashboard title and an ordered
 *          array of component storage keys.
 * Layer 2: Each component key (e.g. "tb-comp-panel-abc") stores that
 *          component's full data: config, surface elements, circuitry,
 *          and grid position/size.
 *
 * Components are loaded asynchronously via a placement queue so that each
 * one can validate its position against already-placed components.
 */

const Store = (function () {
  const ROOT_KEY = "tb-tool-db";
  const COMP_PREFIX = "tb-comp-";

  // ---- Root layer ----

  function _readRoot() {
    try {
      return JSON.parse(localStorage.getItem(ROOT_KEY)) || { title: "Timberborn Colony Control", components: [] };
    } catch {
      return { title: "Timberborn Colony Control", components: [] };
    }
  }

  function _writeRoot(root) {
    localStorage.setItem(ROOT_KEY, JSON.stringify(root));
  }

  // ---- Component layer ----

  function _compKey(id) {
    return COMP_PREFIX + id;
  }

  function readComponent(id) {
    try {
      return JSON.parse(localStorage.getItem(_compKey(id)));
    } catch {
      return null;
    }
  }

  function writeComponent(comp) {
    localStorage.setItem(_compKey(comp.id), JSON.stringify(comp));
  }

  function deleteComponent(id) {
    localStorage.removeItem(_compKey(id));
  }

  // ---- Public API ----

  /** Get the dashboard title. */
  function getTitle() {
    return _readRoot().title || "Timberborn Colony Control";
  }

  /** Set the dashboard title. */
  function setTitle(title) {
    const root = _readRoot();
    root.title = title;
    _writeRoot(root);
  }

  /**
   * Return the ordered list of component IDs.
   * Does NOT load the component data — callers should use readComponent().
   */
  function getComponentIds() {
    return _readRoot().components || [];
  }

  /**
   * Save a single component's data and ensure it's registered in the root index.
   */
  function saveComponent(comp) {
    writeComponent(comp);
    const root = _readRoot();
    if (!root.components.includes(comp.id)) {
      root.components.push(comp.id);
      _writeRoot(root);
    }
  }

  /**
   * Update a specific property on a stored component without rewriting the whole object.
   * Returns the updated component data, or null if not found.
   */
  function updateComponent(id, partial) {
    const comp = readComponent(id);
    if (!comp) return null;
    Object.assign(comp, partial);
    writeComponent(comp);
    return comp;
  }

  /**
   * Remove a component from storage and the root index.
   */
  function removeComponent(id) {
    deleteComponent(id);
    const root = _readRoot();
    root.components = root.components.filter(cid => cid !== id);
    _writeRoot(root);
  }

  /**
   * Save grid position/size for a component (called by grid after drag/resize).
   */
  function saveLayout(id, { x, y, w, h }) {
    const comp = readComponent(id);
    if (!comp) return;
    comp.x = x;
    comp.y = y;
    comp.w = w;
    comp.h = h;
    writeComponent(comp);
  }

  /**
   * Load all component data as an array (convenience for full reads).
   */
  function loadAll() {
    const ids = getComponentIds();
    const results = [];
    for (const id of ids) {
      const comp = readComponent(id);
      if (comp) results.push(comp);
    }
    return results;
  }

  /**
   * Migrate from the old single-key storage format.
   * Reads the old keys, writes to the new two-layer format, then removes old keys.
   */
  function migrateIfNeeded() {
    const OLD_CONFIG_KEY = "timberborn-dashboard-config";
    const OLD_LAYOUT_KEY = "timberborn-grid-layout";

    const oldConfig = localStorage.getItem(OLD_CONFIG_KEY);
    if (!oldConfig) return false;

    try {
      const config = JSON.parse(oldConfig);
      let layout = {};
      try {
        layout = JSON.parse(localStorage.getItem(OLD_LAYOUT_KEY)) || {};
      } catch { /* ignore */ }

      // Build new root
      const root = {
        title: config.title || "Timberborn Colony Control",
        components: [],
      };

      for (const comp of config.components || []) {
        // Merge grid layout positions into component data
        const saved = layout[comp.id];
        if (saved) {
          comp.x = saved.x ?? comp.x ?? 0;
          comp.y = saved.y ?? comp.y ?? 0;
          comp.w = saved.w ?? comp.minWidth ?? COMP_MIN_WIDTH;
          comp.h = saved.h ?? comp.minHeight ?? COMP_MIN_HEIGHT;
        } else {
          comp.w = comp.w ?? comp.minWidth ?? COMP_MIN_WIDTH;
          comp.h = comp.h ?? comp.minHeight ?? COMP_MIN_HEIGHT;
        }

        root.components.push(comp.id);
        writeComponent(comp);
      }

      _writeRoot(root);

      // Clean up old keys
      localStorage.removeItem(OLD_CONFIG_KEY);
      localStorage.removeItem(OLD_LAYOUT_KEY);

      console.log("Store: migrated from old format", root.components.length, "components");
      return true;
    } catch (err) {
      console.error("Store: migration failed", err);
      return false;
    }
  }

  return {
    getTitle,
    setTitle,
    getComponentIds,
    readComponent,
    saveComponent,
    updateComponent,
    removeComponent,
    saveLayout,
    loadAll,
    migrateIfNeeded,
  };
})();

window.Store = Store;
