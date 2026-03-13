# Timberborn Tool

A web interface and CLI for controlling your beaver colony in [Timberborn](https://timberborn.io/) via the game's built-in HTTP API.

## How It Works

Timberborn 1.0 exposes a REST API at `http://localhost:8080/api/` (or whichever port you set on the in-game UI) through two in-game automation buildings:

- **HTTP Lever** -- receive commands from external systems (toggle signals on/off)
- **HTTP Adapter** -- expose in-game signal states to external systems (read-only)

This tool connects to that API to monitor and control your colony's automation systems from a browser, the CLI, or Discord.

## Setup - User

### Windows Installer

A standalone Windows installer is available on the [Releases](https://github.com/clevergrant/beaver-tool/releases) page. It bundles Node.js and adds the `tb` command to your PATH.

## API Reference

- [docs/timberborn-api.md](docs/timberborn-api.md) -- official HTTP API guide (from [timberborn.io](https://timberborn.io/))
- [docs/timberborn-automation.md](docs/timberborn-automation.md) -- full automation system reference (buildings, bots, save format, modding)

## Setup - Developer

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Bun](https://bun.sh/) v1.3+ (optional -- used for the frontend build and dev server; falls back to Node if unavailable)
- Timberborn running with HTTP Lever / HTTP Adapter buildings placed

### Install

```bash
git clone https://github.com/clevergrant/beaver-tool.git
cd beaver-tool
npm install
```

### Configure

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

| Variable | Default | Description |
| --- | --- | --- |
| `TB_PORT` | `80` | Port for the web interface |
| `TB_GAME_API` | `http://localhost:8080/api` | Timberborn's HTTP API URL |
| `DISCORD_BOT_TOKEN` | *(empty)* | Optional Discord bot token for DM control |

### Run

```bash
# Development (with HMR)
npm run dev

# Production
npm run build
npm run start

# Or use the CLI
beavers start    # start as background daemon
beavers live     # full-screen TUI dashboard
beavers stop     # stop the daemon
```

Then open `http://localhost` (or your configured port) in a browser.

### Project Structure

```text
src/
  server.ts          # Backend entry point (compiled with tsc)
  bin/tb.ts          # CLI entry point
  lib/               # Shared backend modules
  public/            # Frontend (bundled by Bun)
    index.html
    js/              # TypeScript modules (app, store, grid, etc.)
    css/             # Global styles
    components/      # Web components (co-located .ts + .scss)
      surface/       # Surface components (LED, toggle, dial, etc.)
```

The backend is compiled with `tsc` to `build/` and the frontend is bundled separately by Bun (via `run-bun.js`, which falls back gracefully when Bun isn't in PATH).

## License

[MIT](LICENSE)
