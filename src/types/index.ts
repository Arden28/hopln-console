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

// ── Scheduling & Timetables (Category 2) ─────────────────────────────────────

export interface TimetableStop {
  stop_id: string;
  stop_name: string;
  stop_sequence: number;
}

export interface TimetableTrip {
  trip_id: string;
  trip_headsign?: string | null;
  direction_id: number;
  service_id?: string | null;
  scheduling_type?: "scheduled" | "frequency" | null;
  stop_times_count: number;
  times: Record<string, string>;
}

export interface TimetableData {
  stops: TimetableStop[];
  trips: TimetableTrip[];
}

export interface HeadwayWindow {
  start: string;
  end: string;
  headway_mins: number;
}

export interface HeadwayOptimizerInput {
  base_trip_id: string;
  windows: HeadwayWindow[];
  layover_mins: number;
}

export interface GeneratedTrip {
  departure: string;
  window_label: string;
  headway_mins: number;
}

export interface OptimizeHeadwayResult {
  fleet_size: number;
  total_trips: number;
  vehicle_hours: number;
  one_way_mins: number;
  cycle_mins: number;
  generated_trips: GeneratedTrip[];
}

export interface LayoverTrip {
  trip_id: string;
  first_departure: string;
  last_arrival: string;
  duration_mins: number;
  recovery_mins: number | null;
  flagged: boolean;
}

export interface LayoverAnalysis {
  trips: LayoverTrip[];
  flagged_count: number;
  min_recovery_mins: number | null;
}

export interface BlockConflict {
  trip1_id: string;
  trip2_id: string;
  message: string;
}

export interface BlockTrip extends Pick<Trip, "trip_id" | "trip_headsign" | "direction_id" | "block_id"> {
  first_departure: string;
  last_arrival: string;
  duration_mins: number;
}

export interface BlockEntry {
  block_id: string;
  trips: BlockTrip[];
  total_hours: number;
  conflicts: BlockConflict[];
}

export interface BlocksData {
  blocks: BlockEntry[];
  unblocked: BlockTrip[];
  total_fleet_size: number;
}

// ── Data Quality & Compliance (Category 4) ───────────────────────────────────

export interface QualityMetric {
  key: string;
  label: string;
  value: number;
  total: number;
  score: number; // 0–100
  inverse: boolean; // true = lower is better
}

export interface DataQualityScore {
  overall: number; // 0–100
  computed_at: string;
  metrics: QualityMetric[];
}

export interface StopGap {
  stop_id: string;
  stop_name: string;
  lat: number;
  lng: number;
  gap_m: number;
  flagged: boolean;
}

export interface ShapeSegment {
  from_idx: number;
  to_idx: number;
  distance_m: number;
}

export interface ShapeReversal {
  point_idx: number;
  bearing_change_deg: number;
}

export interface ShapeInspectorResult {
  trip_id: string;
  shape_id: string;
  stop_gaps: StopGap[];
  teleports: ShapeSegment[];
  reversals: ShapeReversal[];
  max_gap_m: number;
  flagged_stops_count: number;
}

export interface DuplicateStopPair {
  stop_a: Pick<Stop, "id" | "name" | "lat" | "lng">;
  stop_b: Pick<Stop, "id" | "name" | "lat" | "lng">;
  distance_m: number;
  name_similarity: number;
}

export interface OfficialValidationNotice {
  code: string;
  severity: "ERROR" | "WARNING" | "INFO";
  totalNotices: number;
  sampleNotices: Array<{ message: string; entities?: Record<string, string> }>;
}

export interface OfficialValidationResult {
  available: boolean;
  notices?: OfficialValidationNotice[];
  validated_at?: string;
  error?: string;
  setup?: {
    instructions: string;
    env_vars: Record<string, string>;
  };
}

// ── Category 5 — Multi-Modal & Multi-Agency ───────────────────────────────────

// Feature 29 — Modal Layers
export interface ModalLayerData {
  label: string;
  color: string;
  count: number;
  features: GeoJSON.Feature[];
  osm?: boolean;
}
export interface ModalLayersResponse {
  layers: Record<string, ModalLayerData>;
  osm_refreshed_at?: string;
}

// Feature 30 — Fares
export interface FareZone {
  id: number;
  zone_id: string;
  name: string;
  agency_id: string;
  color: string;
  geojson: GeoJSON.Geometry | null;
}
export interface FareAttribute {
  id: number;
  fare_id: string;
  price: number;
  currency_type: string;
  payment_method: 0 | 1;
  transfers: 0 | 1 | 2 | null;
  transfer_duration: number | null;
  agency_id: string;
  fare_rules?: FareRule[];
}
export interface FareRule {
  id: number;
  fare_id: string;
  route_id?: string;
  origin_id?: string;
  destination_id?: string;
  contains_id?: string;
}
export interface FarePreview {
  found: boolean;
  fare_id?: string;
  price?: number;
  base_price?: number;
  effective_price?: number;
  currency_type?: string;
  payment_method?: 0 | 1;
  transfers?: 0 | 1 | 2 | null;
  resolved_via?: "zone_to_zone" | "route_based" | "catch_all";
  modifiers_applied?: Array<{
    id: number;
    name: string;
    type: string;
    multiplier: number | null;
    fixed_surcharge: number | null;
  }>;
}

export type FareModifierType = "weather" | "event" | "peak_hours" | "day_of_week";
export type FareModifierScope = "all" | "agency" | "route" | "zone";

export interface FareModifier {
  id: number;
  name: string;
  type: FareModifierType;
  applies_to: FareModifierScope;
  applies_to_id: string | null;
  multiplier: number | null;
  fixed_surcharge: number | null;
  condition_data: Record<string, unknown> | null;
  is_active: boolean;
  start_at: string | null;
  end_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RouteFare {
  id: number;
  fare_id: string;
  route_id: string;
  price: number;
  currency_type: string;
  payment_method: 0 | 1;
  agency_id: string | null;
  route?: Pick<Route, "route_id" | "route_short_name" | "route_long_name">;
}

// Feature 31 — Multi-Agency
export interface AgencyStats {
  agency_id: string;
  agency_name: string;
  route_count: number;
  stop_count: number;
  trip_count: number;
}
export interface CrossAgencyTransfer {
  stop_id: string;
  stop_name: string;
  lat: number;
  lng: number;
  agencies: string[];
  transfer_quality_score: number;
  min_transfer_gap_min: number;
}

// Feature 32 — Interop Registry + Pathways + Levels
export type InteropEntryType =
  | 'bikeshare' | 'park_and_ride' | 'taxi_rank' | 'airport_terminal'
  | 'ferry_terminal' | 'brt_station' | 'rail_station';

export interface InteropEntry {
  id: number;
  name: string;
  type: InteropEntryType;
  lat: number;
  lng: number;
  description?: string;
  gtfs_stop_id?: string;
  connections?: Record<string, unknown>;
}
export interface Level {
  id: number;
  level_id: string;
  level_index: number;
  level_name: string;
  stop_id: string;
}
export type PathwayMode = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface Pathway {
  id: number;
  pathway_id: string;
  from_stop_id: string;
  to_stop_id: string;
  pathway_mode: PathwayMode;
  is_bidirectional: boolean;
  length?: number;
  traversal_time?: number;
  stair_count?: number;
  max_slope?: number;
  min_width?: number;
  signposted_as?: string;
  reversed_signposted_as?: string;
}

// ── Category 3 — Fleet, Ledger & Real-Time Operations ────────────────────────

// Fleet
export interface Vehicle {
  id: number;
  plate: string;
  agency_id: string | null;
  route_id: string | null;
  model: string | null;
  capacity: number | null;
  status: "active" | "inactive" | "suspended";
  notes: string | null;
  created_at: string;
  updated_at: string;
  agency?: Pick<Agency, "agency_id" | "agency_name">;
  route?: Pick<Route, "route_id" | "route_short_name">;
  drivers?: Driver[];
}

export interface Driver {
  id: number;
  name: string;
  phone: string | null;
  license_no: string | null;
  vehicle_id: number | null;
  status: "active" | "inactive";
  notes: string | null;
  created_at: string;
  updated_at: string;
  vehicle?: Pick<Vehicle, "id" | "plate">;
}

// Ledger
export interface SplitConfig {
  id: number;
  agency_id: string | null;
  vehicle_pct: number;
  sacco_pct: number;
  platform_pct: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: number;
  entity_type: "vehicle" | "agency" | "platform";
  entity_id: string;
  label: string;
  balance: number;
  currency: string;
  last_credited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: number;
  wallet_id: number;
  type: "credit" | "debit" | "hold" | "release";
  amount: number;
  balance_after: number;
  reference: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FleetRevenueSummary {
  vehicle_id: number;
  plate: string;
  route_id: string | null;
  total_revenue: number;
  split_count: number;
  last_split_at: string | null;
}

export interface RouteRevenueSummary {
  route_id: string;
  route_short_name: string | null;
  total_revenue: number;
  split_count: number;
}

// Real-Time
export interface VehiclePosition {
  id: number;
  vehicle_id: number;
  trip_id: string | null;
  lat: number;
  lng: number;
  bearing: number | null;
  speed_kmh: number | null;
  recorded_at: string;
  vehicle?: Pick<Vehicle, "id" | "plate">;
}

export interface GhostTrip {
  trip_id: string;
  headsign: string | null;
  route_id: string;
  route_short_name: string | null;
  route_color: string | null;
  first_stop_lat: number | null;
  first_stop_lng: number | null;
}

export interface LivePositionResponse {
  positions: VehiclePosition[];
  ghost_trips: GhostTrip[];
  active_vehicle_count: number;
}

export interface LiveStats {
  active_vehicles: number;
  avg_delay_s: number;
  on_time_pct: number;
}

export interface DelayDashboard {
  on_time_pct: number;
  avg_delay_s: number;
  trips_tracked: number;
  worst_routes: Array<{
    route_id: string;
    avg_delay_s: number;
    on_time_pct: number;
    sparkline: number[];
  }>;
}

export interface DelayHeatmapCell {
  day_of_week: number;
  hour_of_day: number;
  avg_delay_s: number;
  sample_count: number;
}

// Service Alerts
export interface ServiceAlert {
  id: number;
  title: string;
  description: string | null;
  severity: "info" | "warning" | "critical";
  effect: "detour" | "reduced_service" | "cancellation" | "other";
  status: "draft" | "active" | "expired";
  affected_type: "route" | "stop" | "all";
  affected_id: string | null;
  starts_at: string;
  ends_at: string | null;
  auto_generated: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Incidents
export interface Incident {
  id: number;
  type: "accident" | "near_miss" | "crime" | "infrastructure" | "other";
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "investigating" | "resolved";
  route_id: string | null;
  stop_id: string | null;
  vehicle_id: number | null;
  description: string;
  response_taken: string | null;
  resolved_at: string | null;
  resolution_time_mins: number | null;
  reported_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  vehicle?: Pick<Vehicle, "id" | "plate">;
}

export interface IncidentStats {
  open_count: number;
  critical_count: number;
  resolved_this_month: number;
  avg_resolution_mins: number | null;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
}
