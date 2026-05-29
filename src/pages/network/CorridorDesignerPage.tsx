import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Map, { Source, Layer } from "react-map-gl/mapbox";
import type { MapRef, MapMouseEvent, LngLatBoundsLike } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { toast } from "sonner";
import {
  fetchCorridors,
  fetchCorridor,
  createCorridor,
  saveCorridorShape,
  deleteCorridor,
  fetchCorridorRoutes,
  attachRouteToCorridor,
  detachRouteFromCorridor,
} from "@/api/corridors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  RouteIcon,
  PlusIcon,
  TrashIcon,
  Loader2Icon,
  CheckIcon,
  XIcon,
  MapPinIcon,
  ArrowLeftIcon,
  Undo2Icon,
} from "lucide-react";
import type { Route } from "@/types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };

export default function CorridorDesignerPage() {
  const qc = useQueryClient();
  const mapRef = React.useRef<MapRef>(null);

  // selectedId drives both the list highlight and the detail query
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [drawing, setDrawing] = React.useState(false);
  const [drawnPoints, setDrawnPoints] = React.useState<[number, number][]>([]);
  const [newName, setNewName] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  // Full corridor (with routes relation) — only fetched when one is selected
  const { data: selectedCorridor, isLoading: detailLoading } = useQuery({
    queryKey: ["corridor", selectedId],
    queryFn: () => fetchCorridor(selectedId!),
    enabled: !!selectedId,
    staleTime: 30_000,
  });

  // List of all corridors (lightweight — no routes relation)
  const { data: corridors = [], isLoading: listLoading } = useQuery({
    queryKey: ["corridors"],
    queryFn: fetchCorridors,
    staleTime: 30_000,
  });

  // Routes whose shapes pass within 200 m of the selected corridor's path
  const { data: nearbyRoutes = [], isLoading: routesLoading } = useQuery({
    queryKey: ["corridor-nearby-routes", selectedId],
    queryFn: () => fetchCorridorRoutes(selectedId!),
    enabled: !!selectedId && !!selectedCorridor?.points?.length,
    staleTime: 30_000,
  });

  const attachedRouteIds = new Set(
    (selectedCorridor?.routes ?? []).map((r: Route) => r.route_id)
  );

  // ── mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: () => createCorridor({ name: newName }),
    onSuccess: (corridor) => {
      qc.invalidateQueries({ queryKey: ["corridors"] });
      toast.success("Corridor created.");
      setCreateOpen(false);
      setNewName("");
      setSelectedId(corridor.corridor_id);
      setDrawnPoints([]);
      setDrawing(true);
    },
    onError: () => toast.error("Failed to create corridor."),
  });

  const saveMutation = useMutation({
    mutationFn: () => saveCorridorShape(selectedId!, drawnPoints),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corridors"] });
      qc.invalidateQueries({ queryKey: ["corridor", selectedId] });
      setDrawing(false);
      toast.success("Corridor shape saved.");
    },
    onError: () => toast.error("Failed to save corridor shape."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCorridor(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corridors"] });
      if (selectedId === deleteId) {
        setSelectedId(null);
        setDrawing(false);
      }
      setDeleteId(null);
      toast.success("Corridor deleted.");
    },
    onError: () => toast.error("Failed to delete corridor."),
  });

  const attachMutation = useMutation({
    mutationFn: (routeId: string) => attachRouteToCorridor(selectedId!, routeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corridor", selectedId] });
      toast.success("Route attached.");
    },
    onError: () => toast.error("Failed to attach route."),
  });

  const detachMutation = useMutation({
    mutationFn: (routeId: string) => detachRouteFromCorridor(selectedId!, routeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corridor", selectedId] });
      toast.success("Route detached.");
    },
    onError: () => toast.error("Failed to detach route."),
  });

  // ── handlers ───────────────────────────────────────────────────────────────

  const handleSelect = (corridorId: string) => {
    setSelectedId(corridorId);
    setDrawing(false);
    setDrawnPoints([]);
    // Fly to the corridor shape if it has points
    const corridor = corridors.find((c) => c.corridor_id === corridorId);
    if (corridor?.points && corridor.points.length >= 2) {
      const lngs = corridor.points.map((p) => p[0]);
      const lats = corridor.points.map((p) => p[1]);
      mapRef.current?.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]] as LngLatBoundsLike,
        { padding: 60, duration: 700, maxZoom: 15 }
      );
    }
  };

  const handleBack = () => {
    if (drawing) {
      // Confirm leaving drawing mode
      setDrawing(false);
      setDrawnPoints(selectedCorridor?.points ?? []);
    }
    setSelectedId(null);
    setDrawing(false);
  };

  const startDrawing = () => {
    setDrawnPoints(selectedCorridor?.points ?? []);
    setDrawing(true);
  };

  const cancelDraw = () => {
    setDrawing(false);
    setDrawnPoints(selectedCorridor?.points ?? []);
  };

  const handleMapClick = React.useCallback(
    (e: MapMouseEvent) => {
      if (!drawing) return;
      const { lng, lat } = e.lngLat;
      setDrawnPoints((pts) => [...pts, [lng, lat]]);
    },
    [drawing]
  );

  // ── GeoJSON ────────────────────────────────────────────────────────────────

  const corridorsGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: corridors
      .filter((c) => c.points && c.points.length >= 2)
      .map((c) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: c.points! },
        properties: {
          id: c.corridor_id,
          active: c.corridor_id === selectedId ? 1 : 0,
        },
      })),
  };

  const drawingGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features:
      drawnPoints.length >= 2
        ? [
            {
              type: "Feature",
              geometry: { type: "LineString", coordinates: drawnPoints },
              properties: {},
            },
          ]
        : [],
  };

  const drawingPointsGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: drawnPoints.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: p },
      properties: {},
    })),
  };

  // ── sidebar panels ─────────────────────────────────────────────────────────

  const inDetailMode = !!selectedId;
  const deleteTarget = corridors.find((c) => c.corridor_id === deleteId);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ── Left sidebar ── */}
      <div className="w-72 shrink-0 border-r bg-background flex flex-col overflow-hidden">

        {/* ── Detail view ── */}
        {inDetailMode ? (
          <>
            {/* Detail header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleBack}>
                <ArrowLeftIcon size={14} />
              </Button>
              {detailLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <span className="font-medium text-sm truncate">
                  {selectedCorridor?.name ?? "Loading…"}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 ml-auto text-destructive hover:text-destructive"
                onClick={() => setDeleteId(selectedId)}
              >
                <TrashIcon size={13} />
              </Button>
            </div>

            {/* Detail body — scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">

              {/* Shape drawing section */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Shape
                </div>

                {drawing ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Click the map to add waypoints.{" "}
                      <span className="font-medium text-foreground">
                        {drawnPoints.length} point{drawnPoints.length !== 1 ? "s" : ""} added.
                      </span>
                    </p>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        disabled={drawnPoints.length < 2 || saveMutation.isPending}
                        onClick={() => saveMutation.mutate()}
                      >
                        {saveMutation.isPending ? (
                          <Loader2Icon size={11} className="animate-spin mr-1.5" />
                        ) : (
                          <CheckIcon size={11} className="mr-1.5" />
                        )}
                        Save shape
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={cancelDraw}
                      >
                        Cancel
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-7 text-xs"
                      disabled={drawnPoints.length === 0}
                      onClick={() => setDrawnPoints((pts) => pts.slice(0, -1))}
                    >
                      <Undo2Icon size={11} className="mr-1.5" />
                      Undo last point
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={startDrawing}
                    disabled={detailLoading}
                  >
                    <MapPinIcon size={11} className="mr-1.5" />
                    {selectedCorridor?.points?.length ? "Redraw shape" : "Draw shape"}
                  </Button>
                )}
              </div>

              {/* Routes near corridor */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Routes near corridor
                </div>

                {!selectedCorridor?.points?.length && !drawing ? (
                  <p className="text-xs text-muted-foreground">
                    Draw a shape first to see routes within 200 m.
                  </p>
                ) : routesLoading ? (
                  <div className="space-y-1.5">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-6 w-full" />)}
                  </div>
                ) : nearbyRoutes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No routes within 200 m.</p>
                ) : (
                  <div className="space-y-1">
                    {nearbyRoutes.map((r: Route) => {
                      const attached = attachedRouteIds.has(r.route_id);
                      return (
                        <div
                          key={r.route_id}
                          className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${attached ? "bg-primary/5" : ""}`}
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              background: r.route_color ? `#${r.route_color}` : "#6366f1",
                            }}
                          />
                          <span className="flex-1 truncate font-medium">
                            {r.route_short_name}
                          </span>
                          <span className="text-muted-foreground truncate max-w-[80px]">
                            {r.route_long_name}
                          </span>
                          <Button
                            variant={attached ? "destructive" : "outline"}
                            size="sm"
                            className="h-5 text-[10px] px-1.5 shrink-0"
                            disabled={attachMutation.isPending || detachMutation.isPending}
                            onClick={() =>
                              attached
                                ? detachMutation.mutate(r.route_id)
                                : attachMutation.mutate(r.route_id)
                            }
                          >
                            {attached ? <XIcon size={9} /> : <PlusIcon size={9} />}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Attached routes summary */}
              {(selectedCorridor?.routes?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Attached ({selectedCorridor!.routes!.length})
                  </div>
                  <div className="space-y-1">
                    {selectedCorridor!.routes!.map((r: Route) => (
                      <div key={r.route_id} className="flex items-center gap-2 text-xs">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: r.route_color ? `#${r.route_color}` : "#6366f1" }}
                        />
                        <span className="font-medium">{r.route_short_name}</span>
                        <span className="text-muted-foreground truncate">{r.route_long_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ── List view ── */
          <>
            {/* List header */}
            <div className="p-4 border-b shrink-0">
              <div className="flex items-center gap-2 font-medium text-sm mb-3">
                <RouteIcon size={15} />
                Corridors
              </div>

              {createOpen ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Corridor name…"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) =>
                      e.key === "Enter" && newName.trim() && createMutation.mutate()
                    }
                  />
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      disabled={!newName.trim() || createMutation.isPending}
                      onClick={() => createMutation.mutate()}
                    >
                      {createMutation.isPending ? (
                        <Loader2Icon size={11} className="animate-spin" />
                      ) : (
                        "Create"
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setCreateOpen(false);
                        setNewName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-sm"
                  onClick={() => setCreateOpen(true)}
                >
                  <PlusIcon size={13} className="mr-1.5" />
                  New Corridor
                </Button>
              )}
            </div>

            {/* Corridor list */}
            <div className="flex-1 overflow-y-auto divide-y">
              {listLoading && (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              )}
              {!listLoading && corridors.length === 0 && (
                <p className="p-4 text-xs text-muted-foreground">
                  No corridors yet. Create one to start.
                </p>
              )}
              {corridors.map((c) => (
                <div
                  key={c.corridor_id}
                  className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSelect(c.corridor_id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {c.corridor_routes_count ?? 0} route
                      {(c.corridor_routes_count ?? 0) !== 1 ? "s" : ""}
                      {c.points?.length
                        ? ` · ${c.points.length} pts`
                        : " · no shape"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(c.corridor_id);
                    }}
                  >
                    <TrashIcon size={11} />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative">
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{
            latitude: DEFAULT_CENTER.lat,
            longitude: DEFAULT_CENTER.lng,
            zoom: 11,
          }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          style={{ width: "100%", height: "100%" }}
          onClick={handleMapClick}
          cursor={drawing ? "crosshair" : "default"}
        >
          {/* All corridor shapes */}
          <Source id="corridors" type="geojson" data={corridorsGeoJSON}>
            <Layer
              id="corridors-line"
              type="line"
              paint={{
                "line-color": [
                  "case",
                  ["==", ["get", "active"], 1],
                  "#6366f1",
                  "#94a3b8",
                ],
                "line-width": [
                  "case",
                  ["==", ["get", "active"], 1],
                  4,
                  2,
                ],
                "line-opacity": 0.85,
              } as object}
            />
          </Source>

          {/* Live drawing preview */}
          {drawing && (
            <>
              <Source id="drawing" type="geojson" data={drawingGeoJSON}>
                <Layer
                  id="drawing-line"
                  type="line"
                  paint={{
                    "line-color": "#f59e0b",
                    "line-width": 3,
                    "line-dasharray": [3, 2],
                  } as object}
                />
              </Source>

              <Source id="drawing-points" type="geojson" data={drawingPointsGeoJSON}>
                <Layer
                  id="drawing-points-layer"
                  type="circle"
                  paint={{
                    "circle-radius": 5,
                    "circle-color": "#f59e0b",
                    "circle-stroke-color": "#fff",
                    "circle-stroke-width": 1.5,
                  } as object}
                />
              </Source>
            </>
          )}
        </Map>

        {drawing && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm rounded-full border px-4 py-1.5 text-xs font-medium shadow-sm">
            Drawing mode — click to add waypoints · {drawnPoints.length} added
          </div>
        )}
      </div>

      {/* ── Delete confirm ── */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete corridor?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" and its route associations will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? (
                <Loader2Icon size={13} className="animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
