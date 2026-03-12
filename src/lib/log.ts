import * as c from "./colors";
import { LOG_BUFFER } from "./config";

const MAX_LOG_LINES: number = LOG_BUFFER;
const logBuffer: string[] = [];
let _onLog: ((line: string) => void) | null = null;
let _headless = false;

function timestamp(): string {
  return `${c.dim}${new Date().toLocaleTimeString()}${c.reset}`;
}

function push(line: string): void {
  logBuffer.push(line);
  if (logBuffer.length > MAX_LOG_LINES) logBuffer.shift();
  if (_headless) {
    const plain = c.stripAnsi(line);
    process.stdout.write(plain + "\n");
  }
  if (_onLog) _onLog(line);
}

function format(tag: string, color: string, msg: string): string {
  return `${timestamp()} ${color}[${tag}]${c.reset} ${msg}`;
}

const log = {
  buffer: logBuffer,
  onLog(fn: ((line: string) => void) | null): void { _onLog = fn; },
  setHeadless(v: boolean): void { _headless = v; },
  server: (msg: string): void => push(format("SERVER", c.cyan, msg)),
  discord: (msg: string): void => push(format("DISCORD", c.magenta, msg)),
  game: (msg: string): void => push(format("GAME", c.green, msg)),
  lever: (name: string, on: boolean, source?: string, user?: string): void => {
    const src = source ? `${c.dim}(${source})${c.reset} ` : "";
    const who = user ? `${c.bold}${user}${c.reset} ` : "";
    push(format("LEVER", c.yellow, `${src}${who}${name} ${on ? `${c.bgGreen}${c.bold} ON ${c.reset}` : `${c.bgRed}${c.bold} OFF ${c.reset}`}`));
  },
  error: (tag: string, msg: string): void =>
    push(format(tag, c.red, `${c.red}${msg}${c.reset}`)),
  ws: (msg: string): void => push(format("WS", c.blue, msg)),
  config: (msg: string): void => push(format("CONFIG", c.yellow, msg)),
};

export default log;
