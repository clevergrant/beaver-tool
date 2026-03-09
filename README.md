# Timberborn Colony Web Interface

A website for interacting with your beaver colony in Timberborn via the game's built-in HTTP API.

## How It Works

Timberborn 1.0 exposes a REST API at `http://localhost:8080/api/` through two in-game automation buildings:

- **HTTP Lever** -- receive commands from external systems (toggle signals on/off)
- **HTTP Adapter** -- expose in-game signal states to external systems (read-only)

This web interface connects to that API to monitor and control your colony's automation systems from a browser.

## API Reference

See [docs/timberborn-automation.md](docs/timberborn-automation.md) for the full automation system reference including:
- All automation buildings (sensors, logic, outputs)
- HTTP API endpoints
- Bot system details
- Save file format
- Modding ecosystem
