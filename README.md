# Timberborn Colony Web Interface

A website for interacting with your beaver colony in [Timberborn](https://timberborn.io/) via the game's built-in HTTP API.

## How It Works

Timberborn 1.0 exposes a REST API at `http://localhost:8080/api/` through two in-game automation buildings:

- **HTTP Lever** -- receive commands from external systems (toggle signals on/off)
- **HTTP Adapter** -- expose in-game signal states to external systems (read-only)

This web interface connects to that API to monitor and control your colony's automation systems from a browser.

## API Reference

- [docs/timberborn-api.md](docs/timberborn-api.md) -- official HTTP API guide (from [timberborn.io](https://timberborn.io/))
- [docs/timberborn-automation.md](docs/timberborn-automation.md) -- full automation system reference (buildings, bots, save format, modding)
