import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Map, { Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchTransferGraph } from "@/api/network";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Share2Icon } from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };

const RADIUS_OPTIONS = [200, 400, 800] as const;

export default function TransferGraphPage() {
  const [radius, setRadius] = React.useState<200 | 400 | 800>(400);

  const { data, isLoading } = useQuery({
    queryKey: ["network:transfer-graph", radius],
    queryFn: () => fetchTransferGraph(radius),
    staleTime: 60_000,
  });

  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];

  // Build GeoJSON for stops colored by connectivity
  const nodeGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: nodes.map((n) => {
      const degree = edges.filter((e) => e.from_id === n.id || e.to_id === n.id).length;
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [n.lng, n.lat] },
        properties: { id: n.id, name: n.name, degree },
      };
    }),
  };

  const edgeGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: edges.map((e) => {
      const fromNode = nodes.find((n) => n.id === e.from_id);
      const toNode   = nodes.find((n) => n.id === e.to_id);
      if (!fromNode || !toNode) return null!;
      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [fromNode.lng, fromNode.lat],
            [toNode.lng, toNode.lat],
          ],
        },
        properties: { distance_m: e.distance_m },
      };
    }).filter(Boolean),
  };

  const score   = data?.connectivity_score ?? 0;
  const largest = data?.largest_component_size ?? 0;
  const isolated = data?.isolated_stops ?? 0;

  const gaugeData = [{ name: "score", value: score, fill: score > 70 ? "#22c55e" : score > 40 ? "#f59e0b" : "#ef4444" }];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left panel */}
      <div className="w-64 shrink-0 border-r bg-background flex flex-col overflow-y-auto">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 font-medium text-sm mb-3">
            <Share2Icon size={15} />
            Transfer Graph
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-1.5">Walk radius</div>
            <div className="flex gap-1.5">
              {RADIUS_OPTIONS.map((r) => (
                <Button
                  key={r}
                  variant={radius === r ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs h-7"
                  onClick={() => setRadius(r)}
                >
                  {r}m
                </Button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Connectivity score gauge */}
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Connectivity Score</div>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="60%"
                    outerRadius="90%"
                    data={gaugeData}
                    startAngle={180}
                    endAngle={0}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={4} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-3xl font-bold -mt-6">{score}%</div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total stops</span>
                <span className="font-medium">{nodes.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transfer links</span>
                <span className="font-medium">{edges.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Largest component</span>
                <span className="font-medium">{largest}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground text-destructive/80">Isolated stops</span>
                <span className="font-medium text-destructive">{isolated}</span>
              </div>
            </div>
          </div>
        )}
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
          mapStyle="mapbox://styles/mapbox/light-v11"
          style={{ width: "100%", height: "100%" }}
        >
          {/* Transfer edges */}
          {edges.length > 0 && (
            <Source id="transfer-edges" type="geojson" data={edgeGeoJSON}>
              <Layer
                id="transfer-edges-layer"
                type="line"
                paint={{
                  "line-color": "#6366f1",
                  "line-dasharray": [2, 2],
                  "line-opacity": [
                    "interpolate",
                    ["linear"],
                    ["get", "distance_m"],
                    0, 0.9,
                    800, 0.2,
                  ],
                  "line-width": 1.5,
                } as object}
              />
            </Source>
          )}

          {/* Stops colored by degree */}
          {nodes.length > 0 && (
            <Source id="transfer-nodes" type="geojson" data={nodeGeoJSON}>
              <Layer
                id="transfer-nodes-layer"
                type="circle"
                paint={{
                  "circle-radius": 5,
                  "circle-color": [
                    "interpolate",
                    ["linear"],
                    ["get", "degree"],
                    0, "#ef4444",
                    1, "#f59e0b",
                    3, "#22c55e",
                  ],
                  "circle-stroke-color": "#ffffff",
                  "circle-stroke-width": 1.5,
                } as object}
              />
            </Source>
          )}
        </Map>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg border p-3 text-xs space-y-1.5">
          <div className="font-medium mb-1">Stop connectivity</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Isolated</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span>1–2 transfers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>3+ transfers</span>
          </div>
        </div>
      </div>
    </div>
  );
}
