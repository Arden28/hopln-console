export type Role = "user" | "moderator" | "admin" | "superadmin";

export interface ConsoleUser {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  avatar: string | null;
  role: Role;
  points: number;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  contributions_count?: number;
  contributions?: ContributionSummary[];
  badges?: Badge[];
}

export interface ContributionSummary {
  id: string;
  type: string;
  status: ContributionStatus;
  description: string;
  created_at: string;
}

export type ContributionStatus = "pending" | "approved" | "declined";
export type ContributionType =
  | "new_stop" | "edit_stop" | "new_route" | "edit_route"
  | "stop_review" | "stop_photo" | "delay_report" | "stop_edit"
  | "route_correction" | "other";

export interface Contribution {
  id: string;
  user_id: string;
  user?: Pick<ConsoleUser, "id" | "name" | "avatar" | "points">;
  stop_id: string | null;
  type: ContributionType;
  title: string | null;
  description: string | null;
  data: Record<string, unknown> | null;
  status: ContributionStatus;
  points_awarded: number;
  reviewed_at: string | null;
  reviewed_by: string | null;
  decline_reason: string | null;
  votes_count?: number;
  stop_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
  updated_at: string;
}

export interface StopTime {
  id: number;
  trip_id: string;
  stop_id: string;
  arrival_time: string;
  departure_time: string;
  stop_sequence: number;
  stop?: Stop;
}

export interface Trip {
  trip_id: string;
  route_id: string;
  service_id?: string;
  shape_id?: string | null;
  trip_headsign?: string | null;
  direction_id?: 0 | 1;
  scheduling_type?: "scheduled" | "frequency";
  route_pattern_id?: string | null;
  block_id?: string | null;
  stop_times_count?: number;
  stop_times?: StopTime[];
  route?: Pick<Route, "route_id" | "route_short_name" | "route_long_name" | "route_color" | "route_type">;
  shape?: Shape;
  frequencies?: TripFrequency[];
}

export interface Shape {
  shape_id: string;
  points?: [number, number][]; // [lng, lat] coordinates
}

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  location_t?: number;
  parent_sta?: string | null;
  trip_count?: number;
  route_nams?: string;
  aliases?: string | null;
  popularity_score?: number;
  updated_at: string;
  contributions_count?: number;
  contributions?: Contribution[];
  stop_times?: StopTime[];
}

export interface Route {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number;
  route_color?: string | null;
  route_text_color?: string | null;
  route_desc?: string | null;
  agency_id?: string;
  trips_count?: number;
  trips?: Trip[];
  shapes?: Shape[];
  patterns?: RoutePattern[];
}

export interface Agency {
  agency_id: string;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;
  agency_lang?: string;
  agency_phone?: string | null;
  agency_email?: string | null;
  routes_count?: number;
}

export interface ServiceCalendar {
  service_id: string;
  name: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  start_date: string;
  end_date: string;
  exceptions?: ServiceException[];
  trips_count?: number;
}

export interface ServiceException {
  id: number;
  service_id: string;
  date: string;
  exception_type: 1 | 2;
  note?: string | null;
}

export interface RoutePattern {
  id: string;
  route_id: string;
  name: string;
  direction_id: 0 | 1;
  is_canonical: boolean;
  pattern_stops?: RoutePatternStop[];
  trips_count?: number;
}

export interface RoutePatternStop {
  id: number;
  route_pattern_id: string;
  stop_id: string;
  stop_sequence: number;
  timepoint: boolean;
  pickup_type: 0 | 1 | 2 | 3;
  drop_off_type: 0 | 1 | 2 | 3;
  distance_traveled?: number | null;
  stop?: Stop;
}

export interface TripFrequency {
  id: number;
  trip_id: string;
  start_time: string;
  end_time: string;
  headway_secs: number;
  exact_times: 0 | 1;
}

export interface GtfsValidationResult {
  valid: boolean;
  errors: Array<{ rule: string; message: string; entity_id?: string }>;
  warnings: Array<{ rule: string; message: string; entity_id?: string }>;
  checked_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: string | null;
  points_required: number;
  users_count?: number;
}

export interface BroadcastNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  audience: string;
  sent_to: number;
  created_at: string;
}

export interface DashboardOverview {
  dau: number;
  mau: number;
  journeys_today: number;
  pending_contributions: number;
  total_users: number;
  total_contributions: number;
}

export interface OtpStatus {
  last_sync: string | null;
  last_duration: number | null;
  status: "ok" | "healthy" | "running" | "failed" | "unknown";
  gtfs_build_date?: string | null;
  error: string | null;
}

export interface SystemHealth {
  api_ok?: boolean;
  db_ok?: boolean;
  otp_ok?: boolean;
  queue_ok?: boolean;
  queue_depth?: number;
  otp?: OtpStatus;
  queue?: { pending: number; failed: number };
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

// ── Network Modeling ──────────────────────────────────────────────────────────

export interface NetworkNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  route_count: number;
  trip_count: number;
}

export interface NetworkEdge {
  id: string;
  route_id: string;
  route_short_name: string;
  route_color: string | null;
  points: [number, number][];
}

export interface NetworkGraphData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface Corridor {
  corridor_id: string;
  name: string;
  agency_id?: string | null;
  points?: [number, number][];
  routes?: Route[];
  corridor_routes_count?: number;
}

export interface NetworkSnapshot {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  snapshot_json: Record<string, unknown>;
  saved_by?: number | null;
  label?: string | null;
  created_at: string;
}

export interface ScenarioOverride {
  id: number;
  scenario_id: number;
  entity_type: string;
  entity_id: string | null;
  action: "add" | "modify" | "delete";
  data: Record<string, unknown>;
}

export interface NetworkScenario {
  id: number;
  name: string;
  description?: string | null;
  status: "draft" | "published" | "archived";
  created_by?: number | null;
  published_at?: string | null;
  overrides?: ScenarioOverride[];
  overrides_count?: number;
}

export interface TransferGraph {
  nodes: Array<{ id: string; name: string; lat: number; lng: number }>;
  edges: Array<{ from_id: string; to_id: string; distance_m: number }>;
  connectivity_score: number;
  largest_component_size: number;
  isolated_stops: number;
}

export interface DesireLine {
  from_name: string;
  to_name: string;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  count: number;
}

export interface WalkShedResult {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Polygon"; coordinates: number[][][] };
    properties: { time: number };
  }>;
}
