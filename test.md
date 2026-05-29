Suggestion fo route builder(editor ):
Mapbox Map Matching API — instead of Directions (road-snapping between sparse waypoints), send the raw GPS trace to /matching/v5/mapbox/driving for sub-metre snapping to actual road geometry
GPX / KML import — drop a field-survey GPS track file onto the map and auto-load the coordinates as shapePoints, instantly routing from real ground-truth data
AI route optimizer (Gemini already integrated) — describe the route in plain text ("from Westlands to CBD via Uhuru Highway") and let the model resolve landmarks to coordinates and draft the shape
Headway-based schedule generator — enter "first departure 05:30, every 15 min until 22:00" and auto-fill all arrival/departure times in the stop sequence, GTFS-compliant
Isochrone overlay — for each selected stop, call Mapbox Isochrone API and shade reachable areas on-foot in 5/10/15 min, so planners can see actual pedestrian catchment
Multi-variant trip management — inbound, outbound, peak, off-peak as separate trip layers within the same route, switchable in the left panel
Split / merge shape segments — right-click any point on the drawn line to split the route into two named segments (ideal for express vs local variants)
Conflict heatmap — overlay existing routes as semi-transparent colored lines so planners immediately see overlap/coverage gaps before saving
Live OTP test run — one-click that posts the current shape + stops to OpenTripPlanner's sandbox and displays computed itineraries in a side drawer before any commit
Git-like version history — every save writes a version record (author, timestamp, diff of stop count / shape length). Rollback to any past version from a history timeline panel
Collaborative cursors — WebSocket broadcast of other admin users' map positions and edits in real-time (like Figma), showing who else is editing the same route
Elevation profile — below the map, render a D3 chart of elevation along the shape using Mapbox Terrain-DEM, helping identify steep sections that affect bus performance
Automated stop gap detection — after drawing the shape, highlight sections longer than X km with no stop and suggest inserting one, preventing under-served segments
Ridership heatmap layer — toggle to overlay journey_logs data aggregated per stop as a colour-scaled circle, directly informing stop priority during route design
Export to GTFS ZIP — one-click export of the current route + trips + shapes as a standards-compliant GTFS feed, ready for OTP ingestion or submission to transit authorities



25 Senior-Level Architectural Improvements
Data Modeling
Route patterns as first-class entities (this plan) — canonical stop sequences per route/direction; variants become patterns, not duplicated trips. Reduces stop_times explosion for high-frequency routes.
Service calendars with exception handling (this plan) — replace string service_id with calendar model + calendar_dates exception layer. Makes OTP scheduling correct instead of "synthetic all-week."
Frequency-based trips (this plan) — trip_frequencies table models headway scheduling; essential for matatu informal transit where fixed departure times don't exist.
Agency model (this plan) — multi-operator FK replaces hardcoded 'hopln' string. Prerequisite for Mombasa/Kisumu expansion and ingesting third-party GTFS feeds.
Route shape versioning — add route_shape_history(shape_id, route_id, created_by, snapshot JSONB, created_at) append-only table. Active shape stays on trips.shape_id. Enables geometry rollback and operational audit.
Performance Optimization
Materialized view for stop search — replace denormalized aliases text column + trigram index with a PostgreSQL materialized view stop_search_mv(stop_id, tsv tsvector) refreshed via trigger on stop insert/update. Faster, fully index-friendly full-text without string mutations.
Redis shape cache — cache shape_id → [[lng,lat],...] in Redis with 1-hour TTL. Shape::getPointsAttribute() checks Redis before firing a PostGIS query. Eliminates per-shape N+1 query on bulk map loads.
Cursor-based pagination — replace OFFSET pagination (slow beyond page 20 on large tables) with keyset pagination: WHERE trip_id > $cursor ORDER BY trip_id LIMIT N. Add cursor response field alongside existing page/total.
Bulk stop_times upsert — ConsoleRouteController::updateStopSequence() loops and calls updateOrCreate per stop. Replace with single INSERT … ON CONFLICT (trip_id, stop_sequence) DO UPDATE batch. Reduces N round-trips to 1.
stop_times partitioning — add route_id as denormalized column to stop_times; declare PostgreSQL declarative partition by route_id list. Each route's stop times become an isolated partition — critical for a city-scale dataset.
GTFS Compliance
Fix GtfsExportService (this plan) — writeStops() and writeShapes() reference non-existent DB columns; results in broken OTP sync. Fix with PostGIS extraction queries and ST_DumpPoints().
GTFS validation engine (this plan) — pre-export + on-demand validation with structured error/warning DTOs. Blocks invalid data from reaching OTP.
GTFS feed versioning — gtfs_feed_versions(id, exported_at, triggered_by, file_checksums JSONB, validation_result JSONB, otp_status). Each successful OTP sync creates an immutable version record. Enables rollback to a known-good feed with a single API call.
GTFS-RT alert feed — service_alerts(id, title, description, effect, cause, affected_route_ids[], active_period) table + GET /api/v1/gtfs-rt/alerts endpoint returning protobuf FeedMessage. Mobile app subscribes; operators publish disruptions through the console.
transfers.txt support — stop_transfers(from_stop_id, to_stop_id, transfer_type, min_transfer_time) table exported in OTP sync. Allows OTP to model correct walk-time at interchanges (e.g., Kencom ↔ GPO, 3 min walk).
Real-Time Operations
Service disruption model — service_disruptions(title, description, type: planned|unplanned|diversion, affected_routes[], affected_stops[], active_from, active_until, status: draft|active|resolved). Console operators create these; mobile app surfaces them as banners above journey results.
Crowdsourced delay aggregation — aggregate contributions of type delay_report by route + time window. ≥3 reports in 15 min auto-creates a service_disruption (pending moderator approval) and emits a GTFS-RT TripUpdate. Closes the loop between community data and routing engine.
GTFS-RT TripUpdates endpoint — GET /api/v1/gtfs-rt/trip-updates builds StopTimeUpdates from aggregated delay contributions. OTP 2.x supports GTFS-RT subscription; live delays affect routing without a full re-sync.
Vehicle position tracking — vehicle_positions(trip_id, vehicle_id, lat, lng, bearing, speed, recorded_at) table. Driver mode in mobile app pushes positions. GET /api/v1/gtfs-rt/vehicle-positions outputs GTFS-RT VehiclePosition feed. Enables "where is my bus" map in the mobile app.
Predictive arrival ETAs — background job computes predicted_arrival_times per stop using vehicle positions + historical stop_times. Results cached in Redis, exposed at GET /api/v1/stops/:id/arrivals. Mobile app shows live countdown at each stop.
Scalability & Architecture
Multi-city namespacing — add city_id FK (references a cities table) to routes, stops, trips, shapes. All console API queries scope by the authenticated user's city_id. OTP sync generates per-city GTFS feeds from isolated data. Enables Mombasa, Kisumu, Kampala from one codebase.
Dedicated queue topology — split into: otp-sync (1 worker, serialized), notifications (3 workers), contributions (2 workers), geo (snap-to-roads, walking cache). A slow 2-minute OTP rebuild no longer blocks user-facing push notifications.
Read replica for analytics — route AnalyticsController and dashboard aggregate queries to DB::connection('analytics') (PostgreSQL streaming replica). Prevents GROUP BY/window-function queries from holding locks on the OLTP primary.
Immutable GTFS audit log — gtfs_audit_log(entity_type, entity_id, action: created|updated|deleted, changed_by, old_values JSONB, new_values JSONB, created_at) populated by Eloquent creating/updating/deleting Model observers. Append-only. Required for regulatory compliance and data forensics.
Data quality dashboard — GET /api/v1/console/data-quality returns: % routes with shapes, % trips with complete stop sequences, % trips with valid service_ids, orphaned shapes (no trip), stops with zero routes, trips with no stop_times. Frontend renders as a scored quality card on the Dashboard. Operators see gaps before triggering OTP sync rather than discovering them after a failed build.



Part B — 40 Suggestions: Universal Transit Network Platform
Category 1 — Network Modeling & Design (core)
1. Visual Network Graph Editor Replace table-only editing with a force-directed graph canvas (using D3 or React Flow) where routes appear as edges and stops as nodes. Operators drag to connect, merge, and split routes. Graph layout algorithms surface natural clusters (corridors, terminals).

2. Corridor Designer A "corridor" is a shared trunk (e.g., Thika Road) that multiple routes use. Model corridors as first-class entities with their own shape; routes inherit the corridor geometry for the shared segment and diverge at branch points. Reduces shape duplication and makes reroutes a single edit.

3. Stop Catchment & Walk-Shed Analysis For any selected stop, compute and overlay a 5/10/15-minute walking isochrone using the OSM pedestrian network (via OTP or Valhalla). Show population estimates inside each shed. Used to justify new stops or flag stops with zero catchment.

4. Network Coverage Heatmap Grid the city at 250 m resolution. For each cell, compute the closest stop's walking distance. Color-code cells red (>15 min walk), yellow (10–15 min), green (<10 min). Updates live as stops are added/removed. The single most actionable planning view.

5. Isochrone / Reachability Map Pick any origin stop or map point → render the transit reachability bubble at 15/30/45/60 min (calls OTP isochrone endpoint). Lets planners compare "before/after new route" scenarios visually.

6. Desire-Line Overlay Import an OD (origin–destination) matrix (from mobile-app journey logs or an external survey). Render desire lines scaled by demand. Gaps between high-demand OD pairs and existing routes → route placement recommendations.

7. Network Snapshot / Versioning Every time a route, shape, or stop is saved, write a network_snapshots immutable record (entity_type, entity_id, snapshot_json, saved_by, label). UI shows a timeline slider: "Show network as of 3 months ago." Diff view highlights added/removed stops and shape changes. Essential for accountability and rollback.

8. Scenario / What-If Workspace A "scenario" is a named, isolated copy of the network (forked from production at a point in time). Operators edit the scenario freely — add routes, extend shapes — without affecting live data. A side-by-side map compares the scenario vs. the live network. "Publish scenario" promotes it to production with a single action.

9. Transfer Graph & Connectivity Score Compute a stop-level transfer graph: edges between stops where a passenger can transfer within 400 m / 10 min. Surface the largest weakly-connected components — isolated sub-networks that can't reach the city center. Connectivity score = % of stops reachable from the central node within 60 min.

10. Route Variant Manager Beyond GTFS route patterns: a dedicated UI for managing multiple variants of the same route (express, local, peak-only, school). Variant diff view shows which stops are added/removed relative to the canonical pattern. One-click "promote variant to main" swaps the canonical flag.

Category 2 — Scheduling & Timetables
11. Visual Timetable Editor A spreadsheet-like grid: rows = stops, columns = trips, cells = departure times. Click a cell to edit. Tab advances to next. Keyboard-navigable. Auto-propagates headway if shift key held ("fill column with 15-min headway from this time"). Exports to GTFS stop_times.

12. Headway / Frequency Optimizer Input: target headway per time window (peak 5 min, off-peak 20 min). Output: minimum fleet size required, generated trip set, a time-space diagram. Useful for converting informal "runs whenever" service into GTFS-compliant scheduled or frequency-based trips.

13. Time-Space Diagram For a selected route: x-axis = time (0–24h), y-axis = stop sequence. Each trip is a diagonal line. Visual confirmation of even headways, overtaking (crossing lines → impossible), and layover times at terminals. Standard railroading tool, rarely seen in bus planning software.

14. Layover & Recovery Time Planner For each terminal, track the planned layover (turnaround time) per trip. Surface trips with <3 min recovery (schedule is unreliable) and flag them. Allow bulk-setting minimum recovery time for a route — pushes all departure times accordingly.

15. Block / Vehicle Duty Builder A "block" is a continuous vehicle duty (trip A → deadhead → trip B → ...). Visualize all trips on a vehicle diagram: detect illegal sequences (return trip departs before inbound arrives), compute total vehicle-hours and fleet size. Export as trips.txt block_id column.

16. Service Calendar Bulk Editor Calendar matrix view: rows = service_id, columns = weeks of the year. Click to toggle exceptions for specific dates (holidays, school breaks). One row per calendar; one click per date exception. Dramatically faster than editing calendar_dates one row at a time.

Category 3 — Real-Time & Operations
17. Live Vehicle Map (GTFS-RT) Consume a GTFS-RT VehiclePositions feed (or push from the driver mobile app) and render live vehicle bubbles on the map. Color = route color. Tooltip = trip ID, headsign, delay. "Ghost trips" (scheduled but no vehicle detected) appear as faded bubbles.

18. Delay & On-Time Performance Dashboard Aggregate GTFS-RT TripUpdates vs. scheduled times. Per-route: on-time %, average delay at each stop, delay heatmap by time-of-day. Per-day sparklines show trends. Surface the top-5 worst performing routes weekly. Data retained 90 days.

19. Service Alert Publisher Operators create structured disruption alerts: affected routes/stops, active period, severity, effect (detour / reduced frequency / cancelled). Published instantly as a GTFS-RT Alerts feed consumed by the mobile app and any third-party journey planners.

20. Automated Crowdsourced Delay Aggregation Aggregation engine: if ≥3 delay_report contributions on the same route arrive within 15 minutes, auto-create a draft service alert, notify the on-duty operator via in-app notification, and suppress OTP journey cache for that route. Closes the feedback loop without operator manual intervention.

21. Incident / Safety Log Structured incident records: incident_type (accident, near-miss, crime, infrastructure failure), affected route/stop, description, severity, response taken, resolved_at. Dashboard shows open incidents. Monthly PDF report auto-generated. Required for operator licensing in most jurisdictions.

22. Vehicle Position History & Playback Store vehicle positions at 30-second granularity for 7 days. Playback slider lets operators replay any trip to diagnose: "Why was the 08:15 107D late on Tuesday?" — watch the vehicle track, see where it slowed. Evidence for driver coaching and schedule adjustment.

Category 4 — Data Quality & Compliance
23. Continuous Data Quality Score A scored dashboard card (0–100) updated hourly: % routes with complete shapes, % scheduled trips with full stop_times, % stops with correct coordinates (within city bounds), % service_ids with valid calendar, orphan shapes, duplicate stop locations. Each metric is a drill-down list. Makes data gaps visible before OTP sync fails.

24. GTFS Feed Validator (official) Integrate Google's gtfs-validator (Java CLI or HTTP) into the export pipeline. Run it on the exported GTFS zip. Display structured errors/warnings with rule codes (e.g., E002, W005) and links to the official GTFS spec. More authoritative than the custom validator.

25. Multi-Format Export Beyond GTFS: export to NeTEx (European standard, required for EU MMTIS compliance), TransXChange (UK), GTFS-Flex (demand-responsive), and CSV/Excel for government reporting. A pluggable exporter architecture with a single "Export As" dropdown.

26. OSM Integration — Snap Stops to Roads When a stop is placed on the map, auto-snap its coordinates to the nearest OSM footway or bus_stop node using an OSM snap API. Flags stops that are >25 m from any road (likely placed on a building). Reduces the most common source of OTP routing failures.

27. Shape Quality Inspector For each trip shape: compute shape-stop gap (how far each stop is from the shape), flag reversals (shape doubles back), flag teleports (gap > 500 m between consecutive shape points). Show inline on the map as red segments. Fix suggestions: "Snap stop to shape", "Auto-extend shape to stop."

28. Duplicate Stop Detector Find stop pairs within 50 m of each other with similar names (fuzzy match). Present a merge UI: pick canonical ID, redirect all stop_times to the surviving stop, delete the duplicate. Run automatically as a background job weekly.

Category 5 — Multi-Modal & Multi-Agency
29. Multi-Modal Layer Manager The map has toggleable layers: matatu routes, BRT corridors, railway lines, ferry terminals, cycling infrastructure, pedestrian areas. Operators see the full mobility context when planning routes. Layers are pulled from GTFS + OSM, not manually entered.

30. Fare Zone Designer Draw fare zones on the map (polygon editor). Assign fares to zone-pair transitions. Generate GTFS fare_attributes.txt and fare_rules.txt. Preview: "A trip from Zone A to Zone C via Zone B = Ksh 70." Essential for operators preparing for regulated fare structures.

31. Multi-Agency Network View When multiple agencies exist, show all agencies' routes on the same map. Filter by agency. Cross-agency transfer points highlighted. "Transfer quality" score per interchange: are schedules aligned so passengers can transfer without long waits?

32. Interoperability Registry A catalog of external systems this network connects to: city bikeshare stations, park-and-ride lots, taxi ranks, airport terminals. Each entry has coordinates + a connection type. Rendered as icons on the map. Exported as pathways.txt and levels.txt in GTFS.

Category 6 — Analytics & Business Intelligence
33. Route Profitability Model Input: fare price, estimated daily ridership (from journey logs or manual entry), vehicle cost per km, driver cost per hour. Output: estimated revenue, cost, and margin per route. Surface the top-5 loss-making routes. Not accounting software — a planning heuristic.

34. Demand Forecasting (AI) Train a lightweight time-series model on journey log data: route_id × hour_of_day × day_of_week → predicted_ridership. Display forecasts for the next 7 days. "Route 23 will be 40% over normal capacity on Friday — consider adding a trip." Retrains weekly.

35. Network Performance Report (Auto-generated PDF) Weekly/monthly PDF report: coverage stats, ridership trends, top 10 delays, new stops added, data quality score trend, GTFS export history. Auto-emailed to configured recipients. Regulators often require monthly reports; this generates them with zero manual effort.

36. Rider Feedback Heatmap Aggregate contribution delay_report and stop_review data spatially. Heatmap intensity = number of complaints per 500 m cell over the last 30 days. Overlaid on the route map. High-complaint zones without a service alert → investigate.

Category 7 — Developer & Operator Tooling
37. Public API with API Key Management A developer portal within the console: issue API keys with scopes (read:gtfs, read:realtime, write:alerts), rate limits, and usage stats. Third-party apps (journey planners, academic researchers, city open data portals) consume the GTFS and GTFS-RT feeds with a stable versioned API.

38. Webhook / Event Bus Operators register webhook URLs. Events: trip.created, route.updated, alert.published, otp.sync_completed, gtfs.validation_failed. Payload is a structured JSON event. Enables downstream integrations (Slack notifications, custom dashboards) without polling.

39. Bulk Import from GPS Traces Upload a GPX or CSV of raw vehicle GPS traces. The importer: clusters traces by route, snaps the median trace to OSM roads, proposes a shape geometry, detects stop candidates from dwell-time clusters. Operator reviews and confirms. Turns informal field data into GTFS shapes in minutes.

40. Audit Log & Compliance Trail Every create/update/delete on any entity (route, stop, trip, shape, calendar) writes an append-only audit_log record: entity_type, entity_id, action, changed_by, old_values JSONB, new_values JSONB, created_at. Console UI: filter by entity or user. Export as CSV for regulatory compliance or legal discovery. Cannot be deleted — only superadmin can view.




Here are the 40 suggestions, organized by category:

Category 1 — Network Modeling & Design
1. Visual Network Graph Editor — Force-directed graph canvas (React Flow/D3) where routes are edges and stops are nodes. Drag to connect/split/merge routes.

2. Corridor Designer — Model shared trunk roads (e.g., Thika Road) as first-class entities. Routes inherit corridor geometry and diverge at branch points. One reroute edit propagates to all routes using the corridor.

3. Stop Catchment & Walk-Shed Analysis — 5/10/15-min walking isochrones per stop via OTP/Valhalla. Show population estimates inside each shed to justify stop placement.

4. Network Coverage Heatmap — 250 m grid of the city. Color each cell by nearest stop walking distance (green/yellow/red). Updates live as the network changes. The most actionable single planning view.

5. Isochrone / Reachability Map — Pick any origin → OTP renders 15/30/45/60-min reachability bubble. Compare "before vs. after new route" side-by-side.

6. Desire-Line Overlay — Import an OD matrix from journey logs or a survey. Render demand-weighted desire lines. Gaps between high-demand pairs and existing routes → route placement recommendations.

7. Network Snapshot / Versioning — Immutable network_snapshots table on every save. Timeline slider shows the network as it was on any past date. Diff view highlights what changed.

8. Scenario / What-If Workspace — Fork a named copy of the network. Edit freely without touching production. Side-by-side map compare. "Publish scenario" to promote to production.

9. Transfer Graph & Connectivity Score — Graph of stops reachable by transfer within 400 m / 10 min. Finds isolated sub-networks. Score = % of stops reachable from the city center in 60 min.

10. Route Variant Manager — Express / local / peak-only / school variants under one route. Diff view shows stops added/removed vs. canonical. One-click to swap canonical.

Category 2 — Scheduling & Timetables
11. Visual Timetable Editor — Spreadsheet grid: stops × trips, cells = departure times. Tab-navigable. Shift-hold fills headway. Exports to stop_times.txt.

12. Headway / Frequency Optimizer — Input target headway per time window → output minimum fleet size, generated trip set, time-space diagram.

13. Time-Space Diagram — x = time, y = stop sequence, each trip = diagonal line. Visually reveals overtaking (illegal), uneven gaps, and terminal layover time.

14. Layover & Recovery Time Planner — Track turnaround time per terminal per trip. Flag trips with <3 min recovery. Bulk-set minimum recovery and push departure times automatically.

15. Block / Vehicle Duty Builder — Model continuous vehicle duties (trip → deadhead → trip). Detect illegal sequences. Compute vehicle-hours / fleet size. Exports block_id to trips.txt.

16. Service Calendar Bulk Editor — Year-view matrix: rows = calendars, columns = weeks. One click toggles a date exception. Faster than editing calendar_dates.txt rows individually.

Category 3 — Real-Time & Operations
17. Live Vehicle Map (GTFS-RT) — Render vehicles from a GTFS-RT VehiclePositions feed or the driver app. Ghost trips (scheduled but no vehicle) shown as faded.

18. Delay & On-Time Performance Dashboard — Per-route: on-time %, delay by stop, heatmap by hour. Top-5 worst routes. 90-day retention.

19. Service Alert Publisher — Structured disruption alerts (detour / cancelled / reduced frequency). Published as GTFS-RT Alerts. Consumed by the mobile app instantly.

20. Automated Crowdsourced Delay Aggregation — ≥3 delay_report contributions on same route within 15 min → auto-create draft alert, notify on-duty operator, suppress journey cache.

21. Incident / Safety Log — Structured incident records (accident, near-miss, crime, infrastructure failure). Open incident dashboard. Monthly PDF auto-generated.

22. Vehicle Position History & Playback — 30-second granularity, 7-day retention. Slider to replay any trip. "Why was the 08:15 107D late?" answered visually.

Category 4 — Data Quality & Compliance
23. Continuous Data Quality Score — Hourly 0–100 score: % routes with shapes, % trips with stop_times, % stops in-bounds, orphans, duplicates. Each metric drills down to a fix list.

24. Official GTFS Feed Validator — Integrate Google's gtfs-validator (Java CLI). Show rule codes (E002, W005) with links to the GTFS spec. More authoritative than a custom validator.

25. Multi-Format Export — NeTEx (EU), TransXChange (UK), GTFS-Flex, CSV/Excel. Pluggable exporter architecture, single "Export As" dropdown.

26. OSM Snap-to-Road — When a stop is placed, auto-snap to nearest OSM footway/bus_stop node. Flag stops >25 m from any road (likely placed on a building).

27. Shape Quality Inspector — Per-shape: compute stop-to-shape gaps, flag reversals, flag teleports (>500 m jump between shape points). Show red segments on map with "Auto-fix" suggestions.

28. Duplicate Stop Detector — Find stop pairs <50 m apart with similar names. Merge UI: pick canonical, redirect all stop_times, delete duplicate. Weekly background job.

Category 5 — Multi-Modal & Multi-Agency
29. Multi-Modal Layer Manager — Toggleable map layers: matatu, BRT, SGR rail, ferry, cycling, pedestrian. Pulled from GTFS + OSM, not manually entered.

30. Fare Zone Designer — Draw fare zone polygons on the map. Assign fares to zone-pair transitions. Preview "Zone A → C = Ksh 70". Generates fare_attributes.txt + fare_rules.txt.

31. Multi-Agency Network View — All agencies' routes on one map. Cross-agency transfer points highlighted. Transfer quality score per interchange.

32. Interoperability Registry — Catalog external connection points (bikeshare, park-and-ride, taxi ranks, airports) with coordinates and type. Exported as pathways.txt / levels.txt.

Category 6 — Analytics & BI
33. Route Profitability Model — Input: fare + ridership estimate + vehicle cost/km + driver cost/hr → estimated margin per route. Surface top-5 loss-making routes.

34. AI Demand Forecasting — Time-series model on journey logs: route × hour × day → predicted ridership. 7-day forecasts. "Route 23 will be 40% over capacity Friday — add a trip." Retrains weekly.

35. Auto-Generated PDF Reports — Weekly/monthly: coverage stats, ridership trends, top delays, data quality score, GTFS export history. Auto-emailed to configured recipients.

36. Rider Feedback Heatmap — Spatial heatmap of delay_report + stop_review contributions over 30 days. High-complaint zones without an active alert → flag for investigation.

Category 7 — Developer & Operator Tooling
37. Public API + Key Management — In-console developer portal: issue scoped API keys (read:gtfs, write:alerts), rate limits, usage stats. Stable versioned GTFS + GTFS-RT endpoints for third parties.

38. Webhook / Event Bus — Register webhook URLs. Events: trip.created, alert.published, otp.sync_completed, gtfs.validation_failed. Enables Slack, custom dashboards, and downstream integrations without polling.

39. Bulk Import from GPS Traces — Upload GPX/CSV vehicle traces → cluster by route → snap median trace to OSM → propose shape + stop candidates from dwell-time clusters → operator review-and-confirm.

40. Audit Log & Compliance Trail — Append-only audit_log: every create/update/delete on any entity, with old_values JSONB + new_values JSONB. Filter by entity or user. CSV export. Superadmin-only view. Cannot be deleted.