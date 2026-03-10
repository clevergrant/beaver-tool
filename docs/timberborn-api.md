# Timberborn API Guide

> Source: <https://timberborn.io/>

Timberborn includes two automation objects that you can interact with via API once built:

1. An **HTTP Lever** which allows you to control in-game objects from the outside world.
2. An **HTTP Adapter** which allows you to control the outside world from within the game.

## Technicalities

- Use GET or POST requests with no request body.
- Object names must be URL-encoded, so `HTTP Lever 1` becomes `HTTP%20Lever%201`.
- The API binds to localhost for security reasons. If you know what you're doing and wish to make it accessible from your local network or the internet, use a proxy service, such as Ngrok, Localtunnel, Cloudflare Tunnel, Pinggy.

> **Note:** The default port is `8080`. This project uses port `300` instead (configured in-game).

---

## HTTP Levers - Switch on/off

Switch on lever called `NAME`:

```
http://localhost:8080/api/switch-on/NAME
```

Switch off lever called `NAME`:

```
http://localhost:8080/api/switch-off/NAME
```

Example:

```
http://localhost:8080/api/switch-on/HTTP%20Lever%201
```

## HTTP Levers - Change color

Set color of lever `NAME` to `#RRGGBB`:

```
http://localhost:8080/api/color/NAME/RRGGBB
```

Example (red):

```
http://localhost:8080/api/color/HTTP%20Lever%201/ff0000
```

Example (green):

```
http://localhost:8080/api/color/HTTP%20Lever%201/00ff00
```

## HTTP Levers - List all

List all levers:

```
http://localhost:8080/api/levers
```

Example response:

```json
[
  {
    "name": "HTTP Lever 1",
    "state": true,
    "springReturn": true
  },
  {
    "name": "HTTP Lever 2",
    "state": false,
    "springReturn": false
  }
]
```

## HTTP Levers - Get a lever

Get lever called `NAME`:

```
http://localhost:8080/api/levers/NAME
```

Example request:

```
http://localhost:8080/api/levers/HTTP%20Lever%201
```

Example response:

```json
{
  "name": "HTTP Lever 1",
  "state": true,
  "springReturn": false
}
```

---

## HTTP Adapters - List all

List all adapters:

```
http://localhost:8080/api/adapters
```

Example response:

```json
[
  {
    "name": "HTTP Adapter 1",
    "state": true
  },
  {
    "name": "HTTP Adapter 2",
    "state": false
  }
]
```

## HTTP Adapters - Get an adapter

Get adapter called `NAME`:

```
http://localhost:8080/api/adapters/NAME
```

Example request:

```
http://localhost:8080/api/adapters/HTTP%20Adapter%201
```

Example response:

```json
{
  "name": "HTTP Adapter 1",
  "state": true
}
```

---

## Other resources

- The official [Timberborn Modding Documentation](https://github.com/mechanistry/timberborn-modding/wiki).
- The official [Timberborn Discord Server](https://discord.com/invite/timberborn), your go-to place to get help from the devs, hang out with the community, and make beaverly new friends.
- [Play Timberborn on Steam](https://store.steampowered.com/app/1062090/Timberborn/)
