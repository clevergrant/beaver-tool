const c = require("./colors");
const { LOG_BUFFER } = require("./config");

const MAX_LOG_LINES = LOG_BUFFER;
const logBuffer = [];
let _onLog = null;
let _headless = false;

function timestamp() {
  return `${c.dim}${new Date().toLocaleTimeString()}${c.reset}`;
}

function push(line) {
  logBuffer.push(line);
  if (logBuffer.length > MAX_LOG_LINES) logBuffer.shift();
  if (_headless) {
    const plain = c.stripAnsi(line);
    process.stdout.write(plain + "\n");
  }
  if (_onLog) _onLog(line);
}

function format(tag, color, msg) {
  return `${timestamp()} ${color}[${tag}]${c.reset} ${msg}`;
}

const log = {
  buffer: logBuffer,
  onLog(fn) { _onLog = fn; },
  setHeadless(v) { _headless = v; },
  server: (msg) => push(format("SERVER", c.cyan, msg)),
  discord: (msg) => push(format("DISCORD", c.magenta, msg)),
  game: (msg) => push(format("GAME", c.green, msg)),
  lever: (name, on, source, user) => {
    const src = source ? `${c.dim}(${source})${c.reset} ` : "";
    const who = user ? `${c.bold}${user}${c.reset} ` : "";
    push(format("LEVER", c.yellow, `${src}${who}${name} ${on ? `${c.bgGreen}${c.bold} ON ${c.reset}` : `${c.bgRed}${c.bold} OFF ${c.reset}`}`));
  },
  error: (tag, msg) =>
    push(format(tag, c.red, `${c.red}${msg}${c.reset}`)),
  ws: (msg) => push(format("WS", c.blue, msg)),
  config: (msg) => push(format("CONFIG", c.yellow, msg)),
};

module.exports = log;
