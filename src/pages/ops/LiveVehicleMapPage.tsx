import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import { fetchLivePositions, fetchLiveStats } from "@/api/realtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioIcon, FilterIcon } from "lucide-react";
import type { VehiclePosition, GhostTrip } from "@/types";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

const NAIROBI = { longitude: 36.8219, latitude: -1.2921, zoom: 11 };

function formatAge(dateStr: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function BearingArrow({ bearing }: { bearing: number | null }) {
  if (bearing == null) return null;
  return (
    <div
      style={{ transform: `rotate(${bearing}deg)` }}
      className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0"
    >
      <div className="w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-white" />
    </div>
  );
}

export function LiveVehicleMapPage() {
  const [routeFilter, setRouteFilter] = React.useState("");
  const [showGhosts, setShowGhosts]   = React.useState(false);
  const [selected, setSelected]       = React.useState<VehiclePosition | GhostTrip | null>(null);

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["ops:live", routeFilter],
    queryFn: () => fetchLivePositions({ route_id: routeFilter || undefined }),
    refetchInterval: 5_000,
    staleTime: 4_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["ops:live-stats"],
    queryFn: fetchLiveStats,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const positions = data?.positions ?? [];
  const ghosts    = data?.ghost_trips ?? [];

  const ageStr = dataUpdatedAt ? formatAge(new Date(dataUpdatedAt).toISOString()) : "—";

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)]">
      {/* Top overlay bar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur border px-3 py-1.5 text-sm shadow">
          <RadioIcon className="size-3.5 text-green-500 animate-pulse" />
          <span className="font-medium">Live</span>
          <span className="text-muted-foreground text-xs">· Updated {ageStr}</span>
        </div>

        {stats && (
          <div className="rounded-full bg-background/90 backdrop-blur border px-3 py-1.5 text-sm shadow flex gap-3">
            <span><span className="font-semibold">{stats.active_vehicles}</span> <span className="text-muted-foreground">active</span></span>
            <span><span className="font-semibold">{stats.on_time_pct}%</span> <span className="text-muted-foreground">on-time</span></span>
            <span><span className="font-semibold">{stats.avg_delay_s}s</span> <span className="text-muted-foreground">avg delay</span></span>
          </div>
        )}
      </div>

      {/* Filter controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <div className="rounded-lg bg-background/90 backdrop-blur border p-2.5 shadow flex items-center gap-2">
          <FilterIcon className="size-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Filter by route…"
            value={routeFilter}
            onChange={e => setRouteFilter(e.target.value)}
            className="h-7 w-36 text-xs"
          />
        </div>
        <div className="rounded-lg bg-background/90 backdrop-blur border p-2.5 shadow flex items-center gap-2">
          <Switch id="ghosts" checked={showGhosts} onCheckedChange={setShowGhosts} />
          <Label htmlFor="ghosts" className="text-xs cursor-pointer">Ghost trips</Label>
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50">
          <Skeleton className="h-8 w-32" />
        </div>
      )}

      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={NAIROBI}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        onClick={() => setSelected(null)}
      >
        <NavigationControl position="bottom-right" />

        {/* Live vehicle markers */}
        {positions.map(pos => (
          <Marker
            key={pos.id}
            longitude={pos.lng}
            latitude={pos.lat}
            anchor="center"
            onClick={e => { e.originalEvent.stopPropagation(); setSelected(pos); }}
          >
            <div className="relative cursor-pointer">
              <BearingArrow bearing={pos.bearing} />
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-md hover:scale-125 transition-transform" />
            </div>
          </Marker>
        ))}

        {/* Ghost trip markers */}
        {showGhosts && ghosts.map(g => (
          g.first_stop_lat != null && g.first_stop_lng != null ? (
            <Marker
              key={`ghost-${g.trip_id}`}
              longitude={g.first_stop_lng}
              latitude={g.first_stop_lat}
              anchor="center"
              onClick={e => { e.originalEvent.stopPropagation(); setSelected(g); }}
            >
              <div
                className="w-4 h-4 rounded-full border-2 border-amber-400 bg-amber-100 opacity-60 cursor-pointer hover:opacity-100 transition-opacity shadow"
              />
            </Marker>
          ) : null
        ))}

        {/* Popup for live vehicle */}
        {selected && "vehicle_id" in selected && (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="bottom"
            offset={16}
            onClose={() => setSelected(null)}
            closeButton={false}
          >
            <div className="text-sm min-w-40">
              <p className="font-semibold font-mono">{(selected as VehiclePosition).vehicle?.plate ?? `Vehicle ${(selected as VehiclePosition).vehicle_id}`}</p>
              {(selected as VehiclePosition).trip_id && <p className="text-xs text-muted-foreground">Trip: {(selected as VehiclePosition).trip_id}</p>}
              {(selected as VehiclePosition).speed_kmh != null && (
                <p className="text-xs">{(selected as VehiclePosition).speed_kmh} km/h</p>
              )}
              <p className="text-xs text-muted-foreground">{formatAge((selected as VehiclePosition).recorded_at)}</p>
            </div>
          </Popup>
        )}

        {/* Popup for ghost trip */}
        {selected && "trip_id" in selected && !("vehicle_id" in selected) && (selected as GhostTrip).first_stop_lat != null && (
          <Popup
            longitude={(selected as GhostTrip).first_stop_lng!}
            latitude={(selected as GhostTrip).first_stop_lat!}
            anchor="bottom"
            offset={16}
            onClose={() => setSelected(null)}
            closeButton={false}
          >
            <div className="text-sm min-w-40">
              <Badge variant="outline" className="mb-1 bg-amber-50 text-amber-700 border-amber-200">Ghost trip</Badge>
              <p className="font-semibold">{(selected as GhostTrip).route_short_name ?? (selected as GhostTrip).route_id}</p>
              <p className="text-xs text-muted-foreground">{(selected as GhostTrip).headsign ?? (selected as GhostTrip).trip_id}</p>
              <p className="text-xs text-muted-foreground">Scheduled but no position</p>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
