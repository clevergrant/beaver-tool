const ANSI_RE = /\x1b\[[0-9;]*m/g;

module.exports = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgGreen: "\x1b[42m",
  bgRed: "\x1b[41m",
  bgWhite: "\x1b[47m",
  bgCyan: "\x1b[46m",
  inverted: "\x1b[7m",
  stripAnsi: (s) => s.replace(ANSI_RE, ""),
};
