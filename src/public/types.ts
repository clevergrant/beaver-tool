export interface GridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CircuitryPorts {
  inputs: string[];
  outputs: string[];
}

export interface CircuitryNode {
  id: string;
  type: string;
  x: number;
  y: number;
  config?: Record<string, unknown>;
  _el?: HTMLDivElement | null;
}

export interface CircuitryEdge {
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
}

export interface CircuitryData {
  nodes: CircuitryNode[];
  edges: CircuitryEdge[];
}

export interface SurfaceElementConfig {
  tag: string;
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  attrs?: Record<string, string>;
}

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
  circuitry?: CircuitryData;
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
