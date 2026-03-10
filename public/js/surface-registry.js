/**
 * Surface Component Registry — Pre-built component types for the grid.
 *
 * Each registration makes a component type available in the right-click
 * context menu when edit mode is active.
 */

// --- LED Indicator ---
SurfaceComponents.register({
  type: "led-indicator",
  name: "LED Indicator",
  icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5" fill="#30ff60" opacity="0.8"/><circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="8" cy="8" r="2.5" fill="#30ff60"/></svg>',
  category: "indicator",
  width: 1,
  height: 1,
  resizable: false,
  factory(id, gridX, gridY) {
    return {
      id,
      name: "LED Indicator",
      x: gridX,
      y: gridY,
      minWidth: 1,
      minHeight: 1,
      color: "#1a1a18",
      surface: [{
        type: "led",
        x: 0, y: 0,
        width: 1, height: 1,
        props: { color: "green", size: "16" },
      }],
      circuitry: { nodes: [], edges: [] },
    };
  },
});

// --- Label ---
SurfaceComponents.register({
  type: "label",
  name: "Label",
  icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="14" height="8" rx="1"/><text x="8" y="10.5" font-size="7" fill="currentColor" stroke="none" text-anchor="middle" font-family="monospace">Aa</text></svg>',
  category: "display",
  width: 6,
  height: 1,
  resizable: true,
  factory(id, gridX, gridY) {
    return {
      id,
      name: "Label",
      x: gridX,
      y: gridY,
      minWidth: 3,
      minHeight: 1,
      color: "#1a1a18",
      surface: [{
        type: "label",
        x: 0, y: 0,
        width: 6, height: 1,
        props: { text: "LABEL", style: "dymo" },
      }],
      circuitry: { nodes: [], edges: [] },
    };
  },
});

// --- Color Picker ---
SurfaceComponents.register({
  type: "color-picker",
  name: "Color Picker",
  icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" fill="#3a3a38" stroke="#555" stroke-width="1.2"/><circle cx="8" cy="8" r="3.5" fill="#ffaa20" opacity="0.9"/><path d="M5 8a3 3 0 0 1 6 0" stroke="#ff4c2e" stroke-width="1" fill="none" opacity="0.6"/><path d="M5 8a3 3 0 0 0 6 0" stroke="#64b53c" stroke-width="1" fill="none" opacity="0.6"/></svg>',
  category: "control",
  width: 2,
  height: 2,
  resizable: false,
  factory(id, gridX, gridY) {
    return {
      id,
      name: "Color Picker",
      x: gridX,
      y: gridY,
      minWidth: 2,
      minHeight: 2,
      color: "#1a1a18",
      surface: [{
        type: "color-picker",
        x: 0, y: 0,
        width: 2, height: 2,
        props: { color: "#ffaa20" },
      }],
      circuitry: { nodes: [], edges: [] },
    };
  },
});

// --- Alert Lamp ---
SurfaceComponents.register({
  type: "alert-lamp",
  name: "Alert Lamp",
  icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" fill="#3a2020" stroke="#555" stroke-width="1.2"/><circle cx="8" cy="8" r="3.5" fill="#ff3030" opacity="0.7"/><circle cx="8" cy="8" r="1.5" fill="#ff5050"/></svg>',
  category: "indicator",
  width: 2,
  height: 2,
  resizable: false,
  factory(id, gridX, gridY) {
    return {
      id,
      name: "Alert Lamp",
      x: gridX,
      y: gridY,
      minWidth: 2,
      minHeight: 2,
      color: "#1a1a18",
      surface: [{
        type: "alert",
        x: 0, y: 0,
        width: 2, height: 2,
        props: { color: "red", speed: "1200" },
      }],
      circuitry: { nodes: [], edges: [] },
    };
  },
});

// --- Rainbow Button ---
SurfaceComponents.register({
  type: "rainbow",
  name: "Rainbow Button",
  icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" fill="#2a2a28" stroke="#555" stroke-width="1.2"/><path d="M8 2a6 6 0 0 1 0 12" stroke="#ff4c2e" stroke-width="1.5" fill="none"/><path d="M8 14a6 6 0 0 1 0-12" stroke="#64b53c" stroke-width="1.5" fill="none"/><circle cx="8" cy="8" r="2.5" fill="#fdd42c" opacity="0.8"/></svg>',
  category: "control",
  width: 2,
  height: 2,
  resizable: false,
  factory(id, gridX, gridY) {
    return {
      id,
      name: "Rainbow Button",
      x: gridX,
      y: gridY,
      minWidth: 2,
      minHeight: 2,
      color: "#1a1a18",
      surface: [{
        type: "rainbow",
        x: 0, y: 0,
        width: 2, height: 2,
        props: {},
      }],
      circuitry: { nodes: [], edges: [] },
    };
  },
});
