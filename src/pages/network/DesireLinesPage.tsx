import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Map, { Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchDesireLines } from "@/api/network";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { TrendingUpIcon } from "lucide-react";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };

export default function DesireLinesPage() {
  const [minCount, setMinCount] = React.useState(1);

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["network:desire-lines"],
    queryFn: fetchDesireLines,
    staleTime: 120_000,
  });

  const filtered = lines.filter((l) => l.count >= minCount);

  const maxCount = lines.length > 0 ? Math.max(...lines.map((l) => l.count)) : 1;

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: filtered.map((l) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [l.from_lng, l.from_lat],
          [l.to_lng, l.to_lat],
        ],
      },
      properties: { count: l.count, from: l.from_name, to: l.to_name },
    })),
  };

  const top10 = [...lines].sort((a, b) => b.count - a.count).slice(0, 10);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left sidebar */}
      <div className="w-64 shrink-0 border-r bg-background flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 font-medium text-sm mb-3">
            <TrendingUpIcon size={15} />
            Desire Lines
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Min. journeys: {minCount}
              </label>
              <Slider
                min={1}
                max={Math.max(maxCount, 1)}
                step={1}
                value={[minCount]}
                onValueChange={([v]) => setMinCount(v)}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Showing {filtered.length} of {lines.length} pairs
            </div>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-xs font-medium text-muted-foreground mb-2">Top OD Pairs</div>
          <div className="space-y-1.5">
            {top10.map((l, i) => (
              <div key={i} className="text-xs">
                <div className="flex justify-between">
                  <span className="truncate flex-1 text-foreground/80">{l.from_name}</span>
                  <span className="font-medium tabular-nums ml-2">{l.count}</span>
                </div>
                <div className="text-muted-foreground truncate">→ {l.to_name}</div>
              </div>
            ))}
            {lines.length === 0 && !isLoading && (
              <p className="text-xs text-muted-foreground">
                No OD data. Journeys need matching stop names.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
            <Skeleton className="w-32 h-6" />
          </div>
        )}
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{ latitude: DEFAULT_CENTER.lat, longitude: DEFAULT_CENTER.lng, zoom: 11 }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          style={{ width: "100%", height: "100%" }}
        >
          {filtered.length > 0 && (
            <Source id="desire-lines" type="geojson" data={geojson}>
              <Layer
                id="desire-lines-layer"
                type="line"
                paint={{
                  "line-color": "#f97316",
                  "line-opacity": 0.6,
                  "line-width": [
                    "interpolate",
                    ["linear"],
                    ["get", "count"],
                    1, 1,
                    Math.max(maxCount, 2), 8,
                  ],
                } as object}
              />
            </Source>
          )}
        </Map>
      </div>
    </div>
  );
}
