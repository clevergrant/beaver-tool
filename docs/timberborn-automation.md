# Timberborn 1.0 Automation System Reference

## Overview

Timberborn 1.0 (releasing March 12, 2026) introduces a signal-based automation system with 20+ new buildings. The system follows an input -> logic -> output architecture where sensors detect conditions, logic components process signals, and output devices respond.

Separately, the bot system (mechanized beavers) has existed since earlier updates and provides 24/7 workers.

---

## Automation Buildings

### Sensors (Signal Providers)

| Building | Cost (Folktails) | Cost (Iron Teeth) | Science | Size | Function |
|----------|-----------------|-------------------|---------|------|----------|
| **Lever** | 1 Plank, 2 Gears | same | 50 | 1x1 | Manual on/off toggle; pinnable to UI |
| **Chronometer** | 8 Planks, 6 Gears | same | 150 | 1x1 H2 | Signal based on time of day (custom range, work time, leisure time) |
| **Depth Sensor** | 4 Gears, 8 Scrap Metal | same | 200 | 1x2 H2 | Measures water depth below sensor arm |
| **Flow Sensor** | TBD | TBD | TBD | 1x1 H1 | Measures water flow speed |
| **Contamination Sensor** | TBD | TBD | TBD | TBD | Detects contamination levels in water |
| **Weather Station** | TBD | TBD | TBD | TBD | Detects weather state (drought, temperate, badtide) |
| **Power Meter** | TBD | TBD | TBD | TBD | Monitors power grid status |
| **Population Counter** | 2 Plank, 2 Gear, 1 Paper | 2 Plank, 2 Gear, 1 Metal Part | 200 | TBD | Counts district/global population by type (bots, unemployed, contaminated kits, etc.) |
| **Resource Counter** | 4 Plank, 4 Gear, 1 Paper | 4 Plank, 4 Gear, 1 Metal Part | 250 | TBD | Checks quantity or fill % of a good in the district |
| **Science Counter** | TBD | TBD | TBD | TBD | Monitors accumulated science points |

### Logic / Signal Processing

| Building | Cost | Science | Size | Function |
|----------|------|---------|------|----------|
| **Relay** | 1 Plank, 1 Gear | 80 | 1x1 H2 | Logic operations: NOT, AND, OR, XOR, Passthrough |
| **Timer** | 1 Treated Plank, 1 Metal Block | 600 | TBD | Delays signals, triggers oscillation; configurable reset |
| **Memory** | 1 Metal Block, 1 Extract | 100 | TBD | Stores signal state (latch/flip-flop behavior) |

### Output / Display Devices

| Building | Cost | Science | Function |
|----------|------|---------|----------|
| **Indicator** | 2 Scrap Metal, 1 Pine Resin | 400 | Large light-up display; pinnable to UI; can add journal entries or show warnings |
| **Speaker** | 4 Planks, 2 Gears, 4 Metal Blocks | 500 | Plays sounds/music (supports custom audio); local or global playback |
| **Firework Launcher** | 1 Gear, 2 Treated Planks | 700 | Launches fireworks with customizable style and frequency |
| **Detonator** | 1 Metal Block, 1 Explosives, 1 Extract | 1400 | Triggers connected Dynamite when signal received |

### Infrastructure (Automated Control)

| Building | Cost | Science | Function |
|----------|------|---------|----------|
| **Gate** | 6 Plank, 4 Gear, 4 Scrap Metal | 200 | Cuts off settlement sections manually or via signal |
| **Valve** | 5 Plank, 5 Metal Block | 400 | Regulates water flow limit; replaces old Sluice; automatable |
| **Clutch** | 2 Gear, 6 Metal Block | 400 | Connects/disconnects power network segments via signal |

### HTTP / External Integration

| Building | Function |
|----------|----------|
| **HTTP Lever** | Accepts signals FROM external systems via HTTP API |
| **HTTP Adapter** | Exposes in-game signal state TO external systems; makes webhook calls |

---

## HTTP API (Built-in, localhost:8080)

The game exposes a REST API at `http://localhost:8080/api/` with **no authentication required**.

### HTTP Lever Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/levers` | GET | List all HTTP Levers |
| `GET /api/levers/{NAME}` | GET | Get specific lever state (`{ name, state: bool, springReturn: bool }`) |
| `GET/POST /api/switch-on/{NAME}` | GET/POST | Turn lever on |
| `GET/POST /api/switch-off/{NAME}` | GET/POST | Turn lever off |
| `GET/POST /api/color/{NAME}/{RRGGBB}` | GET/POST | Change lever color (hex RGB) |

### HTTP Adapter Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/adapters` | GET | List all HTTP Adapters |
| `GET /api/adapters/{NAME}` | GET | Get specific adapter state (`{ name, state: bool }`) |

### Notes
- No request body support -- all data is in the URL
- Names must be URL-encoded (spaces = `%20`)
- Adapters are read-only (reflect in-game signal state)
- HTTP Levers are write-capable (control in-game signals from outside)
- No authentication required (localhost only)

---

## Bot System

### Overview

Bots are mechanized beavers that work 24/7. They are NOT affected by Working Hours or Well-Being. They have a "Condition" stat instead of well-being and a fixed **70-day lifespan** (durability declines from 100% to 0%).

### Faction-Specific Bot Types

| Attribute | Timberbots (Folktails) | Ironbots (Iron Teeth) |
|-----------|----------------------|---------------------|
| **Energy Source** | Biofuel (consumed from tanks) | Electricity (Charging Stations) |
| **Boost 1** | Catalysts | Grease |
| **Boost 2** | Punchcards | Control Tower radius (10 tiles) |
| **Max Boost** | +80% movement, +120% work speed | +80% movement, +120% work speed |
| **Out of fuel** | Refuse to work, -75% move speed | Refuse to work, -75% move speed |

### Bot Production Chain

#### Bot Part Factory
- **Size**: 3x3 H2 | **Workers**: 1 | **Power**: 150 hp | **Science**: 500
- **Build Cost**: 50 Planks, 25 Gears, 15 Metal Blocks

| Part | Inputs | Time |
|------|--------|------|
| Bot Chassis (Folktails) | 5 Planks + 1 Metal Block + 1 Biofuel | 18 units |
| Bot Chassis (Iron Teeth) | 5 Planks + 1 Metal Block | 18 units |
| Bot Head | 3 Gears + 1 Metal Block + 1 Plank | 18 units |
| Bot Limb | 3 Gears + 1 Plank | 4.5 units |

#### Bot Assembler
- **Size**: 3x3 H1 | **Workers**: 2 | **Power**: 250 hp | **Science**: 750
- **Build Cost**: 100 Planks, 50 Gears, 50 Metal Blocks
- **Recipe**: 1 Chassis + 1 Head + 4 Limbs = 1 Bot (36 hours)
- **Internal Storage**: 2 Chassis, 2 Heads, 8 Limbs
- **Optimal ratio**: 3 Bot Part Factories to 2 Bot Assemblers

### Bot Infrastructure

#### Charging Station (Iron Teeth only)
- **Size**: 1x1 H2 | **Power**: 50 hp (constant) | **Science**: 200
- **Build Cost**: 5 Planks, 15 Gears, 5 Metal Blocks
- **Capacity**: 1 bot at a time

#### Biofuel Tanks (Folktails only)
- **Capacity**: 400 Biofuel
- Bots visit to refuel; place near workplaces

#### Control Tower (Iron Teeth only)
- **Size**: 1x1 H7 | **Science**: 1000
- **Build Cost**: 20 Planks, 15 Gears
- **Radius**: 10 tiles | **Upkeep**: 3 Science/hour
- **Effect**: Increases bot Condition by 1
- No workers, power, or path required; works submerged

### Bot Workplaces (36+ confirmed)
Bots can work in: Aquatic Farmhouse, Bot Assembler, Bot Part Factory, Builders' Hut, District Center, District Crossing, Hauling Post, Mine, Smelter, Scavenger Flag, Farmhouse, Grill, Gristmill, Bakery, Lumberjack Flag, Lumber Mill, Forester, Gear Workshop, Paper Mill, Printing Press, Wood Workshop, Observatory, Explosives Factory, Dirt Excavator, Water Pump, Large Water Pump, Deep Water Pump, Badwater Pump, Deep Badwater Pump, Fluid Dump, Centrifuge, Badwater Rig, Herbalist, Grease Factory (IT only), and more.

---

## Save File Format

- **Extension**: `.timber`
- **Format**: ZIP archive containing `world.json`
- **Content**: Human-readable JSON, not obfuscated
- **Location (Windows)**: `%USERPROFILE%\Documents\Timberborn\Saves`

### JSON Structure
- `GameVersion`: `"vYYYYMMDD-hhhhhhh-aa"`
- `Timestamp`: `"YYYYMMDD HH:MM:SS"`
- `Singletons`: 28 categories (MapSize, TerrainMap, WaterMap, DayNightCycle, WeatherService, DroughtService, ScienceService, FactionService, etc.)
- `Entities`: All game objects (buildings, beavers, bots, trees, etc.)

### Editing
1. Backup the `.timber` file
2. Unzip with any ZIP tool
3. Edit `world.json`
4. Re-zip and rename back to `.timber`
5. Invalid JSON will crash game on load

### Unofficial Save Editor
Web-based: https://charperbonaroo.github.io/timberborn-save-editor/
Source: https://github.com/charperbonaroo/timberborn-save-editor

---

## Modding Ecosystem

### Official Modding
- **Repo**: https://github.com/mechanistry/timberborn-modding
- **Engine**: Unity (C#)
- **DI Framework**: Bindito (`IConfigurator` implementations)
- **Contexts**: MainMenu, Game, MapEditor
- **Mod loading**: All DLLs in mod folder auto-loaded at launch
- **AssetBundles**: Auto-loaded from `AssetBundles/` subfolder

### Community Tools
- **TimberAPI**: https://github.com/Timberborn-Modding-Central/TimberAPI (docs: https://timberapi.com/)
- **BepInEx**: Unity modding framework, preconfigured for Timberborn
- **Distribution**: mod.io and Thunderstore

### Reference Projects
- **timberborn-bad-apple**: https://github.com/BatterySmooth/timberborn-bad-apple -- Uses HTTP Levers + Indicators to play video in-game via external .NET server

---

## Sources

- [Official Timberborn Wiki - Automation](https://timberborn.wiki.gg/wiki/Category:Automation)
- [Official Timberborn Wiki - Bots](https://timberborn.wiki.gg/wiki/Category:Bots)
- [Timberborn HTTP API](https://timberborn.io/)
- [Official Modding Repository](https://github.com/mechanistry/timberborn-modding)
- [Steam Announcements](https://store.steampowered.com/news/app/1062090)
- [Unofficial Save Editor](https://charperbonaroo.github.io/timberborn-save-editor/)
