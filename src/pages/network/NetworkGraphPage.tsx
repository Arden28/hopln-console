import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Map, { Source, Layer } from "react-map-gl/mapbox";
import type { MapRef, MapMouseEvent } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchNetworkGraph } from "@/api/network";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NetworkIcon, SearchIcon, XIcon } from "lucide-react";
import type { NetworkNode, NetworkEdge } from "@/types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };

export default function NetworkGraphPage() {
  const mapRef = React.useRef<MapRef>(null);
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<NetworkNode | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["network:graph"],
    queryFn: fetchNetworkGraph,
    staleTime: 60_000,
  });

  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];

  const filteredNodes = search
    ? nodes.filter((n) => n.name.toLowerCase().includes(search.toLowerCase()))
    : nodes;

  // Build GeoJSON for stops
  const stopsGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: nodes.map((n) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [n.lng, n.lat] },
      properties: { id: n.id, name: n.name, trip_count: n.trip_count, route_count: n.route_count },
    })),
  };

  // Build GeoJSON for route lines
  const routesGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: edges
      .filter((e) => e.points.length >= 2)
      .map((e) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: e.points },
        properties: {
          route_id: e.route_id,
          route_short_name: e.route_short_name,
          route_color: e.route_color ? `#${e.route_color}` : "#6366f1",
        },
      })),
  };

  const handleMapClick = React.useCallback(
    (e: MapMouseEvent) => {
      const features = mapRef.current?.queryRenderedFeatures(e.point, {
        layers: ["network-stops-layer"],
      });
      if (features && features.length > 0) {
        const props = features[0].properties as { id: string };
        const node = nodes.find((n) => n.id === props.id) ?? null;
        setSelected(node);
      } else {
        setSelected(null);
      }
    },
    [nodes]
  );

  const connectedEdges = selected
    ? edges.filter((e) => {
        // Check if any stop in the route's GeoJSON is close to the selected stop
        return e.route_id && edges.some((edge) => edge.route_id === e.route_id);
      })
    : [];

  const uniqueRoutes = selected
    ? Array.from(new Set(edges.map((e) => e.route_id))).map((rid) =>
        edges.find((e) => e.route_id === rid)
      )
    : [];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left sidebar */}
      <div className="w-72 shrink-0 flex flex-col border-r bg-background overflow-y-auto">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 font-medium mb-3">
            <NetworkIcon size={16} />
            Network Graph
          </div>
          <div className="relative">
            <SearchIcon size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Search stops…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {selected ? (
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-sm">{selected.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Stop ID: {selected.id}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <XIcon size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border p-2 text-center">
                <div className="text-lg font-bold">{selected.trip_count}</div>
                <div className="text-xs text-muted-foreground">Trips</div>
              </div>
              <div className="rounded border p-2 text-center">
                <div className="text-lg font-bold">{selected.route_count}</div>
                <div className="text-xs text-muted-foreground">Routes</div>
              </div>
            </div>
          </div>
        ) : search ? (
          <div className="divide-y overflow-y-auto flex-1">
            {filteredNodes.slice(0, 50).map((n) => (
              <button
                key={n.id}
                className="w-full text-left px-4 py-2.5 hover:bg-muted text-sm"
                onClick={() => {
                  setSelected(n);
                  mapRef.current?.flyTo({ center: [n.lng, n.lat], zoom: 15, duration: 800 });
                }}
              >
                <div className="font-medium">{n.name}</div>
                <div className="text-xs text-muted-foreground">
                  {n.route_count} route{n.route_count !== 1 ? "s" : ""} · {n.trip_count} trip{n.trip_count !== 1 ? "s" : ""}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-4 space-y-2">
            <div className="text-xs text-muted-foreground">
              {nodes.length} stops · {new Set(edges.map((e) => e.route_id)).size} routes
            </div>
            <div className="text-xs text-muted-foreground">Click a stop on the map for details.</div>
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
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{ latitude: DEFAULT_CENTER.lat, longitude: DEFAULT_CENTER.lng, zoom: 11 }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          style={{ width: "100%", height: "100%" }}
          onClick={handleMapClick}
          cursor="pointer"
          interactiveLayerIds={["network-stops-layer"]}
        >
          {/* Route lines */}
          <Source id="network-routes" type="geojson" data={routesGeoJSON}>
            <Layer
              id="network-routes-layer"
              type="line"
              paint={{
                "line-color": ["get", "route_color"],
                "line-width": 2,
                "line-opacity": 0.7,
              } as object}
            />
          </Source>

          {/* Stops */}
          <Source id="network-stops" type="geojson" data={stopsGeoJSON}>
            <Layer
              id="network-stops-layer"
              type="circle"
              paint={{
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["get", "trip_count"],
                  0, 4,
                  20, 10,
                ],
                "circle-color": [
                  "interpolate",
                  ["linear"],
                  ["get", "route_count"],
                  0, "#94a3b8",
                  1, "#6366f1",
                  5, "#f59e0b",
                ],
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1.5,
              } as object}
            />
          </Source>

          {/* Selected stop highlight */}
          {selected && (
            <Source
              id="selected-stop"
              type="geojson"
              data={{
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [selected.lng, selected.lat] },
                    properties: {},
                  },
                ],
              }}
            >
              <Layer
                id="selected-stop-layer"
                type="circle"
                paint={{
                  "circle-radius": 14,
                  "circle-color": "#6366f1",
                  "circle-opacity": 0.3,
                  "circle-stroke-color": "#6366f1",
                  "circle-stroke-width": 2,
                } as object}
              />
            </Source>
          )}
        </Map>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg border p-3 text-xs space-y-1.5">
          <div className="font-medium mb-1">Legend</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-400" />
            <span>No service</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            <span>1 route</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-400" />
            <span>5+ routes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
