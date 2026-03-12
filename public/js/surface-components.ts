(function (): void {
  const registry: Map<string, SurfaceComponentDef> = new Map();

  function register(def: SurfaceComponentDef): void {
    if (!def.type) throw new Error("Surface component must have a type");
    registry.set(def.type, def);
  }

  function getAll(): SurfaceComponentDef[] {
    return Array.from(registry.values());
  }

  function get(type: string): SurfaceComponentDef | undefined {
    return registry.get(type);
  }

  function createConfig(type: string, gridX: number, gridY: number): ComponentData | null {
    const def = registry.get(type);
    if (!def) return null;
    const id = type + "-" + Date.now().toString(36);
    return def.factory(id, gridX, gridY);
  }

  window.SurfaceComponents = { register, getAll, get, createConfig };
})();
