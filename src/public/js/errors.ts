// --- Rust-style structured error system ---

export interface TbError {
  code: string;
  severity: "error" | "warning" | "note";
  title: string;
  context?: string[];
  help?: string;
  note?: string;
  source?: string;
}

// --- ErrorBus: global dispatcher via window CustomEvent ---

export const ErrorBus = {
  report(err: TbError): void {
    window.dispatchEvent(new CustomEvent("tb-error", { detail: err }));
  },
};

// --- Circuit Editor errors ---

export function CE0001(fromType: string, toType: string): TbError {
  return {
    code: "CE0001",
    severity: "error",
    title: "invalid connection: same port polarity",
    context: [
      `  attempted: ${fromType} port --> ${toType} port`,
      `  expected:  output port --> input port`,
    ],
    help: "drag from an output port (right side) to an input port (left side)",
    source: "tb-node-editor",
  };
}

export function CE0002(nodeLabel: string): TbError {
  return {
    code: "CE0002",
    severity: "error",
    title: "self-connection: node cannot connect to itself",
    context: [
      `  node: ${nodeLabel}`,
      `  both endpoints resolve to the same node`,
    ],
    help: "connect to a different node instead",
    source: "tb-node-editor",
  };
}

export function CE0003(fromLabel: string, toLabel: string): TbError {
  return {
    code: "CE0003",
    severity: "warning",
    title: "duplicate edge: connection already exists",
    context: [
      `  from: ${fromLabel}`,
      `  to:   ${toLabel}`,
    ],
    note: "each port pair can only have one connection",
    source: "tb-node-editor",
  };
}

export function CE0004(deviceName: string): TbError {
  return {
    code: "CE0004",
    severity: "warning",
    title: `missing device: "${deviceName}" not found in game`,
    context: [
      `  node references device: ${deviceName}`,
      `  available devices:      (none matching)`,
    ],
    help: "check that the device exists in-game and the game API is connected",
    source: "tb-node-editor",
  };
}

// --- API errors ---

export function API0001(deviceName: string, err: unknown): TbError {
  const msg = err instanceof Error ? err.message : String(err);
  return {
    code: "API0001",
    severity: "error",
    title: "toggle failed: could not reach game API",
    context: [
      `  device: ${deviceName}`,
      `  error:  ${msg}`,
    ],
    help: "check that Timberborn is running and the API port is correct",
    source: "app",
  };
}

export function API0002(deviceName: string, err: unknown): TbError {
  const msg = err instanceof Error ? err.message : String(err);
  return {
    code: "API0002",
    severity: "error",
    title: "color command failed: could not reach game API",
    context: [
      `  device: ${deviceName}`,
      `  error:  ${msg}`,
    ],
    help: "check that Timberborn is running and the API port is correct",
    source: "app",
  };
}

// --- WebSocket errors ---

export function WS0001(err: unknown): TbError {
  const msg = err instanceof Error ? err.message : String(err);
  return {
    code: "WS0001",
    severity: "warning",
    title: "parse error: malformed message from server",
    context: [
      `  error: ${msg}`,
    ],
    note: "the server sent a message that could not be parsed as JSON",
    source: "websocket",
  };
}

export function WS0002(): TbError {
  return {
    code: "WS0002",
    severity: "note",
    title: "connection lost: reconnecting...",
    help: "the dashboard will automatically reconnect in a few seconds",
    source: "websocket",
  };
}

// --- Storage errors ---

export function IO0001(key: string): TbError {
  return {
    code: "IO0001",
    severity: "warning",
    title: "corrupted data: failed to parse from localStorage",
    context: [
      `  key: ${key}`,
    ],
    help: "the data may have been manually edited or corrupted — defaults will be used",
    source: "store",
  };
}

export function IO0002(err: unknown): TbError {
  const msg = err instanceof Error ? err.message : String(err);
  return {
    code: "IO0002",
    severity: "error",
    title: "migration failed: could not upgrade old config format",
    context: [
      `  error: ${msg}`,
    ],
    help: "old config data has been preserved — try refreshing the page",
    source: "store",
  };
}

export function IO0003(): TbError {
  return {
    code: "IO0003",
    severity: "warning",
    title: "clipboard error: invalid paste data",
    note: "the clipboard contents could not be parsed as a valid surface element",
    source: "tb-component",
  };
}

// --- UI errors ---

export function UI0001(tag: string): TbError {
  return {
    code: "UI0001",
    severity: "warning",
    title: `unknown element: "${tag}" is not a recognized surface component`,
    context: [
      `  tag: ${tag}`,
      `  expected one of: led, label, dial, toggle, alert, color-picker, rainbow, camera`,
    ],
    help: "check the component config for typos in the element type",
    source: "app",
  };
}
