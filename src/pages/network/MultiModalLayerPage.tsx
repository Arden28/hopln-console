import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Map, { Source, Layer } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchModalLayers, refreshOsmLayer } from "@/api/network";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { LayersIcon, RefreshCwIcon } from "lucide-react";
import type { ModalLayerData } from "@/types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };

const LAYER_ORDER = ["bus", "brt", "rail", "tram", "ferry", "cycling", "pedestrian"] as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "< 1 h ago";
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export default function MultiModalLayerPage() {
  const mapRef = React.useRef<MapRef>(null);
  const [visible, setVisible] = React.useState<Record<string, boolean>>(
    Object.fromEntries(LAYER_ORDER.map((k) => [k, true]))
  );
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["network:modal-layers"],
    queryFn: fetchModalLayers,
    staleTime: 300_000,
  });

  const layers = (data?.layers ?? {}) as Record<string, ModalLayerData>;

  const refreshMutation = useMutation({
    mutationFn: (layer: "cycling" | "pedestrian") => refreshOsmLayer(layer),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["network:modal-layers"] }),
  });

  const toggleLayer = (key: string, on: boolean) => {
    setVisible((prev) => ({ ...prev, [key]: on }));
    const layerId = `modal-${key}`;
    mapRef.current?.setLayoutProperty(layerId, "visibility", on ? "visible" : "none");
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Layer sidebar */}
      <div className="w-72 shrink-0 border-r bg-background flex flex-col overflow-y-auto">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 font-medium">
            <LayersIcon size={16} />
            Modal Layers
          </div>
          {data?.osm_refreshed_at && (
            <p className="text-xs text-muted-foreground mt-1">
              OSM last refreshed {timeAgo(data.osm_refreshed_at)}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="flex-1 divide-y">
            {LAYER_ORDER.map((key) => {
              const layer = layers[key];
              if (!layer) return null;
              return (
                <div key={key} className="flex items-center gap-3 px-4 py-3">
                  <Switch
                    checked={visible[key] ?? true}
                    onCheckedChange={(on) => toggleLayer(key, on)}
                  />
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: `#${layer.color}` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{layer.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {layer.count} feature{layer.count !== 1 ? "s" : ""}
                      {layer.osm && <Badge variant="outline" className="ml-1 text-xs py-0">OSM</Badge>}
                    </div>
                  </div>
                  {layer.osm && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      disabled={refreshMutation.isPending}
                      onClick={() => refreshMutation.mutate(key as "cycling" | "pedestrian")}
                      title="Refresh from OSM"
                    >
                      <RefreshCwIcon size={13} />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1">
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{ latitude: DEFAULT_CENTER.lat, longitude: DEFAULT_CENTER.lng, zoom: 11 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
        >
          {LAYER_ORDER.map((key) => {
            const layer = layers[key];
            if (!layer || layer.features.length === 0) return null;

            const geojson: GeoJSON.FeatureCollection = {
              type: "FeatureCollection",
              features: layer.features,
            };

            const lineColor = `#${layer.color}`;
            const visibility = visible[key] ? "visible" : "none";

            return (
              <Source key={key} id={`modal-src-${key}`} type="geojson" data={geojson}>
                <Layer
                  id={`modal-${key}`}
                  type="line"
                  layout={{ visibility, "line-join": "round", "line-cap": "round" }}
                  paint={{
                    "line-color": lineColor,
                    "line-width": key === "brt" ? 4 : key === "rail" ? 3 : 2,
                    "line-opacity": 0.85,
                  }}
                />
              </Source>
            );
          })}
        </Map>
      </div>
    </div>
  );
}
