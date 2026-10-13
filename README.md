# SmartIRI IoT Console

A modern, dark-first IoT command center for **ChirpStack v4**. It has its own design rather than ChirpStack's UI: glass cards, gradient accents, a network-health hero, live sensor tiles with sparklines, and a device fleet card grid. It shows device and network data clearly and covers the core management tasks.

It runs in two modes:

| Mode | What it talks to | Use it for |
|------|------------------|------------|
| **Demo** | An in-browser ChirpStack simulator. It serves the same REST routes and JSON as `chirpstack-rest-api`, plus live uplinks, joins and status reports | Showing the product, UI work, offline demos |
| **Live** | A real ChirpStack: REST via `chirpstack-rest-api`, and gRPC-web for live device events and summaries | Operating a real network |

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173 → click "Launch demo"
```

`npm run build` type-checks the project and builds `dist/`. Use `npm run preview` to serve that build.

## Features

The console focuses on clear visualization plus the core management tasks. Advanced ChirpStack features (API keys, regions, device catalog, multicast, integrations, downlink queue, raw frames) are deliberately left out.

**Monitor**
- **Overview:**
  - a network-health score with device, gateway and link-quality rings
  - a live event-rate strip
  - KPI cards with trend lines (uplinks, downlinks, active devices, battery)
  - a fleet-wide sensor snapshot (temperature, humidity, CO₂, power, air quality and more, each with a 24 h trend)
  - a traffic chart and a top-gateways ranking
  - a coverage map, a live activity timeline, a per-application breakdown, a data-rate mix and a "needs attention" list
- **Live stream:** every uplink, join, status report and alert as it happens, with decoded values and a JSON inspector.
- **Map:** gateways by status, with live tracker positions.

**Fleet**
- **Devices:** card grid or table with status filters. Each device page has a dashboard (latest readings, measurement and signal charts), live data, and settings (profile, enabled, tags, OTAA join key).
- **Gateways:** status tiles, list or map, a dashboard with RX/TX charts, and settings (name, location, tags).
- **Applications:** device stats and device cards, plus settings.
- **Device profiles:** cards showing capabilities and usage. The editor has three tabs: General (region, LoRaWAN version, OTAA, Class B/C), Payload decoder and Measurements.

**Organization**
- **Team:** members of the current workspace and their permissions.
- **Workspaces:** cards per workspace with device and gateway health. Create, edit and switch between them.
- **Users:** accounts, roles and passwords.

**Other**
- Global search (⌘K), dark, light or system theme, and a responsive layout down to phone width.

## Connecting to a real ChirpStack

The console needs two endpoints:

1. **`chirpstack-rest-api`** (REST, default port `8090`) for all CRUD and metrics:
   ```bash
   docker run -p 8090:8090 chirpstack/chirpstack-rest-api:4 \
     --server chirpstack:8080 --bind 0.0.0.0:8090 --insecure --cors '*'
   ```
2. **ChirpStack itself** (gRPC-web, default port `8080`), for the calls the REST proxy does not expose: live device events, device/gateway summaries, login and search. ChirpStack serves gRPC-web natively, which is how its own UI works.

On the login screen, choose **Connect** and enter:
- **REST API URL**, e.g. `http://localhost:8090`
- **gRPC-web URL**, e.g. `http://localhost:8080`
- an **API token** (create one in ChirpStack under *API keys*), or log in with e-mail and password.
- *Tenant ID*: only needed for tenant-scoped API keys, which cannot list tenants.

### Avoiding CORS

Leave both URLs empty to use same-origin requests. The dev server and `vite preview` then proxy them:

```bash
cp .env.example .env.local   # set CHIRPSTACK_REST_URL / CHIRPSTACK_GRPC_URL
npm run dev
```

| Path | Proxied to |
|------|------------|
| `/api/*` | `CHIRPSTACK_REST_URL` |
| `/api.InternalService/*` | `CHIRPSTACK_GRPC_URL` |

For production, put the same two rules in your reverse proxy (nginx, Caddy, Traefik) in front of `dist/`.

## Project layout

```
src/
  api/          REST client (chirpstack.ts), gRPC-web internal service (internal.ts), types
  mock/         demo simulator: seed data, REST route handlers, metrics, live traffic
  components/   UI kit, charts, data table, maps, live log stream, forms
  pages/        one file per screen
  context/      session (connection + tenant), theme, toasts
  lib/          config, formatting, constants, hooks
```

Demo data lives in your browser's localStorage. Reset it under **Connection → Reset demo data**.
