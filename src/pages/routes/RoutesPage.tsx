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
import { fetchRoutes, fetchRoute, deleteRoute } from "@/api/routes";
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
} from "lucide-react";
import type { Route } from "@/types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };

const MAP_STYLES = [
  { key: "streets",   label: "Streets",   uri: "mapbox://styles/mapbox/streets-v12" },
  { key: "satellite", label: "Satellite", uri: "mapbox://styles/mapbox/satellite-streets-v12" },
  { key: "outdoors",  label: "Outdoors",  uri: "mapbox://styles/mapbox/outdoors-v12" },
] as const;

const ROUTE_TYPES = [
  { value: "0",  label: "Tram" },
  { value: "1",  label: "Metro" },
  { value: "2",  label: "Rail" },
  { value: "3",  label: "Bus" },
  { value: "4",  label: "Ferry" },
  { value: "5",  label: "Cable car" },
  { value: "11", label: "Trolleybus" },
];

const ROUTE_TYPE_LABELS: Record<number, string> = {
  0: "Tram", 1: "Metro", 2: "Rail", 3: "Bus",
  4: "Ferry", 5: "Cable car", 6: "Gondola", 7: "Funicular", 11: "Trolleybus",
};

function routeColor(r: Route) {
  return r.route_color ? `#${r.route_color}` : "#FF6F00";
}

function useDebounce<T>(value: T, delay = 300): T {
  const [d, setD] = React.useState<T>(value);
  React.useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export function RoutesPage() {
  const qc = useQueryClient();

  // ── Shared filters ──────────────────────────────────────────────────────────
  const [search, setSearch]       = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const debouncedSearch = useDebounce(search);

  // ── List / pagination ───────────────────────────────────────────────────────
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [debouncedSearch, typeFilter]);

  const [deleteTarget, setDeleteTarget] = React.useState<Route | null>(null);

  // ── Map tab ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]     = React.useState("list");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId]     = React.useState<string | null>(null);
  const [mapStyle, setMapStyle]       = React.useState(MAP_STYLES[0].uri);
  const mapRef          = React.useRef<MapRef>(null);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);

  // ── Routes query (shared between tabs) ─────────────────────────────────────
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["routes", page, debouncedSearch, typeFilter],
    queryFn: () =>
      fetchRoutes({
        page,
        per_page: 30,
        search:     debouncedSearch || undefined,
        route_type: typeFilter !== "all" ? typeFilter : undefined,
      }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const routes   = data?.data     ?? [];
  const lastPage = data?.last_page ?? 1;
  const total    = data?.total    ?? 0;

  // ── Load shapes for each selected route (parallel, cached) ─────────────────
  const selectedArr = React.useMemo(() => [...selectedIds], [selectedIds]);
  const shapeQueries = useQueries({
    queries: selectedArr.map(id => ({
      queryKey: ["route", id],
      queryFn:  () => fetchRoute(id),
      staleTime: 120_000,
    })),
  });

  // ── GeoJSON for the map (data-driven color + hover width) ─────────────────
  const routesGeoJSON = React.useMemo(() => ({
    type: "FeatureCollection" as const,
    features: shapeQueries
      .filter(q => (q.data?.shapes?.[0]?.points?.length ?? 0) >= 2)
      .map(q => ({
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: q.data!.shapes![0].points!,
        },
        properties: {
          route_id:   q.data!.route_id,
          color:      routeColor(q.data!),
          short_name: q.data!.route_short_name,
          long_name:  q.data!.route_long_name,
          hovered:    q.data!.route_id === hoveredId,
        },
      })),
  }), [shapeQueries, hoveredId]);

  // ── Auto-fit when a route's shape finishes loading ─────────────────────────
  const prevLoadedCountRef = React.useRef(0);
  React.useEffect(() => {
    const loaded = shapeQueries.filter(
      q => q.isSuccess && (q.data?.shapes?.[0]?.points?.length ?? 0) >= 2
    );
    if (loaded.length === prevLoadedCountRef.current) return;
    prevLoadedCountRef.current = loaded.length;

    const allPts = loaded.flatMap(q => q.data!.shapes![0].points!);
    if (allPts.length < 2) return;
    const lngs = allPts.map(p => p[0]);
    const lats  = allPts.map(p => p[1]);
    mapRef.current?.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 50, duration: 700 },
    );
  }, [shapeQueries]);

  // ── ResizeObserver keeps map canvas in sync while it is visible ─────────────
  React.useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => mapRef.current?.getMap()?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ResizeObserver does NOT fire on display:none → visible transitions (tab switch).
  // Call resize explicitly after the browser has laid out the newly-visible tab.
  React.useEffect(() => {
    if (activeTab !== "map") return;
    const id = setTimeout(() => mapRef.current?.getMap()?.resize(), 0);
    return () => clearTimeout(id);
  }, [activeTab]);

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRoute(id),
    onSuccess: () => {
      toast.success("Route deleted");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["routes"] });
    },
    onError: () => toast.error("Failed to delete route"),
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  function toggleRoute(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleMapMouseMove(e: MapLayerMouseEvent) {
    const id = (e.features?.[0]?.properties?.route_id as string) ?? null;
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
    const id = e.features?.[0]?.properties?.route_id as string | undefined;
    if (id) toggleRoute(id);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search routes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={typeFilter} onValueChange={v => setTypeFilter(v)}>
          <SelectTrigger className="w-36 text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ROUTE_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button asChild className="sm:ml-auto">
          <Link to="/routes/new">
            <PlusIcon className="mr-1.5 size-4" />
            New route
          </Link>
        </Button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
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

        {/* ── List tab ──────────────────────────────────────────────────────── */}
        <TabsContent value="list" className="mt-3 flex flex-col gap-3">
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-28">Route</TableHead>
                  <TableHead>Long name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right w-20">Trips</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-52" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-7 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : routes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                      No routes found
                    </TableCell>
                  </TableRow>
                ) : (
                  routes.map(route => (
                    <TableRow key={route.route_id} className="hover:bg-muted/30">
                      <TableCell>
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: routeColor(route) }}
                        >
                          {route.route_short_name}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-64">
                        <span className="text-sm truncate block">{route.route_long_name}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ROUTE_TYPE_LABELS[route.route_type] ?? `Type ${route.route_type}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {route.trips_count ?? 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button asChild variant="ghost" size="icon" className="size-7">
                            <Link to="/routes/$id/edit" params={{ id: route.route_id }}>
                              <PencilIcon className="size-3.5" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(route)}
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
                <ChevronLeftIcon className="size-3.5" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground px-1">
                Page {page} of {lastPage}
              </span>
              <Button
                variant="outline" size="sm" className="h-7 gap-1"
                disabled={page === lastPage || isFetching}
                onClick={() => setPage(p => p + 1)}
              >
                Next
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── Map tab ───────────────────────────────────────────────────────── */}
        <TabsContent value="map" className="mt-3">
          <div className="flex rounded-xl border overflow-hidden" style={{ height: 640 }}>

            {/* Sidebar */}
            <div className="w-64 shrink-0 flex flex-col border-r bg-muted/10">
              {/* Sidebar header */}
              <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
                <span className="text-xs text-muted-foreground">
                  {routes.length} routes · <span className="text-foreground font-medium">{selectedIds.size}</span> shown
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set(routes.map(r => r.route_id)))}
                    className="text-primary hover:underline"
                  >
                    All
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    None
                  </button>
                </div>
              </div>

              {/* Route list */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {isLoading ? (
                  <div className="p-3 space-y-1.5">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2 py-1">
                        <Skeleton className="size-3 rounded-full shrink-0" />
                        <Skeleton className="h-4 w-10 rounded-full shrink-0" />
                        <Skeleton className="h-3 flex-1" />
                      </div>
                    ))}
                  </div>
                ) : routes.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
                    No routes match filters
                  </div>
                ) : (
                  <div className="p-1.5 space-y-0.5">
                    {routes.map(route => {
                      const isSelected = selectedIds.has(route.route_id);
                      const qIdx = selectedArr.indexOf(route.route_id);
                      const isLoadingShape = isSelected && qIdx >= 0 && shapeQueries[qIdx]?.isLoading;
                      const isHovered = hoveredId === route.route_id;

                      return (
                        <button
                          key={route.route_id}
                          type="button"
                          onClick={() => toggleRoute(route.route_id)}
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
                            <div
                              className="size-3 rounded-full shrink-0"
                              style={{ backgroundColor: routeColor(route) }}
                            />
                          )}

                          <span
                            className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded shrink-0"
                            style={{ backgroundColor: routeColor(route) }}
                          >
                            {route.route_short_name}
                          </span>

                          <span className="text-xs text-muted-foreground truncate flex-1 leading-tight">
                            {route.route_long_name}
                          </span>

                          {isSelected
                            ? <EyeIcon    className="size-3 text-primary shrink-0" />
                            : <EyeOffIcon className="size-3 text-muted-foreground/30 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sidebar pagination */}
              {lastPage > 1 && (
                <div className="flex items-center justify-between px-2 py-1.5 border-t shrink-0">
                  <Button
                    variant="ghost" size="sm" className="h-6 px-2 text-xs gap-0.5"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeftIcon className="size-3" />
                    Prev
                  </Button>
                  <span className="text-[10px] text-muted-foreground">{page} / {lastPage}</span>
                  <Button
                    variant="ghost" size="sm" className="h-6 px-2 text-xs gap-0.5"
                    disabled={page === lastPage}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                    <ChevronRightIcon className="size-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Map */}
            <div ref={mapContainerRef} className="flex-1 relative min-w-0">
              {!MAPBOX_TOKEN ? (
                <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
                  Set{" "}
                  <code className="mx-1 font-mono bg-background px-1 rounded">
                    VITE_MAPBOX_TOKEN
                  </code>{" "}
                  to enable map
                </div>
              ) : (
                <>
                  <Map
                    ref={mapRef}
                    mapboxAccessToken={MAPBOX_TOKEN}
                    initialViewState={{
                      longitude: DEFAULT_CENTER.lng,
                      latitude:  DEFAULT_CENTER.lat,
                      zoom: 11,
                    }}
                    style={{ width: "100%", height: "100%" }}
                    mapStyle={mapStyle}
                    interactiveLayerIds={["routes-line"]}
                    onLoad={() => mapRef.current?.getMap()?.resize()}
                    onMouseMove={handleMapMouseMove}
                    onMouseLeave={handleMapMouseLeave}
                    onClick={handleMapClick}
                  >
                    <Source id="routes" type="geojson" data={routesGeoJSON}>
                      {/* White outline for contrast */}
                      <Layer
                        id="routes-outline"
                        type="line"
                        paint={{
                          "line-color": "#ffffff",
                          "line-width": ["case", ["get", "hovered"], 12, 8],
                          "line-opacity": 0.5,
                        } as object}
                      />
                      {/* Colored route line */}
                      <Layer
                        id="routes-line"
                        type="line"
                        layout={{ "line-cap": "round", "line-join": "round" } as object}
                        paint={{
                          "line-color": ["get", "color"],
                          "line-width": ["case", ["get", "hovered"], 6, 3.5],
                          "line-opacity": 0.9,
                        } as object}
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
                        <p className="text-sm font-medium">No routes shown</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Click routes in the sidebar to display them on the map
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Hover tooltip */}
                  {hoveredId && (() => {
                    const r = routes.find(x => x.route_id === hoveredId);
                    return r ? (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                        <div className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                          <span
                            className="text-xs font-bold text-white px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: routeColor(r) }}
                          >
                            {r.route_short_name}
                          </span>
                          <span className="text-sm">{r.route_long_name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {ROUTE_TYPE_LABELS[r.route_type] ?? `Type ${r.route_type}`}
                          </Badge>
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

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete route?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete route{" "}
              <strong>{deleteTarget?.route_short_name}</strong> —{" "}
              {deleteTarget?.route_long_name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.route_id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
