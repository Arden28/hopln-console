import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Map, { Source, Layer } from "react-map-gl/mapbox";
import type { MapRef, LngLatBoundsLike } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { toast } from "sonner";
import { fetchNetworkCoverage, fetchIsochrone } from "@/api/network";
import { fetchStops } from "@/api/stops";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2Icon, MapIcon, ChevronsUpDownIcon, CheckIcon } from "lucide-react";
import type { WalkShedResult } from "@/types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };

const WALKSHED_COLORS = ["#22c55e", "#f59e0b", "#ef4444"];
const TRANSIT_COLORS  = ["#22c55e", "#84cc16", "#f59e0b", "#ef4444"];

function IsochroneLayer({ result, colors }: { result: WalkShedResult; colors: string[] }) {
  if (!result.features.length) return null;

  const sorted = [...result.features].sort(
    (a, b) => b.properties.time - a.properties.time
  );

  return (
    <>
      {sorted.map((f, i) => (
        <Source
          key={f.properties.time}
          id={`iso-${i}`}
          type="geojson"
          data={{ type: "FeatureCollection", features: [f] }}
        >
          <Layer
            id={`iso-fill-${i}`}
            type="fill"
            paint={{
              "fill-color": colors[i] ?? "#6366f1",
              "fill-opacity": 0.25,
            } as object}
          />
          <Layer
            id={`iso-line-${i}`}
            type="line"
            paint={{
              "line-color": colors[i] ?? "#6366f1",
              "line-width": 1.5,
              "line-opacity": 0.7,
            } as object}
          />
        </Source>
      ))}
    </>
  );
}

export default function NetworkCoveragePage() {
  const mapRef = React.useRef<MapRef>(null);
  const [tab, setTab] = React.useState("heatmap");
  const [stopOpen, setStopOpen] = React.useState(false);
  const [stopSearch, setStopSearch] = React.useState("");
  const [selectedStop, setSelectedStop] = React.useState<{
    id: string; name: string; lat: number; lng: number;
  } | null>(null);
  const [isoResult, setIsoResult] = React.useState<WalkShedResult | null>(null);

  const { data: coverage = [] } = useQuery({
    queryKey: ["network:coverage"],
    queryFn: fetchNetworkCoverage,
    staleTime: 120_000,
  });

  const { data: stopsData } = useQuery({
    queryKey: ["stops:combobox", stopSearch],
    queryFn: () => fetchStops({ search: stopSearch || undefined, per_page: 20 }),
    select: (res) => res.data,
    enabled: stopOpen,
    staleTime: 30_000,
  });

  const isochroneMutation = useMutation({
    mutationFn: (params: { lat: number; lng: number; mode: "walk" | "transit" }) =>
      fetchIsochrone(params),
    onSuccess: (data) => {
      setIsoResult(data);
      if (!data.features.length) {
        toast.warning("OTP returned no isochrone polygons. Check that OTP is running and the location is within the GTFS coverage area.");
        return;
      }
      // Fit the map to the bounding box of the returned polygons
      fitToIsochrone(data.features);
    },
    onError: () => toast.error("Isochrone request failed — is OTP running?"),
  });

  const heatmapGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: coverage.map((c) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      properties: { weight: Math.min(c.trip_count / 20, 1) },
    })),
  };

  const fitToIsochrone = (features: WalkShedResult["features"]) => {
    if (!mapRef.current || !features.length) return;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const f of features) {
      const rings =
        f.geometry.type === "Polygon"
          ? f.geometry.coordinates
          : (f.geometry as unknown as { coordinates: number[][][][] }).coordinates.flat();
      for (const ring of rings) {
        for (const [lng, lat] of ring) {
          if (lng < minLng) minLng = lng;
          if (lat < minLat) minLat = lat;
          if (lng > maxLng) maxLng = lng;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
    if (isFinite(minLng)) {
      mapRef.current.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]] as LngLatBoundsLike,
        { padding: 40, duration: 800, maxZoom: 14 }
      );
    }
  };

  const handleStopSelect = (stop: { id: string; name: string; lat: number; lng: number }) => {
    setSelectedStop(stop);
    setStopOpen(false);
    setIsoResult(null);
    mapRef.current?.flyTo({ center: [stop.lng, stop.lat], zoom: 14, duration: 800 });
  };

  const runIsochrone = (mode: "walk" | "transit") => {
    if (!selectedStop) return;
    isochroneMutation.mutate({ lat: selectedStop.lat, lng: selectedStop.lng, mode });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className="p-4 border-b flex items-center gap-2">
        <MapIcon size={16} />
        <h1 className="font-semibold text-sm">Coverage & Walkshed</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-4 mt-3 w-fit">
          <TabsTrigger value="heatmap">Coverage Heatmap</TabsTrigger>
          <TabsTrigger value="walkshed">Walk-Shed</TabsTrigger>
          <TabsTrigger value="transit">Reachability</TabsTrigger>
        </TabsList>

        <div className="flex flex-1 overflow-hidden">
          {/* Controls sidebar */}
          <div className="w-64 shrink-0 border-r p-4 space-y-4 overflow-y-auto">
            <TabsContent value="heatmap" className="mt-0 space-y-2">
              <p className="text-xs text-muted-foreground">
                Stop density heatmap weighted by service frequency.
              </p>
              <div className="flex gap-2 text-xs items-center">
                <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500" />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Low</span>
                <span>High</span>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                {coverage.length} stops loaded.
              </p>
            </TabsContent>

            <TabsContent value="walkshed" className="mt-0 space-y-3">
              <p className="text-xs text-muted-foreground">
                Select a stop to show its 5/10/15-minute walk-shed.
              </p>
              <Popover open={stopOpen} onOpenChange={setStopOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-8 text-sm">
                    {selectedStop?.name ?? "Pick a stop…"}
                    <ChevronsUpDownIcon size={12} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search stops…"
                      value={stopSearch}
                      onValueChange={setStopSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No stops found.</CommandEmpty>
                      <CommandGroup>
                        {(stopsData ?? []).map((s) => (
                          <CommandItem
                            key={s.id}
                            value={s.name}
                            onSelect={() =>
                              handleStopSelect({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })
                            }
                          >
                            {s.name}
                            {selectedStop?.id === s.id && <CheckIcon size={12} className="ml-auto" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                className="w-full h-8"
                disabled={!selectedStop || isochroneMutation.isPending}
                onClick={() => runIsochrone("walk")}
              >
                {isochroneMutation.isPending && <Loader2Icon size={13} className="mr-1.5 animate-spin" />}
                Run Walk-Shed
              </Button>
              {isoResult && (
                <div className="space-y-1 pt-2">
                  {[5, 10, 15].map((min, i) => (
                    <div key={min} className="flex items-center gap-2 text-xs">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ background: WALKSHED_COLORS[i] }}
                      />
                      <span>{min} min walk</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="transit" className="mt-0 space-y-3">
              <p className="text-xs text-muted-foreground">
                Select an origin to show transit reachability at 15/30/45/60 min.
              </p>
              <Popover open={stopOpen} onOpenChange={setStopOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-8 text-sm">
                    {selectedStop?.name ?? "Pick origin stop…"}
                    <ChevronsUpDownIcon size={12} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search stops…"
                      value={stopSearch}
                      onValueChange={setStopSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No stops found.</CommandEmpty>
                      <CommandGroup>
                        {(stopsData ?? []).map((s) => (
                          <CommandItem
                            key={s.id}
                            value={s.name}
                            onSelect={() =>
                              handleStopSelect({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })
                            }
                          >
                            {s.name}
                            {selectedStop?.id === s.id && <CheckIcon size={12} className="ml-auto" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                className="w-full h-8"
                disabled={!selectedStop || isochroneMutation.isPending}
                onClick={() => runIsochrone("transit")}
              >
                {isochroneMutation.isPending && <Loader2Icon size={13} className="mr-1.5 animate-spin" />}
                Run Reachability
              </Button>
              {isoResult && (
                <div className="space-y-1 pt-2">
                  {[15, 30, 45, 60].map((min, i) => (
                    <div key={min} className="flex items-center gap-2 text-xs">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ background: TRANSIT_COLORS[i] }}
                      />
                      <span>{min} min by transit</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>

          {/* Map */}
          <div className="flex-1">
            <Map
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={{ latitude: DEFAULT_CENTER.lat, longitude: DEFAULT_CENTER.lng, zoom: 11 }}
              mapStyle="mapbox://styles/mapbox/light-v11"
              style={{ width: "100%", height: "100%" }}
            >
              {tab === "heatmap" && coverage.length > 0 && (
                <Source id="coverage-heatmap" type="geojson" data={heatmapGeoJSON}>
                  <Layer
                    id="heatmap-layer"
                    type="heatmap"
                    paint={{
                      "heatmap-weight": ["get", "weight"],
                      "heatmap-intensity": 1,
                      "heatmap-radius": 20,
                      "heatmap-color": [
                        "interpolate",
                        ["linear"],
                        ["heatmap-density"],
                        0, "rgba(0,0,255,0)",
                        0.3, "#4ade80",
                        0.6, "#facc15",
                        1, "#ef4444",
                      ],
                      "heatmap-opacity": 0.8,
                    } as object}
                  />
                </Source>
              )}

              {(tab === "walkshed" || tab === "transit") && isoResult && (
                <IsochroneLayer
                  result={isoResult}
                  colors={tab === "walkshed" ? WALKSHED_COLORS : TRANSIT_COLORS}
                />
              )}
            </Map>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
