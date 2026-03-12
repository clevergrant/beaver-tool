// Base class (named exports)
export { TbSurfaceComponent, type CircuitryPorts, type SizeConstraints, type OverwritableProperty, type SurfaceParent } from './tb-surface-component';

// Named re-exports used by other modules
export { DEFAULT_FPS, DEFAULT_THRESHOLD } from './tb-camera';

// Side-effect imports (register custom elements)
import './tb-alert';
import './tb-camera';
import './tb-color-picker';
import './tb-dial';
import './tb-label';
import './tb-led';
import './tb-rainbow';
import './tb-toggle';
