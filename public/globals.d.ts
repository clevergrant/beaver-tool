// Frontend global declarations — refined iteratively as files are converted

interface StoreApi {
  getTitle(): string;
  setTitle(title: string): void;
  getComponentIds(): string[];
  readComponent(id: string): ComponentData | null;
  saveComponent(comp: ComponentData): void;
  updateComponent(id: string, partial: Partial<ComponentData>): ComponentData | null;
  removeComponent(id: string): void;
  saveLayout(id: string, layout: { x: number; y: number; w: number; h: number }): void;
  loadAll(): ComponentData[];
  migrateIfNeeded(): boolean;
}

interface ComponentData {
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

interface SurfaceElementConfig {
  tag: string;
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  attrs?: Record<string, string>;
  [key: string]: unknown;
}

interface CircuitryNodeConfig {
  id: string;
  type: string;
  x: number;
  y: number;
  [key: string]: unknown;
}

interface CircuitryEdgeConfig {
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
  [key: string]: unknown;
}

interface SurfaceComponentDef {
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

interface SurfaceComponentsApi {
  register(def: SurfaceComponentDef): void;
  getAll(): SurfaceComponentDef[];
  get(type: string): SurfaceComponentDef | undefined;
  createConfig(type: string, gridX: number, gridY: number): ComponentData | null;
}

interface GridOpts {
  storageKey?: string | null;
  listenToWindowResize?: boolean;
  onComponentAdded?: (id: string, el: HTMLElement) => void;
  onComponentRemoved?: (id: string) => void;
  onLayoutChange?: (id: string, layout: { x: number; y: number; w: number; h: number }) => void;
  bare?: boolean;
}

interface ContextMenuCallbacks {
  getConfig(): { components: ComponentData[] };
  saveConfig(config: { components: ComponentData[] }): Promise<void> | void;
  buildComponents(): void;
  gridViewport: HTMLElement;
}

interface EditorState {
  activeComponentId: string | null;
  mode: "dashboard" | "surface" | "circuitry";
}

// Globals defined inside IIFEs and assigned to window.* — need declare const
// so other .ts files can reference them as bare identifiers.
// (Store, Grid, CELL_SIZE, COMP_MIN_WIDTH, COMP_MIN_HEIGHT, TbSurfaceComponent
//  are top-level declarations in their .ts files and don't need declare here.)
declare const SurfaceComponents: SurfaceComponentsApi;
declare function initContextMenu(callbacks: ContextMenuCallbacks): void;

interface Window {
  Store: StoreApi;
  Grid: typeof Grid;
  CELL_SIZE: number;
  COMP_MIN_WIDTH: number;
  COMP_MIN_HEIGHT: number;
  initContextMenu: (callbacks: ContextMenuCallbacks) => void;
  SurfaceComponents: SurfaceComponentsApi;
  editorState: EditorState;
  SCREW_STYLES: (sel: string, bottomSel: string, opts?: { size?: number; offset?: number }) => string;
  PANEL_BASE_STYLES: string;
  TbSurfaceComponent: typeof TbSurfaceComponent;
}
