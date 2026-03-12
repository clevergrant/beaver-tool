const ANSI_RE = /\x1b\[[0-9;]*m/g;

export const reset = "\x1b[0m";
export const bold = "\x1b[1m";
export const dim = "\x1b[2m";
export const red = "\x1b[31m";
export const green = "\x1b[32m";
export const yellow = "\x1b[33m";
export const blue = "\x1b[34m";
export const magenta = "\x1b[35m";
export const cyan = "\x1b[36m";
export const white = "\x1b[37m";
export const bgGreen = "\x1b[42m";
export const bgRed = "\x1b[41m";
export const bgWhite = "\x1b[47m";
export const bgCyan = "\x1b[46m";
export const inverted = "\x1b[7m";
export const stripAnsi = (s: string): string => s.replace(ANSI_RE, "");

export function dot(on: boolean): string {
  return on ? `${green}\u25CF${reset}` : `${red}\u25CF${reset}`;
}

export function formatDeviceLine(name: string, type: string, on: boolean): string {
  return `  ${dot(on)} ${bold}${name}${reset} ${dim}(${type})${reset}`;
}
