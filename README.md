# Timberborn Tool

A web interface and CLI for controlling your beaver colony in [Timberborn](https://timberborn.io/) via the game's built-in HTTP API.

## How It Works

Timberborn 1.0 exposes a REST API at `http://localhost:3000/api/` (or whichever port you set on the in-game UI) through two in-game automation buildings:

- **HTTP Lever** -- receive commands from external systems (toggle signals on/off)
- **HTTP Adapter** -- expose in-game signal states to external systems (read-only)

This tool connects to that API to monitor and control your colony's automation systems from a browser, the CLI, or Discord.

## Setup

### Windows Installer

A standalone Windows installer is available on the [Releases](https://github.com/clevergrant/beaver-tool/releases) page. It bundles Node.js and adds the `tb` command to your PATH.

## API Reference

- [docs/timberborn-api.md](docs/timberborn-api.md) -- official HTTP API guide (from [timberborn.io](https://timberborn.io/))
- [docs/timberborn-automation.md](docs/timberborn-automation.md) -- full automation system reference (buildings, bots, save format, modding)

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ (or use the Windows installer which bundles Node)
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
|---|---|---|
| `TB_PORT` | `8080` | Port for the web interface |
| `TB_GAME_API` | `http://localhost:3000/api` | Timberborn's HTTP API URL |
| `DISCORD_BOT_TOKEN` | *(empty)* | Optional Discord bot token for DM control |

### Run

```bash
# Start the server
npm start

# Or use the CLI
node bin/tb.js start    # start as background daemon
node bin/tb.js live     # full-screen TUI dashboard
node bin/tb.js stop     # stop the daemon
```

Then open `http://localhost:3000` (or your configured port) in a browser.

## License

[MIT](LICENSE)
