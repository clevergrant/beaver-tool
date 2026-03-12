export interface ComponentData {
  id: string;
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  componentType?: string;
  surface?: SurfaceElementConfig[];
  circuitry?: { nodes: CircuitryNodeConfig[]; edges: CircuitryEdgeConfig[] };
  [key: string]: unknown;
}

export interface SurfaceElementConfig {
  tag: string;
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  attrs?: Record<string, string>;
  [key: string]: unknown;
}

export interface CircuitryNodeConfig {
  id: string;
  type: string;
  x: number;
  y: number;
  [key: string]: unknown;
}

export interface CircuitryEdgeConfig {
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
  [key: string]: unknown;
}

export interface SurfaceComponentDef {
  type: string;
  name: string;
  icon?: string;
  category?: string;
  width: number;
  height: number;
  resizable?: boolean;
  aspectRatio?: number;
  factory(id: string, gridX: number, gridY: number): ComponentData;
}

export interface EditorState {
  activeComponentId: string | null;
  mode: "dashboard" | "surface" | "circuitry";
}
