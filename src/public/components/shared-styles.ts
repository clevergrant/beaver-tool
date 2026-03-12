export function SCREW_STYLES(
  sel: string,
  bottomSel: string,
  { size = 8, offset = 6 }: { size?: number; offset?: number } = {}
): string {
  const center = Math.round(size * 0.375);
  return `
  ${sel}::before, ${sel}::after { content: ''; position: absolute; width: ${size}px; height: ${size}px; border-radius: 50%; background: radial-gradient(circle at ${center}px ${center}px, #aaa89e, #6a6860); box-shadow: inset 0 1px 2px rgba(0,0,0,0.5); z-index: 2; }
  ${sel}::before { top: ${offset}px; left: ${offset}px; }
  ${sel}::after { top: ${offset}px; right: ${offset}px; }
  ${bottomSel}::before, ${bottomSel}::after { content: ''; position: absolute; width: ${size}px; height: ${size}px; border-radius: 50%; background: radial-gradient(circle at ${center}px ${center}px, #aaa89e, #6a6860); box-shadow: inset 0 1px 2px rgba(0,0,0,0.5); }
  ${bottomSel}::before { bottom: ${offset}px; left: ${offset}px; }
  ${bottomSel}::after { bottom: ${offset}px; right: ${offset}px; }
  `;
}

export const PANEL_BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Russo+One&display=swap');
  :host { display: block; width: 100%; height: 100%; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .panel { position: relative; border-radius: 6px; padding: 1.2rem 1rem 1rem; box-shadow: 0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08); width: 100%; height: 100%; min-height: 0; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: 'Share Tech Mono', monospace; }
  ${SCREW_STYLES(".panel", ".panel-screws-bottom")}
  .dymo-label { background: #1a1a18; color: #e8e4d4; font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; padding: 0.2rem 0.6rem; border-radius: 2px; text-align: center; margin-bottom: 0.8rem; border: 1px solid #333; box-shadow: inset 0 1px 3px rgba(0,0,0,0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .type-badge { font-size: 0.5rem; font-family: 'Russo One', sans-serif; letter-spacing: 0.2em; text-transform: uppercase; padding: 0.15rem 0.6rem; border-radius: 2px; margin-bottom: 0.6rem; }
`;
