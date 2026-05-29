import * as React from "react";
import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import Map, { Source, Layer } from "react-map-gl/mapbox";
import type { MapRef, MapLayerMouseEvent } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchTrips, fetchTrip, deleteTrip } from "@/api/trips";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  SearchIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  MapIcon,
  ListIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  MinusIcon,
  CalendarClockIcon,
} from "lucide-react";
import type { Trip } from "@/types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };

const MAP_STYLES = [
  { key: "streets",   label: "Streets",   uri: "mapbox://styles/mapbox/streets-v12" },
  { key: "satellite", label: "Satellite", uri: "mapbox://styles/mapbox/satellite-streets-v12" },
  { key: "outdoors",  label: "Outdoors",  uri: "mapbox://styles/mapbox/outdoors-v12" },
] as const;

function tripColor(trip: Trip) {
  return trip.route?.route_color ? `#${trip.route.route_color}` : "#6366f1";
}

function useDebounce<T>(value: T, delay = 300): T {
  const [d, setD] = React.useState<T>(value);
  React.useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export function TripsPage() {
  const qc = useQueryClient();

  // ── Shared filters ───────────────────────────────────────────────────────────
  const [search, setSearch]           = React.useState("");
  const [serviceFilter, setServiceFilter] = React.useState("all");
  const [dirFilter, setDirFilter]     = React.useState("all");
  const [sort, setSort]               = React.useState("updated_at");
  const debouncedSearch               = useDebounce(search);

  // ── List / pagination ────────────────────────────────────────────────────────
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [debouncedSearch, serviceFilter, dirFilter, sort]);

  const [deleteTarget, setDeleteTarget] = React.useState<Trip | null>(null);

  // ── Map tab ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]     = React.useState("list");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId]     = React.useState<string | null>(null);
  const [mapStyle, setMapStyle]       = React.useState(MAP_STYLES[0].uri);
  const mapRef          = React.useRef<MapRef>(null);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);

  // ── Trips query (shared between tabs) ────────────────────────────────────────
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["trips", page, debouncedSearch, serviceFilter, dirFilter, sort],
    queryFn: () => fetchTrips({
      page,
      per_page: 30,
      search:      debouncedSearch || undefined,
      service_id:  serviceFilter !== "all" ? serviceFilter : undefined,
      direction_id: dirFilter !== "all" ? dirFilter : undefined,
      sort,
      order: "desc",
    }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  const trips    = data?.data     ?? [];
  const lastPage = data?.last_page ?? 1;
  const total    = data?.total    ?? 0;

  // ── Load shapes for selected trips (parallel, cached) ────────────────────────
  const selectedArr = React.useMemo(() => [...selectedIds], [selectedIds]);
  const shapeQueries = useQueries({
    queries: selectedArr.map(tid => ({
      queryKey: ["trip", tid],
      queryFn:  () => fetchTrip(tid),
      staleTime: 120_000,
      enabled: activeTab === "map",
    })),
  });

  // ── GeoJSON for the map ──────────────────────────────────────────────────────
  const tripsGeoJSON = React.useMemo(() => ({
    type: "FeatureCollection" as const,
    features: shapeQueries
      .filter(q => (q.data?.shape?.points?.length ?? 0) >= 2)
      .map(q => ({
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: q.data!.shape!.points! },
        properties: {
          trip_id:  q.data!.trip_id,
          color:    tripColor(q.data!),
          headsign: q.data!.trip_headsign ?? q.data!.trip_id,
          route:    q.data!.route?.route_short_name ?? "",
          stops:    q.data!.stop_times_count ?? 0,
          hovered:  q.data!.trip_id === hoveredId,
        },
      })),
  }), [shapeQueries, hoveredId]);

  // ── ResizeObserver keeps map canvas in sync ──────────────────────────────────
  React.useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => mapRef.current?.getMap()?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    if (activeTab !== "map") return;
    const id = setTimeout(() => mapRef.current?.getMap()?.resize(), 0);
    return () => clearTimeout(id);
  }, [activeTab]);

  // ── Delete ───────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTrip(id),
    onSuccess: (_, id) => {
      toast.success("Trip deleted");
      qc.invalidateQueries({ queryKey: ["trips"] });
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete trip"),
  });

  // ── Map handlers ─────────────────────────────────────────────────────────────
  function toggleTrip(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleMapMouseMove(e: MapLayerMouseEvent) {
    const id = (e.features?.[0]?.properties?.trip_id as string) ?? null;
    setHoveredId(id);
    const canvas = mapRef.current?.getMap()?.getCanvas();
    if (canvas) canvas.style.cursor = id ? "pointer" : "";
  }

  function handleMapMouseLeave() {
    setHoveredId(null);
    const canvas = mapRef.current?.getMap()?.getCanvas();
    if (canvas) canvas.style.cursor = "";
  }

  function handleMapClick(e: MapLayerMouseEvent) {
    const id = e.features?.[0]?.properties?.trip_id as string | undefined;
    if (id) toggleTrip(id);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search trips…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-36 text-sm">
            <SelectValue placeholder="All services" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekdays">Weekdays</SelectItem>
            <SelectItem value="weekends">Weekends</SelectItem>
            <SelectItem value="school_days">School days</SelectItem>
            <SelectItem value="default">Default</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dirFilter} onValueChange={setDirFilter}>
          <SelectTrigger className="w-36 text-sm">
            <SelectValue placeholder="All directions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All directions</SelectItem>
            <SelectItem value="0">Outbound (0)</SelectItem>
            <SelectItem value="1">Inbound (1)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-40 text-sm">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_at">Last updated</SelectItem>
            <SelectItem value="trip_id">Trip ID</SelectItem>
            <SelectItem value="stop_times_count">Stop count</SelectItem>
          </SelectContent>
        </Select>

        <Button asChild className="sm:ml-auto">
          <Link to="/trips/new">
            <PlusIcon className="mr-1.5 size-4" />
            New trip
          </Link>
        </Button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-0">
        <div className="flex items-center gap-3">
          <TabsList className="h-9">
            <TabsTrigger value="list" className="gap-1.5 text-xs px-3">
              <ListIcon className="size-3.5" />
              List
              {total > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-1.5 text-xs px-3">
              <MapIcon className="size-3.5" />
              Map
              {selectedIds.size > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {selectedIds.size}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {isFetching && !isLoading && (
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* ── List tab ────────────────────────────────────────────────────── */}
        <TabsContent value="list" className="mt-3 flex flex-col gap-3">
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-48">Trip ID</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Headsign</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead className="text-right w-20">Stops</TableHead>
                  <TableHead className="text-center w-16">Shape</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-7 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : trips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                      No trips found
                    </TableCell>
                  </TableRow>
                ) : (
                  trips.map(trip => (
                    <TableRow key={trip.trip_id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">{trip.trip_id}</TableCell>
                      <TableCell>
                        {trip.route ? (
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: tripColor(trip) }}
                          >
                            {trip.route.route_short_name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">{trip.route_id}</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-48">
                        <span className="text-sm truncate block">
                          {trip.trip_headsign ?? <span className="text-muted-foreground">—</span>}
                        </span>
                      </TableCell>
                      <TableCell>
                        {trip.service_id ? (
                          <Badge variant="outline" className="text-xs font-normal">
                            {trip.service_id}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {trip.direction_id !== undefined && trip.direction_id !== null ? (
                          <Badge
                            className="text-xs border-0"
                            style={{
                              backgroundColor: trip.direction_id === 0 ? "#3b82f6" : "#f97316",
                              color: "white",
                            }}
                          >
                            {trip.direction_id === 0 ? "Outbound" : "Inbound"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {trip.stop_times_count ?? 0}
                      </TableCell>
                      <TableCell className="text-center">
                        {trip.shape_id
                          ? <CheckIcon className="size-4 text-emerald-500 mx-auto" />
                          : <MinusIcon className="size-4 text-muted-foreground mx-auto" />
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button asChild variant="ghost" size="icon" className="size-7">
                            <Link to="/trips/$id/edit" params={{ id: trip.trip_id }}>
                              <PencilIcon className="size-3.5" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(trip)}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {lastPage > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline" size="sm" className="h-7 gap-1"
                disabled={page === 1 || isFetching}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeftIcon className="size-3.5" /> Prev
              </Button>
              <span className="text-xs text-muted-foreground px-1">
                Page {page} of {lastPage}
              </span>
              <Button
                variant="outline" size="sm" className="h-7 gap-1"
                disabled={page === lastPage || isFetching}
                onClick={() => setPage(p => p + 1)}
              >
                Next <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── Map tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="map" className="mt-3">
          <div className="flex rounded-xl border overflow-hidden" style={{ height: 640 }}>

            {/* Sidebar */}
            <div className="w-64 shrink-0 flex flex-col border-r bg-muted/10">
              <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
                <span className="text-xs text-muted-foreground">
                  {trips.length} trips · <span className="text-foreground font-medium">{selectedIds.size}</span> shown
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <button type="button" onClick={() => setSelectedIds(new Set(trips.map(t => t.trip_id)))} className="text-primary hover:underline">All</button>
                  <span className="text-muted-foreground">·</span>
                  <button type="button" onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-foreground hover:underline">None</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                {isLoading ? (
                  <div className="p-3 space-y-1.5">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2 py-1">
                        <Skeleton className="size-3 rounded-full shrink-0" />
                        <Skeleton className="h-4 w-10 rounded-full shrink-0" />
                        <Skeleton className="h-3 flex-1" />
                      </div>
                    ))}
                  </div>
                ) : trips.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
                    No trips match filters
                  </div>
                ) : (
                  <div className="p-1.5 space-y-0.5">
                    {trips.map(trip => {
                      const isSelected = selectedIds.has(trip.trip_id);
                      const qIdx = selectedArr.indexOf(trip.trip_id);
                      const isLoadingShape = isSelected && qIdx >= 0 && shapeQueries[qIdx]?.isLoading;
                      const isHovered = hoveredId === trip.trip_id;

                      return (
                        <button
                          key={trip.trip_id}
                          type="button"
                          onClick={() => toggleTrip(trip.trip_id)}
                          className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors border ${
                            isHovered
                              ? "bg-primary/10 border-primary/30"
                              : isSelected
                              ? "bg-muted/60 border-border"
                              : "border-transparent hover:bg-muted/40"
                          }`}
                        >
                          {isLoadingShape ? (
                            <Loader2Icon className="size-3 animate-spin text-muted-foreground shrink-0" />
                          ) : (
                            <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: tripColor(trip) }} />
                          )}

                          {trip.route && (
                            <span
                              className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded shrink-0"
                              style={{ backgroundColor: tripColor(trip) }}
                            >
                              {trip.route.route_short_name}
                            </span>
                          )}

                          <span className="text-xs text-muted-foreground truncate flex-1 leading-tight">
                            {trip.trip_headsign ?? trip.trip_id}
                          </span>

                          {isSelected
                            ? <EyeIcon    className="size-3 text-primary shrink-0" />
                            : <EyeOffIcon className="size-3 text-muted-foreground/30 shrink-0" />
                          }
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {lastPage > 1 && (
                <div className="flex items-center justify-between px-2 py-1.5 border-t shrink-0">
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-0.5" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeftIcon className="size-3" /> Prev
                  </Button>
                  <span className="text-[10px] text-muted-foreground">{page} / {lastPage}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-0.5" disabled={page === lastPage} onClick={() => setPage(p => p + 1)}>
                    Next <ChevronRightIcon className="size-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Map */}
            <div ref={mapContainerRef} className="flex-1 relative min-w-0">
              {!MAPBOX_TOKEN ? (
                <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
                  Set <code className="mx-1 font-mono bg-background px-1 rounded">VITE_MAPBOX_TOKEN</code> to enable map
                </div>
              ) : (
                <>
                  <Map
                    ref={mapRef}
                    mapboxAccessToken={MAPBOX_TOKEN}
                    initialViewState={{ longitude: DEFAULT_CENTER.lng, latitude: DEFAULT_CENTER.lat, zoom: 11 }}
                    style={{ width: "100%", height: "100%" }}
                    mapStyle={mapStyle}
                    interactiveLayerIds={["trips-line"]}
                    onLoad={() => mapRef.current?.getMap()?.resize()}
                    onMouseMove={handleMapMouseMove}
                    onMouseLeave={handleMapMouseLeave}
                    onClick={handleMapClick}
                  >
                    <Source id="trips" type="geojson" data={tripsGeoJSON}>
                      <Layer
                        id="trips-outline"
                        type="line"
                        paint={{ "line-color": "#ffffff", "line-width": ["case", ["get", "hovered"], 12, 8], "line-opacity": 0.5 } as object}
                      />
                      <Layer
                        id="trips-line"
                        type="line"
                        layout={{ "line-cap": "round", "line-join": "round" } as object}
                        paint={{ "line-color": ["get", "color"], "line-width": ["case", ["get", "hovered"], 6, 3.5], "line-opacity": 0.9 } as object}
                      />
                    </Source>
                  </Map>

                  {/* Map style switcher */}
                  <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
                    {MAP_STYLES.map(s => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setMapStyle(s.uri)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border shadow-sm transition-colors ${
                          mapStyle === s.uri
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background/90 backdrop-blur-sm border-border hover:bg-muted"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* Empty state */}
                  {selectedIds.size === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-background/85 backdrop-blur-sm rounded-xl border px-6 py-4 text-center shadow-lg">
                        <CalendarClockIcon className="size-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">No trips shown</p>
                        <p className="text-xs text-muted-foreground mt-1">Click trips in the sidebar to display them on the map</p>
                      </div>
                    </div>
                  )}

                  {/* Hover tooltip */}
                  {hoveredId && (() => {
                    const t = trips.find(x => x.trip_id === hoveredId);
                    return t ? (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                        <div className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                          {t.route && (
                            <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: tripColor(t) }}>
                              {t.route.route_short_name}
                            </span>
                          )}
                          <span className="text-sm">{t.trip_headsign ?? t.trip_id}</span>
                          {t.direction_id !== undefined && t.direction_id !== null && (
                            <Badge variant="outline" className="text-[10px]">
                              {t.direction_id === 0 ? "Outbound" : "Inbound"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trip?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.trip_id}</strong> and all its
              stop times. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.trip_id)}
            >
              {deleteMutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
