import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Map, { Marker, Source, Layer } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { SearchIcon, AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { fetchShapeInspector } from "@/api/quality";
import { fetchTrips } from "@/api/trips";
import { fetchRoutes } from "@/api/routes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ShapeInspectorResult } from "@/types";

const MAPBOX_TOKEN   = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const DEFAULT_CENTER = { latitude: -1.2921, longitude: 36.8219, zoom: 11 };

export default function ShapeInspectorPage() {
  const mapRef = React.useRef<MapRef>(null);

  const [routeId, setRouteId]   = React.useState<string>("");
  const [tripId, setTripId]     = React.useState<string>("");
  const [activeTripId, setActiveTripId] = React.useState<string>("");

  const { data: routesData } = useQuery({
    queryKey: ["routes", { per_page: 200 }],
    queryFn:  () => fetchRoutes({ per_page: 200 }),
  });

  const { data: tripsData } = useQuery({
    queryKey: ["trips", { route_id: routeId, per_page: 200 }],
    queryFn:  () => fetchTrips({ route_id: routeId, per_page: 200 }),
    enabled:  !!routeId,
  });

  const { data: result, isLoading } = useQuery<ShapeInspectorResult>({
    queryKey: ["quality:shape-inspector", activeTripId],
    queryFn:  () => fetchShapeInspector(activeTripId),
    enabled:  !!activeTripId,
  });

  // Build GeoJSON sources from result
  const shapeGeoJson = React.useMemo(() => {
    if (!result) return null;
    // We need shape coords — use stop_gaps to draw approximate path via stops
    const coords = result.stop_gaps.map((s) => [s.lng, s.lat] as [number, number]);
    return {
      type: "FeatureCollection" as const,
      features: coords.length >= 2 ? [{
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: coords },
        properties: {},
      }] : [],
    };
  }, [result]);

  // Fit map to stop bounds when result loads
  React.useEffect(() => {
    if (!result || !mapRef.current || result.stop_gaps.length === 0) return;
    const lngs = result.stop_gaps.map((s) => s.lng);
    const lats = result.stop_gaps.map((s) => s.lat);
    mapRef.current.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 60, duration: 800 }
    );
  }, [result]);

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <h1 className="text-xl font-semibold">Shape Inspector</h1>

      {/* Selectors */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-72">
          <Select value={routeId} onValueChange={(v) => { setRouteId(v); setTripId(""); }}>
            <SelectTrigger><SelectValue placeholder="Select route…" /></SelectTrigger>
            <SelectContent>
              {(routesData?.data ?? []).map((r) => (
                <SelectItem key={r.route_id} value={r.route_id}>
                  {r.route_short_name} — {r.route_long_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-72">
          <Select value={tripId} onValueChange={setTripId} disabled={!routeId}>
            <SelectTrigger><SelectValue placeholder="Select trip…" /></SelectTrigger>
            <SelectContent>
              {(tripsData?.data ?? []).map((t) => (
                <SelectItem key={t.trip_id} value={t.trip_id}>
                  {t.trip_headsign ?? t.trip_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => setActiveTripId(tripId)}
          disabled={!tripId || isLoading}
        >
          <SearchIcon size={14} />
          Inspect
        </Button>
      </div>

      {!activeTripId && (
        <div className="text-center text-muted-foreground py-20 text-sm">
          Select a route and trip to inspect its shape geometry.
        </div>
      )}

      {activeTripId && isLoading && <Skeleton className="h-[400px] w-full" />}

      {result && (
        <>
          {/* Map */}
          <div className="rounded-lg overflow-hidden border" style={{ height: 400 }}>
            <Map
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={DEFAULT_CENTER}
              mapStyle="mapbox://styles/mapbox/streets-v12"
              style={{ width: "100%", height: "100%" }}
            >
              {/* Shape line via stop sequence */}
              {shapeGeoJson && shapeGeoJson.features.length > 0 && (
                <Source id="shape" type="geojson" data={shapeGeoJson}>
                  <Layer
                    id="shape-line"
                    type="line"
                    paint={{
                      "line-color": "#3b82f6",
                      "line-width": 3,
                      "line-opacity": 0.8,
                    } as object}
                  />
                </Source>
              )}

              {/* Stop markers */}
              {result.stop_gaps.map((stop) => (
                <Marker
                  key={stop.stop_id}
                  longitude={stop.lng}
                  latitude={stop.lat}
                  anchor="center"
                >
                  <div
                    className={`w-3 h-3 rounded-full border-2 border-white shadow ${stop.flagged ? "bg-red-500" : "bg-emerald-500"}`}
                    title={`${stop.stop_name} — ${stop.gap_m}m from shape`}
                  />
                </Marker>
              ))}
            </Map>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> OK (&le;100m)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Flagged (&gt;100m)</span>
            <span className="flex items-center gap-1"><span className="w-6 h-1 bg-blue-500 inline-block rounded" /> Shape</span>
          </div>

          {/* Issue panels */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Stop gaps */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                {result.flagged_stops_count > 0
                  ? <AlertTriangleIcon size={14} className="text-destructive" />
                  : <CheckCircle2Icon size={14} className="text-emerald-500" />}
                <span className="text-sm font-medium">Stop gaps</span>
                <Badge variant={result.flagged_stops_count > 0 ? "destructive" : "secondary"} className="ml-auto text-[10px]">
                  {result.flagged_stops_count} flagged
                </Badge>
              </div>
              <div className="space-y-1 max-h-48 overflow-auto">
                {result.stop_gaps.map((s) => (
                  <div key={s.stop_id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[130px]">{s.stop_name}</span>
                    <Badge
                      variant={s.flagged ? "destructive" : "outline"}
                      className="text-[10px] px-1 shrink-0"
                    >
                      {s.gap_m}m
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Teleports */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                {result.teleports.length > 0
                  ? <AlertTriangleIcon size={14} className="text-amber-500" />
                  : <CheckCircle2Icon size={14} className="text-emerald-500" />}
                <span className="text-sm font-medium">Teleports</span>
                <Badge variant={result.teleports.length > 0 ? "secondary" : "outline"} className="ml-auto text-[10px]">
                  {result.teleports.length}
                </Badge>
              </div>
              {result.teleports.length === 0 && (
                <p className="text-xs text-muted-foreground">No teleport gaps detected.</p>
              )}
              <div className="space-y-1 max-h-48 overflow-auto">
                {result.teleports.map((t, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Point {t.from_idx}→{t.to_idx}</span>
                    <Badge variant="secondary" className="text-[10px] px-1">{(t.distance_m / 1000).toFixed(1)} km</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Reversals */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                {result.reversals.length > 0
                  ? <AlertTriangleIcon size={14} className="text-amber-500" />
                  : <CheckCircle2Icon size={14} className="text-emerald-500" />}
                <span className="text-sm font-medium">Reversals</span>
                <Badge variant={result.reversals.length > 0 ? "secondary" : "outline"} className="ml-auto text-[10px]">
                  {result.reversals.length}
                </Badge>
              </div>
              {result.reversals.length === 0 && (
                <p className="text-xs text-muted-foreground">No sharp direction changes detected.</p>
              )}
              <div className="space-y-1 max-h-48 overflow-auto">
                {result.reversals.map((r, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Point {r.point_idx}</span>
                    <Badge variant="secondary" className="text-[10px] px-1">{r.bearing_change_deg}°</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
