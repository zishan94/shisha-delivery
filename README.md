# 💨 Shisha Delivery

A full-featured delivery app for shisha tobacco — built with Expo, React Native, Express, and SQLite.

## Features

- **3 User Roles:** Consumer, Approver, Driver
- **Phone auth** (demo mode — any 6-digit code works)
- **Real-time** order updates, driver tracking, and chat via WebSocket
- **Maps** with OpenStreetMap tiles and OSRM routing
- **Beautiful dark theme** with gradient accents
- **Production-quality** code — TypeScript throughout

## Quick Start

### 1. Install dependencies

```bash
# App dependencies
npm install

# Server dependencies
cd server && npm install && cd ..
```

### 2. Start the backend

```bash
cd server
npx ts-node index.ts
```

Server runs on `http://localhost:3001`. SQLite DB auto-creates with seed data (5 products, demo users).

### 3. Start the Expo app

```bash
npx expo start
```

Press `w` for web, `a` for Android, or `i` for iOS.

### 4. Demo Login

1. Enter any phone number (e.g., `+41791111111`)
2. Enter any 6-digit code (e.g., `123456`)
3. Choose your role: Consumer, Approver, or Driver

**Pre-seeded accounts:**
- `+41791234567` — Demo Approver
- `+41791234568` — Demo Driver

## Architecture

```
shisha-delivery/
├── app/                  # Expo Router screens
│   ├── (auth)/          # Login + setup
│   ├── consumer/        # Browse, order, track
│   ├── approver/        # Pending, active, map
│   └── driver/          # Deliveries, route, map
├── components/          # Reusable UI components
├── contexts/            # Auth, Socket, Location
├── hooks/               # useApi, useOSRM
├── constants/           # Theme, config
└── server/              # Express + Socket.io + SQLite
    ├── index.ts         # Server entry
    ├── db.ts            # Database + seed data
    └── routes/          # REST API endpoints
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/request-code` | Request SMS code (demo) |
| POST | `/api/auth/verify` | Verify code + login |
| POST | `/api/auth/profile` | Set name + role |
| GET | `/api/products` | List products |
| POST | `/api/orders` | Create order |
| GET | `/api/orders/pending` | Pending orders |
| GET | `/api/orders/active` | Active orders |
| POST | `/api/orders/:id/approve` | Approve order |
| POST | `/api/orders/:id/reject` | Reject order |
| POST | `/api/orders/batch-approve` | Batch approve |
| POST | `/api/orders/:id/assign` | Assign driver |
| POST | `/api/orders/:id/delivering` | Start delivery |
| POST | `/api/orders/:id/delivered` | Complete delivery |
| GET/POST | `/api/messages` | Chat messages |
| POST | `/api/drivers/location` | Update driver GPS |

## WebSocket Events

- `order:created` / `order:new` — New order notifications
- `order:status` / `order:updated` — Status changes
- `driver:location` / `driver:location-update` — GPS tracking
- `chat:message` / `chat:new-message` — Real-time chat
- `notification` — In-app push notifications

## Tech Stack

- **Frontend:** Expo SDK 52, React Native, TypeScript, Expo Router
- **Backend:** Express.js, Socket.io, better-sqlite3
- **Maps:** react-native-maps + OpenStreetMap tiles
- **Routing:** OSRM (router.project-osrm.org)
- **UI:** expo-linear-gradient, react-native-reanimated
