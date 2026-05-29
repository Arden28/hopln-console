<div align="center">

# Hopln Console

**Internal administration dashboard for the Hopln transit platform.**

React 19 · TypeScript · TanStack Router · TanStack Query · Mapbox GL

---

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Mapbox](https://img.shields.io/badge/Mapbox_GL-3-000000?style=flat-square&logo=mapbox&logoColor=white)](https://mapbox.com)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Dev Commands](#dev-commands)
- [Router](#router)
- [Sidebar Sections](#sidebar-sections)
- [API Modules](#api-modules)
- [TypeScript Types](#typescript-types)
- [Store](#store)
- [Lib Utilities](#lib-utilities)
- [UI Components](#ui-components)
- [Packages](#packages)
- [Notes](#notes)

---

## Overview

Hopln Console is the back-office SPA for the Hopln system. Only users with role `moderator`, `admin`, or `superadmin` can access it — regular passenger accounts are blocked at the login screen.

The console is organised into six capability areas:

| Area | Sections | Purpose |
|------|----------|---------|
| **Data** | Contributions, Stops, Routes, Trips, Calendars | Manage the full GTFS dataset |
| **People** | Users | Search, inspect, ban/unban, award badges, adjust points |
| **Network** | Graph, Coverage, Desire Lines, Corridors, Transfer Graph, Snapshots, Scenarios, Variants | Visualise and plan the transit network |
| **Scheduling** | Timetable Editor, Scheduling Tools, Calendar Bulk | Build and edit service patterns and headways |
| **Operations** | GTFS, Data Quality, Shape Inspector, Duplicate Stops | Export, validate, and audit GTFS data |
| **Reach** | Analytics, Notifications | Measure usage and send broadcasts |

The console talks exclusively to the `hopln-api` Laravel backend. It has no direct database access.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Language | TypeScript 6 |
| Build tool | Vite 8 with `@tailwindcss/vite` plugin |
| Styling | Tailwind CSS v4 (CSS-first config, `@theme inline`) |
| UI components | shadcn/ui — New York style, Zinc base |
| Routing | TanStack Router v1 (code-based route tree) |
| Server state | TanStack Query v5 |
| Client state | Zustand v5 with `persist` middleware |
| HTTP client | Axios with Bearer token and 401 auto-redirect interceptors |
| Maps | Mapbox GL JS v3 + react-map-gl v8 |
| Charts | Recharts v3 |
| Toasts | Sonner v2 |
| Date utils | date-fns v4 |
| Forms | react-hook-form v7 + Zod v4 |
| Icons | lucide-react |

---

## Project Structure

```
src/
├── api/
│   ├── client.ts           # Axios instance — Bearer token + 401 interceptor
│   ├── auth.ts             # login / logout
│   ├── dashboard.ts        # KPIs, activity feed, system health
│   ├── users.ts            # User CRUD, ban, points, badges
│   ├── contributions.ts    # Contribution review workflow
│   ├── stops.ts            # Stop CRUD
│   ├── routes.ts           # Route CRUD
│   ├── trips.ts            # Trip + stop-time CRUD
│   ├── calendars.ts        # Service calendars + exceptions
│   ├── analytics.ts        # Chart data and KPIs
│   ├── otp.ts              # OTP routing engine status + sync
│   ├── network.ts          # Graph, coverage, desire lines, corridors, snapshots, scenarios, variants
│   ├── timetable.ts        # Timetable data + headway optimizer
│   ├── scheduling.ts       # Block builder, layover planner, time-space diagram
│   └── quality.ts          # Quality score, shape inspector, duplicate stops, snap, export-as
├── components/
│   ├── app-sidebar.tsx     # Navigation sidebar with section groups
│   ├── nav-main.tsx        # Collapsible section nav items
│   ├── nav-secondary.tsx   # Bottom secondary links
│   ├── nav-user.tsx        # User dropdown in sidebar footer
│   └── ui/                 # shadcn/ui components (30+)
├── hooks/
│   └── use-mobile.ts       # Responsive breakpoint hook (768 px)
├── lib/
│   ├── utils.ts            # cn, formatDate, formatDateTime, timeAgo, formatNumber
│   └── queryClient.ts      # TanStack Query client (staleTime 30s)
├── pages/
│   ├── auth/               # LoginPage
│   ├── dashboard/          # DashboardPage
│   ├── contributions/      # ContributionsPage, ContributionDetailPage
│   ├── users/              # UsersPage, UserDetailPage
│   ├── stops/              # StopsPage, StopEditorPage, DuplicateDetectorPage
│   ├── routes/             # RoutesPage, RouteEditorPage
│   ├── trips/              # TripsPage, TripEditorPage
│   ├── calendars/          # ServiceCalendarsPage, ServiceCalendarEditorPage, CalendarBulkEditorPage
│   ├── analytics/          # AnalyticsPage
│   ├── notifications/      # NotificationsPage
│   ├── settings/           # SettingsPage
│   ├── gtfs/               # GtfsPage (export, validate, official validator)
│   ├── network/            # NetworkHubPage, NetworkGraphPage, NetworkCoveragePage,
│   │                       #   DesireLinesPage, CorridorDesignerPage, TransferGraphPage,
│   │                       #   NetworkSnapshotsPage, ScenariosPage, ScenarioEditorPage,
│   │                       #   RouteVariantsPage
│   ├── timetable/          # TimetableEditorPage
│   ├── scheduling/         # SchedulingPage (block builder, layover planner, time-space diagram)
│   └── quality/            # DataQualityPage, ShapeInspectorPage
├── router.tsx              # Full TanStack Router route tree
├── store/
│   └── authStore.ts        # Zustand auth store (persisted)
├── types/
│   └── index.ts            # All shared TypeScript interfaces
├── index.css               # Tailwind v4 theme + CSS custom properties
└── main.tsx                # React root + QueryClientProvider + RouterProvider
```

---

## Setup

```bash
cd console
npm install
```

Copy `.env.example` to `.env` and fill in the two required variables (see below).

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Base URL of the `hopln-api` backend, e.g. `http://localhost:8000/api` |
| `VITE_MAPBOX_TOKEN` | Yes | Mapbox public token — map tiles + geocoding in stop / shape editors |

When `VITE_API_URL` is not set the Axios client defaults to `/api` and relies on the Vite dev-server proxy (`/api → http://localhost:8000`).

**Vite proxy** (`vite.config.ts`):
```ts
server: {
  port: 5173,
  proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } },
}
```

---

## Dev Commands

```bash
npm run dev        # Vite dev server → http://localhost:5173
npm run build      # TypeScript compile + Vite production build → dist/
npm run preview    # Serve the production build locally
npm run lint       # ESLint
npx tsc --noEmit   # Type-check without emitting
```

---

## Router

Built with **TanStack Router v1** (code-based, not file-based). The full route tree lives in `src/router.tsx`.

### Route Tree

```
rootRoute  (Outlet)
├── /login                         loginRoute               — public; redirects to / if authenticated
└── [protected]                    protectedRoute           — redirects to /login if unauthenticated
                                                              or role ∉ {moderator,admin,superadmin}
    ├── /                          dashboardRoute           — DashboardPage
    │
    ├── /users                     usersRoute               — UsersPage
    ├── /users/$id                 userDetailRoute          — UserDetailPage
    │
    ├── /contributions             contributionsRoute       — ContributionsPage
    ├── /contributions/$id         contributionDetail       — ContributionDetailPage
    │
    ├── /stops                     stopsRoute               — StopsPage
    ├── /stops/new                 stopNewRoute             — StopEditorPage (create)
    ├── /stops/$id/edit            stopEditRoute            — StopEditorPage (edit)
    ├── /stops/duplicates          duplicateStopsRoute      — DuplicateDetectorPage
    │
    ├── /routes                    routesRoute              — RoutesPage
    ├── /routes/new                routeNewRoute            — RouteEditorPage (create)
    ├── /routes/$id/edit           routeEditRoute           — RouteEditorPage (edit)
    │
    ├── /trips                     tripsRoute               — TripsPage
    ├── /trips/new                 tripNewRoute             — TripEditorPage (create)
    ├── /trips/$id/edit            tripEditRoute            — TripEditorPage (edit)
    │
    ├── /calendars                 calendarsRoute           — ServiceCalendarsPage
    ├── /calendars/new             calendarNewRoute         — ServiceCalendarEditorPage (create)
    ├── /calendars/$id/edit        calendarEditRoute        — ServiceCalendarEditorPage (edit)
    ├── /calendars/bulk            calendarBulkRoute        — CalendarBulkEditorPage
    │
    ├── /analytics                 analyticsRoute           — AnalyticsPage
    ├── /notifications             notificationsRoute       — NotificationsPage
    ├── /settings                  settingsRoute            — SettingsPage
    │
    ├── /gtfs                      gtfsRoute                — GtfsPage (export + validator)
    │
    ├── /network                   networkHubRoute          — NetworkHubPage
    ├── /network/graph             networkGraphRoute        — NetworkGraphPage
    ├── /network/coverage          networkCoverRoute        — NetworkCoveragePage
    ├── /network/desire-lines      desireLinesRoute         — DesireLinesPage
    ├── /network/corridors         corridorsRoute           — CorridorDesignerPage
    ├── /network/transfer-graph    transferGraphRoute       — TransferGraphPage
    ├── /network/snapshots         snapshotsRoute           — NetworkSnapshotsPage
    ├── /network/scenarios         scenariosRoute           — ScenariosPage
    ├── /network/scenarios/$id     scenarioEditRoute        — ScenarioEditorPage
    ├── /network/variants          variantsRoute            — RouteVariantsPage
    │
    ├── /timetable                 timetableRoute           — TimetableEditorPage
    ├── /scheduling                schedulingRoute          — SchedulingPage
    │
    ├── /quality                   dataQualityRoute         — DataQualityPage
    └── /quality/shapes            shapeInspectorRoute      — ShapeInspectorPage
```

### Auth Guard Logic

`protectedRoute.beforeLoad` reads `useAuthStore.getState()` synchronously (Zustand static `.getState()` — safe outside React). Two conditions each throw `redirect({ to: "/login" })`:

1. `!isAuthenticated` — no token or session expired
2. `user.role` not in `["moderator", "admin", "superadmin"]`

`loginRoute.beforeLoad` performs the inverse: already authenticated → redirect to `/`.

### `useParams` Pattern

Pages reading `$id` segments use `strict: false` to avoid the `Invariant failed` error during navigation transitions:

```ts
const params = useParams({ strict: false }) as { id?: string };
```

---

## Sidebar Sections

The sidebar (`src/components/app-sidebar.tsx`) groups navigation into sections. Each item maps to a route above.

| Section | Items |
|---------|-------|
| **Overview** | Dashboard |
| **Data** | Contributions *(with pending badge)*, Stops, Routes, Trips, Calendars |
| **People** | Users |
| **Network** | Graph View, Coverage, Desire Lines, Corridors, Transfer Graph, Snapshots, Scenarios, Variants |
| **Scheduling** | Timetable Editor, Scheduling Tools, Calendar Bulk |
| **Operations** | GTFS, Data Quality, Shape Inspector, Duplicate Stops |
| **Reach** | Analytics, Notifications |

The pending contributions badge on the Contributions item is driven by `GET /v1/console/dashboard` polled every 30 seconds.

---

## API Modules

All modules import from `./client` (the shared Axios instance). Responses are typed against interfaces in `src/types/index.ts`.

### `api/client.ts`

```ts
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});
```

**Request interceptor**: reads Bearer token from `localStorage["hopln_console_token"]`.

**Response interceptor**: on 401, clears localStorage and navigates to `/login`.

---

### `api/auth.ts`

| Function | Method | Endpoint |
|----------|--------|----------|
| `login(email, password)` | POST | `/v1/auth/login` |
| `logout()` | POST | `/v1/auth/logout` |

---

### `api/dashboard.ts`

| Function | Method | Endpoint |
|----------|--------|----------|
| `fetchOverview()` | GET | `/v1/console/dashboard` |
| `fetchActivity()` | GET | `/v1/console/activity` |
| `fetchSystemHealth()` | GET | `/v1/console/system-health` |

---

### `api/users.ts`

| Function | Method | Endpoint |
|----------|--------|----------|
| `fetchUsers(filters)` | GET | `/v1/console/users` |
| `fetchUser(id)` | GET | `/v1/console/users/:id` |
| `updateUser(id, data)` | PATCH | `/v1/console/users/:id` |
| `banUser(id, reason)` | POST | `/v1/console/users/:id/ban` |
| `unbanUser(id)` | POST | `/v1/console/users/:id/unban` |
| `adjustPoints(id, points, reason)` | PATCH | `/v1/console/users/:id/points` |
| `awardBadge(userId, badgeId)` | POST | `/v1/console/users/:userId/badges` |
| `revokeBadge(userId, badgeId)` | DELETE | `/v1/console/users/:userId/badges/:badgeId` |

---

### `api/contributions.ts`

| Function | Method | Endpoint |
|----------|--------|----------|
| `fetchContributions(filters)` | GET | `/v1/console/contributions` |
| `fetchContribution(id)` | GET | `/v1/console/contributions/:id` |
| `approveContribution(id)` | POST | `/v1/console/contributions/:id/approve` |
| `declineContribution(id, reason)` | POST | `/v1/console/contributions/:id/decline` |
| `bulkApprove(ids)` | POST | `/v1/console/contributions/bulk-approve` |
| `bulkDecline(ids, reason)` | POST | `/v1/console/contributions/bulk-decline` |

---

### `api/stops.ts`

| Function | Method | Endpoint |
|----------|--------|----------|
| `fetchStops(params)` | GET | `/v1/console/stops` |
| `fetchStop(id)` | GET | `/v1/console/stops/:id` |
| `createStop(data)` | POST | `/v1/console/stops` |
| `updateStop(id, data)` | PATCH | `/v1/console/stops/:id` |
| `deleteStop(id)` | DELETE | `/v1/console/stops/:id` |

Stop IDs are GTFS strings (e.g. `"STB_001"`), not numeric primary keys.

---

### `api/analytics.ts`

| Function | Method | Endpoint |
|----------|--------|----------|
| `fetchAnalyticsOverview()` | GET | `/v1/console/analytics/overview` |
| `fetchJourneyAnalytics(days?)` | GET | `/v1/console/analytics/journeys` |
| `fetchTopSearches()` | GET | `/v1/console/analytics/searches` |
| `fetchContributionAnalytics(days?)` | GET | `/v1/console/analytics/contributions` |
| `fetchUserGrowth(days?)` | GET | `/v1/console/analytics/user-growth` |

---

### `api/otp.ts`

| Function | Method | Endpoint |
|----------|--------|----------|
| `fetchOtpStatus()` | GET | `/v1/console/otp/status` |
| `triggerOtpSync()` | POST | `/v1/console/otp/sync` |

---

### `api/timetable.ts`

| Function | Method | Endpoint |
|----------|--------|----------|
| `fetchTimetableData(routeId?)` | GET | `/v1/console/timetable` |
| `fetchHeadwayReport(routeId)` | GET | `/v1/console/timetable/headway-report` |
| `optimizeHeadways(routeId, opts)` | POST | `/v1/console/timetable/optimize-headways` |

---

### `api/scheduling.ts`

| Function | Method | Endpoint |
|----------|--------|----------|
| `fetchBlocks(filters?)` | GET | `/v1/console/scheduling/blocks` |
| `fetchBlock(id)` | GET | `/v1/console/scheduling/blocks/:id` |
| `saveBlock(data)` | POST | `/v1/console/scheduling/blocks` |
| `deleteBlock(id)` | DELETE | `/v1/console/scheduling/blocks/:id` |
| `fetchLayoverReport(filters?)` | GET | `/v1/console/scheduling/layover-report` |
| `fetchTimeSpaceDiagram(routeId, date)` | GET | `/v1/console/scheduling/time-space-diagram` |

---

### `api/quality.ts`

| Function | Method | Endpoint |
|----------|--------|----------|
| `fetchQualityScore(refresh?)` | GET | `/v1/console/quality/score` |
| `fetchDrillDown(metric)` | GET | `/v1/console/quality/drill-down?metric=X` |
| `fetchShapeInspector(tripId)` | GET | `/v1/console/quality/shape-inspector?trip_id=X` |
| `fetchDuplicateStops(radiusM?)` | GET | `/v1/console/quality/duplicate-stops?radius=N` |
| `mergeStops(canonicalId, dupId)` | POST | `/v1/console/quality/merge-stops` |
| `snapStop(stopId)` | POST | `/v1/console/stops/:id/snap` |
| `fetchOfficialValidation()` | GET | `/v1/console/gtfs/official-validate` |
| `exportAs(format)` | POST | `/v1/console/gtfs/export-as` → blob download |

`exportAs` uses `responseType: "blob"` and triggers a browser download via `URL.createObjectURL`.

---

## TypeScript Types

All types are in `src/types/index.ts`.

### Core

```ts
type Role = "user" | "moderator" | "admin" | "superadmin";

interface ConsoleUser { id, name, email, phone_number, avatar, role, points, banned_at, ban_reason, created_at, updated_at }
interface Contribution { id, user_id, user?, type: ContributionType, status: ContributionStatus, lat, lng, stop_name, ... }
interface Stop { id, stop_id, stop_name, stop_lat, stop_lon, stop_code, stop_desc, wheelchair_accessible, has_shelter }
interface Route { route_id, route_short_name, route_long_name, route_type, route_color }
interface Trip { trip_id, route_id, service_id, trip_headsign, direction_id, shape_id, scheduling_type }
interface ServiceCalendar { id, service_id, monday..sunday, start_date, end_date }
interface PaginatedResponse<T> { data: T[], current_page, last_page, per_page, total }
```

### Scheduling & Timetable (Category 2)

```ts
interface HeadwaySlot { period_label, start_time, end_time, trips: TripSlot[], avg_headway_min, target_headway_min }
interface TimetableData { route_id, patterns: PatternTimetable[] }
interface Block { id, block_id, route_id, trips: BlockTrip[], total_duration_min, deadhead_min }
interface LayoverReport { terminal, trips: LayoverTrip[], avg_layover_min, min_layover_min }
interface TimeSpaceDiagram { stops: string[], trips: TimeSpaceTrip[] }
interface BlocksData { blocks: Block[], total_vehicles_required, total_deadhead_min }
```

### Data Quality (Category 4)

```ts
interface QualityMetric { key, label, value, total, score, inverse: boolean }
interface DataQualityScore { overall: number, computed_at: string, metrics: QualityMetric[] }

interface StopGap { stop_id, stop_name, lat, lng, gap_m: number, flagged: boolean }
interface ShapeSegment { from_idx, to_idx, distance_m }
interface ShapeReversal { point_idx, bearing_change_deg }
interface ShapeInspectorResult {
  trip_id, shape_id,
  stop_gaps: StopGap[], teleports: ShapeSegment[], reversals: ShapeReversal[],
  max_gap_m, flagged_stops_count
}

interface DuplicateStopPair {
  stop_a: Pick<Stop, 'id'|'name'|'lat'|'lng'>;
  stop_b: Pick<Stop, 'id'|'name'|'lat'|'lng'>;
  distance_m: number; name_similarity: number;
}

interface OfficialValidationNotice { code, severity: 'ERROR'|'WARNING'|'INFO', totalNotices, sampleNotices }
interface OfficialValidationResult { available: boolean, notices?, validated_at?, error?, setup? }
```

---

## Store

### `store/authStore.ts`

```ts
interface AuthState {
  user: ConsoleUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: ConsoleUser, token: string) => void;
  logout: () => void;
}
```

Persisted under `"hopln:console:auth"` in `localStorage` via Zustand `persist`. The Axios interceptor reads `localStorage["hopln_console_token"]` directly. The router guards call `useAuthStore.getState()` synchronously (safe outside React render cycle).

---

## Lib Utilities

### `lib/utils.ts`

| Export | Description |
|--------|-------------|
| `cn(...inputs)` | Merges Tailwind classes with `clsx` + `tailwind-merge` |
| `formatDate(s)` | ISO → `"Jan 1, 2025"` |
| `formatDateTime(s)` | ISO → `"Jan 1, 2025 14:30"` |
| `timeAgo(s)` | ISO → `"3 hours ago"` |
| `formatNumber(n)` | Integer with locale thousand separators |

### `lib/queryClient.ts`

```ts
new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})
```

---

## UI Components

shadcn/ui (New York style, Zinc base). Because the shadcn CLI has a monorepo-detection bug in this workspace, all components were installed by fetching directly from the registry JSON API.

### shadcn components (`src/components/ui/`)

| Component | Used for |
|-----------|----------|
| `button` | All CTAs and action buttons |
| `input` | Text form fields |
| `textarea` | Multi-line text (decline reasons, notification body) |
| `select` | Dropdowns (route type, notification audience) |
| `card` | Stat cards, form panels, detail panes |
| `table` | All data tables |
| `badge` | Status chips (contribution status, role, OTP health, quality scores) |
| `dialog` | Confirmation modals, merge dialog |
| `tabs` | Detail page sub-nav, GtfsPage (export / validator tabs) |
| `avatar` | User profile images |
| `dropdown-menu` | Row actions, export format selector, sidebar user menu |
| `separator` | Visual dividers |
| `skeleton` | Loading placeholder rows |
| `scroll-area` | Scrollable content regions |
| `tooltip` | Icon-only button labels |
| `checkbox` | Toggles in stop / calendar editors |
| `progress` | Name-similarity bar in duplicate detector |
| `radio-group` | Canonical stop selector in merge dialog |
| `sidebar` | Full sidebar system with collapsible icon mode |
| `sheet` | Mobile sidebar drawer |
| `breadcrumb` | Navigation breadcrumbs |

### Color System

- Primary brand: `#FF6F00` (Hopln orange) → `--primary`, `--ring`
- Active sidebar item: `bg-orange-50 text-orange-600`
- Quality score gauge: red `< 40` / amber `< 70` / green `≥ 70`
- Role badges: `user→zinc`, `moderator→blue`, `admin→amber`, `superadmin→orange`
- Contribution status: `pending→default`, `approved→green`, `declined→red`

---

## Packages

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` + `react-dom` | ^19.2 | UI framework |
| `@tanstack/react-router` | ^1.170 | Type-safe SPA routing with `beforeLoad` guards |
| `@tanstack/react-query` | ^5.100 | Server-state caching, polling, mutation lifecycle |
| `@tanstack/react-table` | ^8.21 | Headless table logic |
| `zustand` | ^5.0 | Auth session state |
| `axios` | ^1.16 | HTTP client with interceptors |
| `react-map-gl` | ^8.1 | React wrapper for Mapbox GL JS |
| `mapbox-gl` | ^3.24 | Mapbox GL JS core |
| `recharts` | ^3.8 | Charts (AreaChart, BarChart, RadialBarChart for quality gauge) |
| `sonner` | ^2.0 | Toast notifications |
| `date-fns` | ^4.3 | Date formatting and relative time |
| `react-hook-form` + `@hookform/resolvers` | ^7.76 / ^5.4 | Form state + Zod validation |
| `zod` | ^4.4 | Schema validation |
| `tailwindcss` | ^4.3 | Utility-first CSS |
| `tailwindcss-animate` | ^1.0 | CSS animations (Sheet, Dialog) |
| `@tailwindcss/vite` | ^4.3 | Vite integration |
| `clsx` + `tailwind-merge` + `class-variance-authority` | — | Class utilities |
| `lucide-react` | ^1.16 | Icon set |
| `@radix-ui/*` | various | Accessible UI primitives |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^8.0 | Dev server + bundler |
| `@vitejs/plugin-react` | ^6.0 | React Fast Refresh |
| `typescript` | ~6.0 | TypeScript compiler |
| `eslint` + plugins | ^10 | Linting |

---

## Notes

### Tailwind v4 Class Conventions

| v3 (avoid) | v4 (use) |
|------------|----------|
| `bg-gradient-to-br` | `bg-linear-to-br` |
| `flex-[2]` | `flex-2` |

Arbitrary values (`h-[N]`) still work but trigger IDE warnings when a scale equivalent exists.

### react-map-gl v8 Import

v8 removed the default export from the root path. Always import from the `mapbox` subpath:

```ts
import Map, { Marker, Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
```

### shadcn CLI Workaround

The shadcn CLI fails in this workspace because it finds the sibling `hopln/package.json` (Expo app) and treats the parent as a monorepo root. Install components manually by fetching registry JSON:

```
https://ui.shadcn.com/r/styles/new-york/{component-name}.json
```

Replace any `@/registry/new-york/...` import paths with `@/components/ui/...`, `@/lib/...`, `@/hooks/...`.
