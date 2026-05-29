import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Map, { Marker, Source, Layer, NavigationControl } from "react-map-gl/mapbox";
import { fetchVehicles } from "@/api/fleet";
import { fetchPositionHistory, fetchAvailableDates } from "@/api/realtime";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon } from "lucide-react";
import type { VehiclePosition } from "@/types";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
const NAIROBI = { longitude: 36.8219, latitude: -1.2921, zoom: 11 };

const SPEEDS = [1, 5, 20] as const;

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}

export function PositionPlaybackPage() {
  const [vehicleId, setVehicleId] = React.useState<string>("");
  const [date, setDate]           = React.useState<string>("");
  const [loaded, setLoaded]       = React.useState(false);

  // Playback state
  const [frame, setFrame]     = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed]     = React.useState<typeof SPEEDS[number]>(1);
  const intervalRef           = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: vehiclesPage } = useQuery({
    queryKey: ["vehicles-simple"],
    queryFn: () => fetchVehicles({ status: "active" }),
    staleTime: 120_000,
  });
  const vehicles = vehiclesPage?.data ?? [];

  const { data: dates = [] } = useQuery({
    queryKey: ["playback:dates", vehicleId],
    queryFn: () => fetchAvailableDates(parseInt(vehicleId)),
    enabled: !!vehicleId,
    staleTime: 300_000,
  });

  const { data: positions = [], isFetching } = useQuery({
    queryKey: ["playback:positions", vehicleId, date],
    queryFn: () => fetchPositionHistory({ vehicle_id: parseInt(vehicleId), date }),
    enabled: loaded && !!vehicleId && !!date,
    staleTime: 300_000,
  });

  // Reset frame when positions change
  React.useEffect(() => {
    setFrame(0);
    setPlaying(false);
  }, [positions]);

  // Playback ticker
  React.useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!playing || positions.length === 0) return;
    intervalRef.current = setInterval(() => {
      setFrame(f => {
        if (f >= positions.length - 1) { setPlaying(false); return f; }
        return f + 1;
      });
    }, Math.round(1000 / speed));
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, positions.length]);

  const current = positions[frame] as VehiclePosition | undefined;

  // Build trail GeoJSON (last 20 points)
  const trailCoords = positions.slice(Math.max(0, frame - 20), frame + 1).map(p => [p.lng, p.lat]);
  const trailGeo = {
    type: "Feature" as const,
    geometry: { type: "LineString" as const, coordinates: trailCoords },
    properties: {},
  };

  // Stats
  const durationSecs = positions.length > 1
    ? Math.round((new Date(positions[positions.length - 1].recorded_at).getTime() - new Date(positions[0].recorded_at).getTime()) / 1000)
    : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Controls header */}
      <div className="border-b bg-background px-4 py-3 flex flex-wrap items-center gap-3">
        <Select value={vehicleId} onValueChange={v => { setVehicleId(v); setDate(""); setLoaded(false); }}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Select vehicle…" /></SelectTrigger>
          <SelectContent>
            {vehicles.map(v => (
              <SelectItem key={v.id} value={String(v.id)}>{v.plate}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={date} onValueChange={v => { setDate(v); setLoaded(false); }} disabled={!vehicleId}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Select date…" /></SelectTrigger>
          <SelectContent>
            {dates.map(d => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          disabled={!vehicleId || !date || isFetching}
          onClick={() => setLoaded(true)}
        >
          {isFetching ? "Loading…" : "Load"}
        </Button>

        {positions.length > 0 && (
          <span className="text-xs text-muted-foreground ml-2">
            {positions.length} positions · {formatDuration(durationSecs)}
          </span>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={current
            ? { longitude: current.lng, latitude: current.lat, zoom: 14 }
            : NAIROBI}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/light-v11"
        >
          <NavigationControl position="top-right" />

          {/* Trail line */}
          {trailCoords.length > 1 && (
            <Source id="trail" type="geojson" data={trailGeo}>
              <Layer
                id="trail-line"
                type="line"
                paint={{ "line-color": "#3b82f6", "line-width": 3, "line-opacity": 0.7 }}
              />
            </Source>
          )}

          {/* Current position marker */}
          {current && (
            <Marker longitude={current.lng} latitude={current.lat} anchor="center">
              <div
                style={{ transform: current.bearing != null ? `rotate(${current.bearing}deg)` : undefined }}
                className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-lg"
              />
            </Marker>
          )}
        </Map>
      </div>

      {/* Timeline bar */}
      {positions.length > 0 && (
        <div className="border-t bg-background px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setFrame(0)}>
              <SkipBackIcon className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setPlaying(p => !p)}>
              {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setFrame(positions.length - 1)}>
              <SkipForwardIcon className="size-4" />
            </Button>

            <div className="flex-1">
              <Slider
                min={0}
                max={positions.length - 1}
                value={[frame]}
                onValueChange={([v]) => setFrame(v)}
                step={1}
              />
            </div>

            <span className="text-xs font-mono text-muted-foreground w-16 text-right">
              {current ? new Date(current.recorded_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
            </span>

            <Select value={String(speed)} onValueChange={v => setSpeed(parseInt(v) as typeof speed)}>
              <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1×</SelectItem>
                <SelectItem value="5">5×</SelectItem>
                <SelectItem value="20">20×</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {current && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Frame {frame + 1} / {positions.length}</span>
              {current.speed_kmh != null && <span>{current.speed_kmh} km/h</span>}
              {current.bearing   != null && <span>{current.bearing}°</span>}
            </div>
          )}
        </div>
      )}

      {isFetching && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
          <Skeleton className="h-8 w-40" />
        </div>
      )}
    </div>
  );
}
