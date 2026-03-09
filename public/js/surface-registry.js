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
