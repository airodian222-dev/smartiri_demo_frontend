# SmartIRI IoT Console

A modern, dark-first IoT command center for **ChirpStack v4**. It has its own design rather than ChirpStack's UI: glass cards, gradient accents, a network-health hero, live sensor tiles with sparklines, and a device fleet card grid. It shows all device and network data, and it covers the ChirpStack web-UI features, from tenants down to individual LoRaWAN frames.

It runs in two modes:

| Mode | What it talks to | Use it for |
|------|------------------|------------|
| **Demo** | An in-browser ChirpStack simulator. It serves the same REST routes and JSON as `chirpstack-rest-api`, plus live uplinks, joins, downlinks and frames | Showing the product, UI work, offline demos |
| **Live** | A real ChirpStack: REST via `chirpstack-rest-api`, and gRPC-web for the internal service (streams, API keys, regions, summaries) | Operating a real network |

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173 → click "Launch demo"
```

`npm run build` type-checks the project and builds `dist/`. Use `npm run preview` to serve that build.

## Features

**Dashboards**
- Tenant dashboard: device and gateway status, uplink totals, network traffic (RX/TX), data-rate usage, a gateway map with live tracker positions, a live event feed, and a "needs attention" list (silent devices, low battery, weak link margin).
- Network-server overview across all tenants.
- Live events page with filters by event type and application, plus a JSON inspector.
- Network map.

**Devices** (mirrors ChirpStack's device pages)
- List devices across all applications, with status, battery, link margin and last-seen filters.
- Dashboard: latest decoded uplink, receiving gateways (RSSI/SNR), measurement charts from the device profile, and link metrics (received, RSSI, SNR, per frequency, per DR, errors). Time ranges are 1 h, 24 h, 31 d and 1 y.
- Configuration: profile, JoinEUI, disable the device, skip the frame-counter check, tags and variables.
- OTAA keys: LoRaWAN 1.0.x and 1.1, generate, MSB/LSB order, flush dev-nonces.
- Activation: view the OTAA session; activate or deactivate ABP with a random DevAddr.
- Downlink queue: enqueue HEX, Base64 or JSON (via the codec), confirmed or unconfirmed, and flush.
- Live **Events** (up/join/status/ack/txack/log) and **LoRaWAN frames** streams, with pause and JSON download.

**Gateways**
- List and map, RX/TX metrics (per frequency, DR and TX status), configuration with location and tags, TLS client certificates, and live frames.

**Applications**
- Devices, configuration, multicast groups (devices, gateways, queue), and integrations: HTTP, InfluxDB, ThingsBoard, myDevices, GCP Pub/Sub, AWS SNS, Azure Service Bus, Pilot Things, IFTTT, Blynk, plus MQTT client certificates.

**Device profiles and templates**
- General, Join (OTAA/ABP), Class-B, Class-C, codec (JS / Cayenne LPP), measurements and tags. A new profile can be created from a device-profile template.

**Administration**
- Tenants, users (including passwords), tenant users and permissions, admin and tenant API keys, and regions.
- Global search across devices, gateways, applications and tenants.
- Light and dark themes, responsive down to phone width.

## Connecting to a real ChirpStack

The console needs two endpoints:

1. **`chirpstack-rest-api`** (REST, default port `8090`) for all CRUD and metrics:
   ```bash
   docker run -p 8090:8090 chirpstack/chirpstack-rest-api:4 \
     --server chirpstack:8080 --bind 0.0.0.0:8090 --insecure --cors '*'
   ```
2. **ChirpStack itself** (gRPC-web, default port `8080`), for the calls the REST proxy does not expose: live event and frame streams, API keys, regions, device/gateway summaries, login and search. ChirpStack serves gRPC-web natively, which is how its own UI works.

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
