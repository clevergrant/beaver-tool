import type { CircuitryPorts } from '../../../types';
export type { CircuitryPorts };

export interface SizeConstraints {
  minW: number;
  minH: number;
  maxW: number | null;
  maxH: number | null;
}

export interface OverwritableProperty {
  name: string;
  type: string;
  label?: string;
  default?: unknown;
}

export interface SurfaceParent extends HTMLElement {
  _registerSurfaceNode?(node: TbSurfaceComponent): void;
  _unregisterSurfaceNode?(node: TbSurfaceComponent): void;
}

export class TbSurfaceComponent extends HTMLElement {
  private _parentComponent: SurfaceParent | null = null;

  static get circuitryPorts(): CircuitryPorts {
    return { inputs: [], outputs: [] };
  }

  static get sizeConstraints(): SizeConstraints {
    return { minW: 1, minH: 1, maxW: null, maxH: null };
  }

  static get overwritableProperties(): OverwritableProperty[] {
    return [];
  }

  get surfaceId(): string | null {
    return this.getAttribute("surface-id");
  }

  set surfaceId(val: string | null) {
    if (val) {
      this.setAttribute("surface-id", val);
    } else {
      this.removeAttribute("surface-id");
    }
  }

  get on(): boolean { return this.hasAttribute("on"); }
  set on(val: boolean) {
    if (val) this.setAttribute("on", "");
    else this.removeAttribute("on");
  }

  get parentComponent(): SurfaceParent | null {
    return this._parentComponent || null;
  }

  _onAttachedToSurface(parentComponent: SurfaceParent): void {
    this._parentComponent = parentComponent;
    if (parentComponent._registerSurfaceNode) {
      parentComponent._registerSurfaceNode(this);
    }
  }

  _onDetachedFromSurface(): void {
    if (this._parentComponent && this._parentComponent._unregisterSurfaceNode) {
      this._parentComponent._unregisterSurfaceNode(this);
    }
    this._parentComponent = null;
  }

  connectedCallback(): void {}
  disconnectedCallback(): void {}
}
