# Hopln Console

Internal administration dashboard for the Hopln transit platform — Nairobi's matatu and bus network navigation system. Provides role-restricted access for moderators and administrators to manage stops, routes, contributions, users, analytics, notifications, and system health.

---

## Table of Contents

- [What is Hopln Console](#what-is-hopln-console)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Dev Commands](#dev-commands)
- [Router](#router)
- [API Modules](#api-modules)
- [TypeScript Types](#typescript-types)
- [Store](#store)
- [Lib Utilities](#lib-utilities)
- [UI Components](#ui-components)
- [Packages](#packages)

---

## What is Hopln Console

Hopln Console is the back-office SPA for the Hopln system. It is accessible only to users with one of three elevated roles: `moderator`, `admin`, or `superadmin`. Regular passenger accounts are blocked at the login screen.

Core responsibilities of the console:

| Section | Purpose |
|---------|---------|
| Dashboard | Real-time KPIs (DAU, MAU, journeys today), activity feed, and system health status |
| Contributions | Review, approve, or decline community-submitted stop edits, new stop reports, photos, and route observations |
| Stops | Browse, create, and edit the GTFS stop database with inline Mapbox map editing |
| Routes | Browse and edit bus route metadata (name, color, type) |
| Users | Search users, inspect activity, adjust gamification points, award or revoke badges, and ban/unban accounts |
| Analytics | Journey volume charts, top destination searches, contribution trends, and user growth curves |
| Notifications | Compose and broadcast push notifications to segments of the user base |
| Settings | Manage system configuration, team roles, OTP routing engine status, and the badge catalog |

The console talks exclusively to the `hopln-api` Laravel backend. It has no direct database access.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Language | TypeScript 6 |
| Build tool | Vite 8 with `@tailwindcss/vite` plugin |
| Styling | Tailwind CSS v4 (CSS-first config, `@theme inline`) |
| UI components | shadcn/ui — New York style, Zinc base, manually installed |
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
├── api/              # API modules (one file per domain)
│   ├── client.ts     # Axios instance with auth interceptors
│   ├── auth.ts       # Login / logout
│   ├── dashboard.ts  # Overview, activity, system health
│   ├── users.ts      # User CRUD + ban, points, badges
│   ├── contributions.ts  # Contribution review workflow
│   ├── stops.ts      # Stop CRUD
│   ├── analytics.ts  # Charts and KPI data
│   └── otp.ts        # OTP routing engine status + sync
├── components/
│   ├── layout/       # AppShell, Sidebar, Topbar
│   ├── ui/           # shadcn/ui components
│   └── shared/       # Reusable cross-page components
├── hooks/
│   └── use-mobile.ts # Responsive breakpoint hook (768px)
├── lib/
│   ├── utils.ts      # cn, formatDate, formatDateTime, timeAgo, formatNumber
│   └── queryClient.ts
├── pages/
│   ├── auth/         # LoginPage
│   ├── dashboard/    # DashboardPage
│   ├── contributions/# ContributionsPage, ContributionDetailPage
│   ├── users/        # UsersPage, UserDetailPage
│   ├── stops/        # StopsPage, StopEditorPage
│   ├── routes/       # RoutesPage, RouteEditorPage
│   ├── analytics/    # AnalyticsPage
│   ├── notifications/# NotificationsPage
│   └── settings/     # SettingsPage
├── router.tsx        # Full TanStack Router route tree
├── store/
│   └── authStore.ts  # Zustand auth store (persisted)
├── types/
│   └── index.ts      # All shared TypeScript interfaces
├── index.css         # Tailwind v4 theme + CSS custom properties
└── main.tsx          # React root + QueryClientProvider + RouterProvider
```

---

## Setup

```bash
cd d:\React\console
npm install
```

Copy `.env.example` to `.env` and set `VITE_API_URL` (see below).

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Base URL of the `hopln-api` Laravel backend, e.g. `http://localhost:8000/api` |
| `VITE_MAPBOX_TOKEN` | Yes | Mapbox public token — used for map tiles and geocoding in stop/contribution editors |

When `VITE_API_URL` is not set, the Axios client defaults to `/api` and relies on the Vite dev server proxy (`/api → http://localhost:8000`).

**Vite proxy config** (`vite.config.ts`):
```ts
server: {
  port: 5173,
  proxy: {
    "/api": { target: "http://localhost:8000", changeOrigin: true },
  },
}
```

---

## Dev Commands

```bash
npm run dev        # Start Vite dev server on http://localhost:5173
npm run build      # TypeScript compile + Vite production build → dist/
npm run preview    # Serve the production build locally
npm run lint       # ESLint
npx tsc --noEmit   # Type-check without emitting files
```

---

## Router

Built with **TanStack Router v1** (code-based, not file-based). The full route tree is defined in `src/router.tsx`.

### Route Tree

```
rootRoute  (Outlet)
├── /login                    loginRoute         — public; redirects to / if already authenticated
└── [protected]               protectedRoute     — auth guard: redirects to /login if unauthenticated
                                                    or if user.role is not moderator/admin/superadmin
    ├── /                     dashboardRoute     — DashboardPage
    ├── /users                usersRoute         — UsersPage (paginated user list)
    ├── /users/$id            userDetailRoute    — UserDetailPage (profile, contributions, badges)
    ├── /contributions        contributionsRoute — ContributionsPage (filterable list)
    ├── /contributions/$id    contributionDetail — ContributionDetailPage (map + approve/decline)
    ├── /stops                stopsRoute         — StopsPage (searchable table)
    ├── /stops/new            stopNewRoute       — StopEditorPage (create mode)
    ├── /stops/$id/edit       stopEditRoute      — StopEditorPage (edit mode)
    ├── /routes               routesRoute        — RoutesPage (table)
    ├── /routes/new           routeNewRoute      — RouteEditorPage (create mode)
    ├── /routes/$id/edit      routeEditRoute     — RouteEditorPage (edit mode)
    ├── /analytics            analyticsRoute     — AnalyticsPage (charts)
    ├── /notifications        notificationsRoute — NotificationsPage (compose + history)
    └── /settings             settingsRoute      — SettingsPage (multi-tab config)
```

### Auth Guard Logic

`protectedRoute.beforeLoad` reads `useAuthStore.getState()` synchronously (Zustand's static `.getState()` — no hook needed outside React). If either condition fails it throws `redirect({ to: "/login" })`:

1. `!isAuthenticated` — no token / session expired
2. `user.role` not in `["moderator", "admin", "superadmin"]` — passenger account tried to access console

`loginRoute.beforeLoad` performs the inverse redirect — if already authenticated, it sends you straight to `/`.

### `useParams` Pattern

Pages that read dynamic segments (`$id`) use `strict: false` to avoid the `Invariant failed` error that occurs during navigation transitions:

```ts
const params = useParams({ strict: false }) as { id?: string };
const id = params.id!;
```

---

## API Modules

All modules import from `./client` (the shared Axios instance). Responses are typed against interfaces in `src/types/index.ts`.

### `api/client.ts` — Axios instance

```ts
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});
```

**Request interceptor**: reads the Bearer token from `localStorage["hopln_console_token"]` and attaches it as `Authorization: Bearer <token>` on every outgoing request.

**Response interceptor**: on HTTP 401, clears both `hopln_console_token` and `hopln_console_user` from localStorage and hard-navigates to `/login` via `window.location.href`.

---

### `api/auth.ts`

| Function | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| `login(email, password)` | POST | `/v1/auth/login` | Authenticate; returns `{ token, user }` |
| `logout()` | POST | `/v1/auth/logout` | Invalidate session token server-side |

```ts
interface LoginResponse {
  token: string;
  user: ConsoleUser;
}
```

After a successful login, `LoginPage` calls `useAuthStore.setAuth(user, token)` to persist the session.

---

### `api/dashboard.ts`

| Function | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| `fetchOverview()` | GET | `/v1/console/dashboard` | Returns `DashboardOverview` KPIs |
| `fetchActivity()` | GET | `/v1/console/activity` | Returns paginated recent-events array |
| `fetchSystemHealth()` | GET | `/v1/console/system-health` | Returns `SystemHealth` (OTP + queue status) |

---

### `api/users.ts`

| Function | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| `fetchUsers(filters)` | GET | `/v1/console/users` | Paginated user list with optional filters |
| `fetchUser(id)` | GET | `/v1/console/users/:id` | Single user with counts |
| `updateUser(id, data)` | PATCH | `/v1/console/users/:id` | Update user fields |
| `banUser(id, reason)` | POST | `/v1/console/users/:id/ban` | Ban a user with a reason string |
| `unbanUser(id)` | POST | `/v1/console/users/:id/unban` | Lift a ban |
| `adjustPoints(id, points, reason)` | PATCH | `/v1/console/users/:id/points` | Add or subtract gamification points |
| `awardBadge(userId, badgeId)` | POST | `/v1/console/users/:userId/badges` | Grant a badge |
| `revokeBadge(userId, badgeId)` | DELETE | `/v1/console/users/:userId/badges/:badgeId` | Remove a badge |

```ts
interface UserFilters {
  search?: string;
  role?: string;        // "user" | "moderator" | "admin" | "superadmin"
  banned?: "true" | "false";
  page?: number;
  per_page?: number;
}
```

---

### `api/contributions.ts`

| Function | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| `fetchContributions(filters)` | GET | `/v1/console/contributions` | Paginated contributions with filters |
| `fetchContribution(id)` | GET | `/v1/console/contributions/:id` | Single contribution with nested user |
| `approveContribution(id)` | POST | `/v1/console/contributions/:id/approve` | Mark as approved |
| `declineContribution(id, reason)` | POST | `/v1/console/contributions/:id/decline` | Mark as declined with reason |
| `updateContribution(id, data)` | PATCH | `/v1/console/contributions/:id` | Edit contribution fields |
| `bulkApprove(ids)` | POST | `/v1/console/contributions/bulk-approve` | Approve multiple at once |
| `bulkDecline(ids, reason)` | POST | `/v1/console/contributions/bulk-decline` | Decline multiple with shared reason |

```ts
interface ContributionFilters {
  status?: ContributionStatus;  // "pending" | "approved" | "declined"
  type?: string;
  search?: string;
  from?: string;  // ISO date string
  to?: string;    // ISO date string
  page?: number;
  per_page?: number;
}
```

---

### `api/stops.ts`

| Function | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| `fetchStops(params)` | GET | `/v1/console/stops` | Paginated stop list |
| `fetchStop(id)` | GET | `/v1/console/stops/:id` | Single stop by string ID |
| `createStop(data)` | POST | `/v1/console/stops` | Create a new stop |
| `updateStop(id, data)` | PATCH | `/v1/console/stops/:id` | Update stop fields |
| `deleteStop(id)` | DELETE | `/v1/console/stops/:id` | Delete a stop |

The `id` parameter for stops is a string (`stop_id` in GTFS format, e.g. `"STB_001"`), not a numeric primary key.

---

### `api/analytics.ts`

| Function | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| `fetchAnalyticsOverview()` | GET | `/v1/console/analytics/overview` | Aggregate KPIs |
| `fetchJourneyAnalytics(days?)` | GET | `/v1/console/analytics/journeys` | Daily journey count series (default 30 days) |
| `fetchTopSearches()` | GET | `/v1/console/analytics/searches` | Most searched stop/place names |
| `fetchContributionAnalytics(days?)` | GET | `/v1/console/analytics/contributions` | Contribution volume series (default 60 days) |
| `fetchUserGrowth(days?)` | GET | `/v1/console/analytics/user-growth` | Cumulative user registration curve (default 90 days) |

**Important**: the API returns Laravel paginated shapes `{ data: [...], total: N, ... }` for list endpoints. `AnalyticsPage` normalises these with:
```ts
const toArray = <T,>(r: { data: unknown }) =>
  Array.isArray(r.data) ? r.data as T[] : ((r.data as { data?: T[] })?.data ?? []);
```

---

### `api/otp.ts`

| Function | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| `fetchOtpStatus()` | GET | `/v1/console/otp/status` | Returns `OtpStatus` (ok/running/failed/unknown) |
| `triggerOtpSync()` | POST | `/v1/console/otp/sync` | Kick off a GTFS re-import on the routing engine |

---

## TypeScript Types

All types are in `src/types/index.ts` and mirror the shapes returned by `hopln-api`.

```ts
type Role = "user" | "moderator" | "admin" | "superadmin";

interface ConsoleUser {
  id: number;
  name: string;
  email: string;
  phone_number: string | null;
  avatar: string | null;
  role: Role;
  points: number;
  banned_at: string | null;
  ban_reason: string | null;
  created_at: string;
  updated_at: string;
  contributions_count?: number;
  saved_places_count?: number;
  saved_journeys_count?: number;
}

type ContributionStatus = "pending" | "approved" | "declined";
type ContributionType = "new_stop" | "stop_edit" | "route_observation" | "photo" | "review";

interface Contribution {
  id: number;
  user_id: number;
  user?: Pick<ConsoleUser, "id" | "name" | "avatar" | "points">;
  type: ContributionType;
  status: ContributionStatus;
  description: string;
  lat: number | null;
  lng: number | null;
  stop_name: string | null;
  before_lat: number | null;   // original location (for stop_edit contributions)
  before_lng: number | null;
  decline_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: number | null;
  created_at: string;
  updated_at: string;
  votes_count?: number;
}

interface Stop {
  id: number;
  stop_id: string;        // GTFS stop_id (e.g. "STB_001")
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  stop_code: string | null;
  stop_desc: string | null;
  wheelchair_accessible: boolean;
  has_shelter: boolean;
  updated_at: string;
  contributions_count?: number;
}

interface Route {
  id: number;
  route_id: string;
  route_short_name: string;  // e.g. "44C"
  route_long_name: string;
  route_type: number;        // GTFS route_type: 3=Bus, 1=Subway, 2=Rail, 0=Tram
  route_color: string | null; // hex without #
  trips_count?: number;
}

interface Badge {
  id: number;
  name: string;
  description: string;
  icon: string;
  criteria: string | null;
  points_threshold: number | null;
  users_count?: number;
}

interface BroadcastNotification {
  id: number;
  title: string;
  body: string;
  type: string;
  audience: string;
  sent_to: number;
  created_at: string;
}

interface DashboardOverview {
  dau: number;                   // daily active users
  mau: number;                   // monthly active users
  journeys_today: number;
  pending_contributions: number; // drives the sidebar badge count
  total_users: number;
  total_contributions: number;
}

interface OtpStatus {
  last_sync: string | null;
  last_duration: number | null;  // seconds
  status: "ok" | "running" | "failed" | "unknown";
  error: string | null;
}

interface SystemHealth {
  otp: OtpStatus;
  queue: { pending: number; failed: number };
}

interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
```

---

## Store

### `store/authStore.ts` — Zustand with persist

```ts
interface AuthState {
  user: ConsoleUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: ConsoleUser, token: string) => void;
  logout: () => void;
}
```

**Key**: `"hopln:console:auth"` in `localStorage` (managed by Zustand `persist` middleware).

**`setAuth(user, token)`**: writes the token to `localStorage["hopln_console_token"]` (read by the Axios interceptor), then sets `{ user, token, isAuthenticated: true }`.

**`logout()`**: removes `hopln_console_token` from localStorage, resets state to `{ user: null, token: null, isAuthenticated: false }`. The Sidebar's `NavUser` component then calls `window.location.href = "/login"`.

**`partialize`**: only `user`, `token`, and `isAuthenticated` are persisted. Derived/computed state is excluded.

**Static access**: the router guards call `useAuthStore.getState()` directly (not the hook), allowing synchronous reads outside of React's render cycle inside `beforeLoad`.

---

## Lib Utilities

### `lib/utils.ts`

| Export | Signature | Description |
|--------|-----------|-------------|
| `cn` | `(...inputs: ClassValue[]) => string` | Merges Tailwind classes using `clsx` + `tailwind-merge`. Handles conditional classes and deduplication. |
| `formatDate` | `(dateStr: string) => string` | Formats an ISO date string as `"Jan 1, 2025"` using date-fns `format`. |
| `formatDateTime` | `(dateStr: string) => string` | Formats as `"Jan 1, 2025 14:30"` (24-hour). |
| `timeAgo` | `(dateStr: string) => string` | Returns a relative string like `"3 hours ago"` using date-fns `formatDistanceToNow`. |
| `formatNumber` | `(n: number) => string` | Formats integers with locale-appropriate thousand separators via `Intl.NumberFormat`. |

### `lib/queryClient.ts`

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // data considered fresh for 30 seconds
      retry: 1,                   // one automatic retry on failure
      refetchOnWindowFocus: false, // no silent refetch on tab switch
    },
  },
});
```

The `queryClient` instance is provided at the root in `main.tsx` via `<QueryClientProvider client={queryClient}>`. The Dashboard's sidebar badge for pending contributions polls every 30 seconds (`refetchInterval: 30_000`).

---

## UI Components

The console uses **shadcn/ui** (New York style, Zinc base). Because the shadcn CLI has a workspace-detection bug when run from a directory that has sibling `package.json` files, all components were installed manually by fetching from the shadcn registry JSON API.

### shadcn components (`src/components/ui/`)

| Component | Source | Used for |
|-----------|--------|----------|
| `button` | shadcn | All CTAs and action buttons |
| `input` | shadcn | All text form fields |
| `label` | shadcn | Form field labels |
| `textarea` | shadcn | Multi-line text inputs (decline reasons, notification body) |
| `select` | shadcn | Dropdowns (route type, notification audience) |
| `card` | shadcn | Stat cards, form panels, detail panes |
| `table` | shadcn | All data tables (users, stops, routes, contributions, notifications history) |
| `badge` | shadcn | Status chips (contribution status, user role, OTP health) |
| `dialog` | shadcn | Confirmation modals |
| `tabs` | shadcn | User detail tabs, contributions filter tabs, settings sub-nav |
| `avatar` | shadcn | User profile images with fallback initials |
| `dropdown-menu` | shadcn | Row action menus, sidebar user menu |
| `separator` | shadcn | Visual dividers in sidebar and topbar |
| `skeleton` | shadcn | Loading placeholder rows in tables |
| `scroll-area` | shadcn | Scrollable content regions |
| `tooltip` | shadcn | Icon-only button labels |
| `sonner` | Sonner library | Global toast notifications (replaces per-page useState toast pattern) |
| `checkbox` | shadcn | Stop accessibility/shelter toggles in StopEditorPage |
| `sidebar` | shadcn | Full sidebar system with collapsible icon mode (1500-line component) |
| `sheet` | shadcn | Mobile sidebar drawer (used internally by sidebar component) |
| `breadcrumb` | shadcn | Navigation breadcrumbs |

### Layout components (`src/components/layout/`)

| Component | Description |
|-----------|-------------|
| `AppShell` | Root layout — wraps `SidebarProvider` + `AppSidebar` + `SidebarInset` + `Topbar` |
| `AppSidebar` | Navigation sidebar with collapsible icon mode, nav groups, pending badge, user dropdown |
| `Topbar` | 48px header with `SidebarTrigger`, separator, and dynamic page title |

### Color system

Primary brand color: `#FF6F00` (Hopln orange) mapped to `--primary` and `--ring` CSS custom properties.

Active sidebar item: `bg-orange-50 text-orange-600` (overrides the default `sidebar-accent` token).

Role badge colors: `user→zinc`, `moderator→blue`, `admin→amber`, `superadmin→default (orange)`.

Contribution status badge colors: `pending→default`, `approved→green`, `declined→red`.

---

## Packages

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.2 | UI framework |
| `react-dom` | ^19.2 | DOM renderer |
| `@tanstack/react-router` | ^1.170 | Type-safe SPA routing with `beforeLoad` guards |
| `@tanstack/react-query` | ^5.100 | Server-state caching, polling, mutation lifecycle |
| `@tanstack/react-router-devtools` | ^1.167 | Router devtools panel (dev only, rendered in app) |
| `@tanstack/react-table` | ^8.21 | Headless table logic (column definitions, sorting) |
| `zustand` | ^5.0 | Lightweight client state — auth session |
| `axios` | ^1.16 | HTTP client with interceptors |
| `react-map-gl` | ^8.1 | React wrapper for Mapbox GL JS (import from `react-map-gl/mapbox`) |
| `mapbox-gl` | ^3.24 | Mapbox GL JS core (peer dep for react-map-gl v8) |
| `recharts` | ^3.8 | Composable chart library (AreaChart, BarChart, LineChart) |
| `sonner` | ^2.0 | Toast notifications — `<Toaster>` in root + `toast.success/error()` |
| `date-fns` | ^4.3 | Date formatting and relative time strings |
| `react-hook-form` | ^7.76 | Form state management with minimal re-renders |
| `@hookform/resolvers` | ^5.4 | Zod adapter for react-hook-form validation |
| `zod` | ^4.4 | Schema validation |
| `tailwindcss` | ^4.3 | Utility-first CSS (v4 CSS-first config) |
| `tailwindcss-animate` | ^1.0 | Tailwind plugin for CSS animations (used by Sheet/Dialog) |
| `@tailwindcss/vite` | ^4.3 | Vite plugin that runs Tailwind v4 |
| `clsx` | ^2.1 | Conditional class name utility |
| `tailwind-merge` | ^3.6 | Deduplicates conflicting Tailwind classes |
| `class-variance-authority` | ^0.7 | CVA — variant-based component styling |
| `lucide-react` | ^1.16 | Icon set |
| `@radix-ui/react-avatar` | ^1.1 | Accessible avatar primitive |
| `@radix-ui/react-checkbox` | ^1.3 | Accessible checkbox primitive |
| `@radix-ui/react-dialog` | ^1.1 | Accessible dialog/modal primitive |
| `@radix-ui/react-dropdown-menu` | ^2.1 | Accessible dropdown menu primitive |
| `@radix-ui/react-label` | ^2.1 | Accessible label primitive |
| `@radix-ui/react-scroll-area` | ^1.2 | Cross-browser scroll area |
| `@radix-ui/react-select` | ^2.2 | Accessible select/combobox primitive |
| `@radix-ui/react-separator` | ^1.1 | Semantic separator |
| `@radix-ui/react-slot` | ^1.2 | `asChild` prop composition (used by `SidebarMenuButton`, `Button`, etc.) |
| `@radix-ui/react-tabs` | ^1.1 | Accessible tabs primitive |
| `@radix-ui/react-tooltip` | ^1.2 | Accessible tooltip primitive |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^8.0 | Dev server + production bundler |
| `@vitejs/plugin-react` | ^6.0 | React Fast Refresh + JSX transform |
| `typescript` | ~6.0 | TypeScript compiler |
| `@types/react` | ^19.2 | React type definitions |
| `@types/react-dom` | ^19.2 | ReactDOM type definitions |
| `@types/mapbox-gl` | ^3.4 | Mapbox GL type definitions |
| `@types/node` | ^24.12 | Node.js type definitions (for `path` in vite.config.ts) |
| `eslint` | ^10.3 | Linter |
| `@eslint/js` | ^10.0 | ESLint JS config |
| `eslint-plugin-react-hooks` | ^7.1 | Enforces Rules of Hooks |
| `eslint-plugin-react-refresh` | ^0.5 | Warns on non-fast-refresh-compatible exports |
| `typescript-eslint` | ^8.59 | TypeScript ESLint parser + rules |
| `globals` | ^17.6 | ESLint environment globals |

---

## Notes

### Tailwind v4 Class Conventions

Tailwind v4 changed some utility names. Use these canonical forms to avoid IDE warnings:

| v3 (avoid) | v4 (use) |
|------------|----------|
| `bg-gradient-to-br` | `bg-linear-to-br` |
| `h-[520px]` | `h-130` (if 520 = 32.5rem = 130 × 4px) |
| `flex-[2]` | `flex-2` |

Arbitrary values (`h-[N]`, `w-[N]`) still work but generate IDE warnings in v4 projects when a scale equivalent exists.

### react-map-gl v8 Import

v8 removed the default export from the root path. Always import from the `mapbox` subpath:

```ts
import Map, { Marker, Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
```

### shadcn CLI Workaround

The shadcn CLI (any version) fails in this workspace with:

```
Could not load the workspace config in D:\React\hopln
```

Root cause: the CLI walks up from `hopln-console/` to `d:\React\`, finds sibling `hopln/package.json` (Expo app), and treats the parent as a monorepo root. It then tries to load `hopln/` as a workspace member, which fails.

Workaround: fetch component JSON directly from the shadcn registry and write the files manually:

```
https://ui.shadcn.com/r/styles/new-york/{component-name}.json
```

Correct local import paths (replace any `@/registry/new-york/...` references with `@/components/ui/...`, `@/lib/...`, `@/hooks/...`).
