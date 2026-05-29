import * as React from "react";
import { useParams, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Map, { Marker, Source, Layer } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  fetchRoute,
  createRoute,
  updateRoute,
  saveRouteShape,
  saveRouteTripStops,
  stopsNearLine,
  type TripStop,
} from "@/api/routes";
import { fetchStops } from "@/api/stops";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeftIcon,
  Loader2Icon,
  MapPinIcon,
  PlusIcon,
  XIcon,
  GripVerticalIcon,
  PencilIcon,
  TrashIcon,
  RotateCcwIcon,
  RouteIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  LayersIcon,
  LockIcon,
  UnlockIcon,
  ScanIcon,
  Maximize2Icon,
  Minimize2Icon,
  Undo2Icon,
  Redo2Icon,
} from "lucide-react";
import type { Route, Stop } from "@/types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };
const MAP_HEIGHT = 580;

const MAP_STYLES = [
  { key: "streets",   label: "Streets",   uri: "mapbox://styles/mapbox/streets-v12" },
  { key: "satellite", label: "Satellite", uri: "mapbox://styles/mapbox/satellite-streets-v12" },
  { key: "outdoors",  label: "Outdoors",  uri: "mapbox://styles/mapbox/outdoors-v12" },
] as const;

const ROUTE_TYPES = [
  { value: "0", label: "Tram" },
  { value: "1", label: "Metro" },
  { value: "2", label: "Rail" },
  { value: "3", label: "Bus" },
  { value: "4", label: "Ferry" },
  { value: "5", label: "Cable car" },
  { value: "11", label: "Trolleybus" },
];

interface RouteForm {
  route_id: string;
  short_name: string;
  long_name: string;
  route_type: string;
  color: string;
}

interface EditorStop {
  stop: Stop;
  arrival_time: string;
  departure_time: string;
}

// ── Shape-point undo/redo history ─────────────────────────────────────────────
const MAX_HISTORY = 60;

interface ShapeHist { stack: [number, number][][]; idx: number; }
type ShapeAction =
  | { type: "PUSH";  points: [number, number][] }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "LOAD";  points: [number, number][] };   // reset history (server load / discard)

function shapeReducer(s: ShapeHist, a: ShapeAction): ShapeHist {
  switch (a.type) {
    case "PUSH": {
      const stack = [...s.stack.slice(0, s.idx + 1), a.points].slice(-MAX_HISTORY);
      return { stack, idx: stack.length - 1 };
    }
    case "UNDO": return { ...s, idx: Math.max(0, s.idx - 1) };
    case "REDO": return { ...s, idx: Math.min(s.stack.length - 1, s.idx + 1) };
    case "LOAD": return { stack: [a.points], idx: 0 };
  }
}

function useDebounce(value: string, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Sortable stop card ────────────────────────────────────────────────────────
function SortableStopCard({
  editorStop,
  index,
  routeColor,
  onUpdate,
  onRemove,
  onFly,
}: {
  editorStop: EditorStop;
  index: number;
  routeColor: string;
  onUpdate: (field: "arrival_time" | "departure_time", value: string) => void;
  onRemove: () => void;
  onFly: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: editorStop.stop.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 50 : undefined,
      }}
      className="rounded-lg border bg-card p-2.5 space-y-2 touch-none select-none"
    >
      <div className="flex items-center gap-1.5">
        {/* Drag handle */}
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5 shrink-0"
          type="button"
        >
          <GripVerticalIcon className="size-4" />
        </button>

        {/* Sequence badge */}
        <div
          className="size-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
          style={{ backgroundColor: `#${routeColor || "FF6F00"}` }}
        >
          {index + 1}
        </div>

        {/* Stop info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-none truncate">{editorStop.stop.name}</p>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">{editorStop.stop.id}</p>
        </div>

        {/* Fly-to */}
        <button
          type="button"
          onClick={onFly}
          className="text-muted-foreground hover:text-primary p-1 shrink-0"
          title="Fly to stop"
        >
          <MapPinIcon className="size-3.5" />
        </button>

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive p-1 shrink-0"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>

      {/* Times */}
      <div className="grid grid-cols-2 gap-2 pl-8">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Arrival</Label>
          <Input
            value={editorStop.arrival_time}
            onChange={e => onUpdate("arrival_time", e.target.value)}
            placeholder="HH:MM:SS"
            className="h-6 font-mono text-xs px-2"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Departure</Label>
          <Input
            value={editorStop.departure_time}
            onChange={e => onUpdate("departure_time", e.target.value)}
            placeholder="HH:MM:SS"
            className="h-6 font-mono text-xs px-2"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function RouteEditorPage() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = !!id;
  const mapRef = React.useRef<MapRef>(null);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [form, setForm] = React.useState<RouteForm>({
    route_id: "", short_name: "", long_name: "", route_type: "3", color: "FF6F00",
  });
  const [originalForm, setOriginalForm] = React.useState<RouteForm | null>(null);

  // ── Map state ───────────────────────────────────────────────────────────────
  const [mapStyle, setMapStyle] = React.useState<string>(MAP_STYLES[0].uri);
  const [shapeHist, dispatchShape] = React.useReducer(shapeReducer, { stack: [[]], idx: 0 });
  const shapePoints  = shapeHist.stack[shapeHist.idx];
  const canUndo      = shapeHist.idx > 0;
  const canRedo      = shapeHist.idx < shapeHist.stack.length - 1;
  const [originalShapePoints, setOriginalShapePoints] = React.useState<[number, number][]>([]);
  const [drawMode, setDrawMode] = React.useState<"idle" | "drawing" | "editing">("idle");
  const [isSnapping, setIsSnapping] = React.useState(false);
  const [isFindingStops, setIsFindingStops] = React.useState(false);
  const [savedShapeId, setSavedShapeId] = React.useState<string | null>(null);

  // ── Stop list state ─────────────────────────────────────────────────────────
  const [routeStops, setRouteStops] = React.useState<EditorStop[]>([]);
  const [originalStops, setOriginalStops] = React.useState<EditorStop[]>([]);
  const [nearbyStops, setNearbyStops] = React.useState<Stop[]>([]);
  const [stopSearchOpen, setStopSearchOpen] = React.useState(false);
  const [stopSearch, setStopSearch] = React.useState("");
  const debouncedStopSearch = useDebounce(stopSearch);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // ── Dirty tracking ──────────────────────────────────────────────────────────
  const isDirty = React.useMemo(() => {
    if (!originalForm || !isEdit) return false;
    return (
      form.short_name !== originalForm.short_name ||
      form.long_name  !== originalForm.long_name  ||
      form.color      !== originalForm.color       ||
      form.route_type !== originalForm.route_type  ||
      JSON.stringify(shapePoints)  !== JSON.stringify(originalShapePoints) ||
      JSON.stringify(routeStops.map(s => s.stop.id)) !==
      JSON.stringify(originalStops.map(s => s.stop.id))
    );
  }, [form, originalForm, shapePoints, originalShapePoints, routeStops, originalStops, isEdit]);

  // Browser close guard
  React.useEffect(() => {
    if (!isDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty]);

  // Exit fullscreen on Escape
  React.useEffect(() => {
    if (!isFullscreen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isFullscreen]);

  // Ctrl/Cmd+Z → undo, Ctrl/Cmd+Y / Ctrl/Cmd+Shift+Z → redo
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); dispatchShape({ type: "UNDO" }); }
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); dispatchShape({ type: "REDO" }); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // ResizeObserver fires after every layout change (initial paint, fullscreen, sidebar)
  // rAF fires before layout finishes — ResizeObserver is the correct hook here
  React.useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.getMap()?.resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Map cursor changes with draw mode
  React.useEffect(() => {
    const canvas = mapRef.current?.getMap()?.getCanvas();
    if (canvas) canvas.style.cursor = drawMode === "drawing" ? "crosshair" : "";
  }, [drawMode]);

  // ── Route query ─────────────────────────────────────────────────────────────
  const { data: route, isLoading } = useQuery({
    queryKey: ["route", id],
    queryFn: () => fetchRoute(id!),
    enabled: isEdit,
  });

  React.useEffect(() => {
    if (!route) return;

    const f: RouteForm = {
      route_id:   route.route_id,
      short_name: route.route_short_name,
      long_name:  route.route_long_name,
      route_type: String(route.route_type),
      color:      route.route_color ?? "FF6F00",
    };
    setForm(f);
    setOriginalForm(f);

    // Load shape from first shape record
    const pts: [number, number][] = route.shapes?.[0]?.points ?? [];
    dispatchShape({ type: "LOAD", points: pts });
    setOriginalShapePoints(pts);
    if (route.shapes?.[0]?.shape_id) setSavedShapeId(route.shapes[0].shape_id);

    if (pts.length >= 2) {
      const lngs = pts.map(p => p[0]);
      const lats  = pts.map(p => p[1]);
      setTimeout(() => {
        mapRef.current?.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60, duration: 800 }
        );
      }, 300);
    }

    // Load stops from first trip
    const trip = route.trips?.[0];
    if (trip?.stop_times) {
      const stops: EditorStop[] = trip.stop_times
        .slice()
        .sort((a, b) => a.stop_sequence - b.stop_sequence)
        .filter(st => st.stop)
        .map(st => ({
          stop:           st.stop!,
          arrival_time:   st.arrival_time,
          departure_time: st.departure_time,
        }));
      setRouteStops(stops);
      setOriginalStops(stops);
    }
  }, [route]);

  // ── Stop search combobox ────────────────────────────────────────────────────
  const { data: stopSearchResult, isFetching: stopsFetching } = useQuery({
    queryKey: ["stops:combobox", debouncedStopSearch],
    queryFn: () => fetchStops({ search: debouncedStopSearch || undefined, per_page: 12 }),
    enabled: stopSearchOpen,
    staleTime: 30_000,
  });
  const stopOptions = (stopSearchResult?.data ?? []).filter(
    s => !routeStops.some(rs => rs.stop.id === s.id)
  );

  // ── dnd-kit sensors ─────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Mutations ───────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const routePayload = {
        route_id:         form.route_id,
        route_short_name: form.short_name,
        route_long_name:  form.long_name,
        route_type:       parseInt(form.route_type),
        route_color:      form.color.toUpperCase().replace("#", ""),
      };

      // 1. Save route metadata
      const savedRoute = isEdit
        ? await updateRoute(id!, routePayload)
        : await createRoute(routePayload);

      const routeId = savedRoute.route_id;
      let shapeId: string | null = savedShapeId;

      // 2. Save shape if we have points
      if (shapePoints.length >= 2) {
        const { shape_id } = await saveRouteShape(routeId, shapePoints);
        shapeId = shape_id;
        setSavedShapeId(shape_id);
      }

      // 3. Save trip stops if we have any
      if (routeStops.length > 0) {
        const stops: TripStop[] = routeStops.map(rs => ({
          stop_id:        rs.stop.id,
          arrival_time:   rs.arrival_time  || "00:00:00",
          departure_time: rs.departure_time || "00:00:00",
        }));
        await saveRouteTripStops(routeId, stops, shapeId, form.short_name);
      }

      return routeId;
    },
    onSuccess: (routeId) => {
      toast.success(isEdit ? "Route saved" : "Route created");
      qc.invalidateQueries({ queryKey: ["routes"] });
      qc.invalidateQueries({ queryKey: ["route", routeId] });
      setOriginalForm({ ...form });
      setOriginalShapePoints([...shapePoints]);
      dispatchShape({ type: "LOAD", points: shapePoints }); // saved state becomes new history baseline
      setOriginalStops([...routeStops]);
      if (!isEdit) router.navigate({ to: "/routes" });
    },
    onError: () => toast.error("Failed to save route"),
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  function set(key: keyof RouteForm, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleBack() {
    if (isDirty && !window.confirm("Leave without saving? Your changes will be lost.")) return;
    router.history.back();
  }

  function discardChanges() {
    if (!originalForm) return;
    setForm(originalForm);
    dispatchShape({ type: "LOAD", points: originalShapePoints });
    setRouteStops(originalStops);
    setDrawMode("idle");
  }

  function handleMapClick(evt: { lngLat: { lat: number; lng: number } }) {
    if (drawMode !== "drawing") return;
    dispatchShape({ type: "PUSH", points: [...shapePoints, [evt.lngLat.lng, evt.lngLat.lat]] });
  }

  function updateShapePoint(index: number, lng: number, lat: number) {
    const next = [...shapePoints];
    next[index] = [lng, lat];
    dispatchShape({ type: "PUSH", points: next });
  }

  function removeShapePoint(index: number) {
    dispatchShape({ type: "PUSH", points: shapePoints.filter((_, i) => i !== index) });
  }

  function addStop(stop: Stop) {
    if (routeStops.some(rs => rs.stop.id === stop.id)) return;
    setRouteStops(prev => [...prev, { stop, arrival_time: "", departure_time: "" }]);
    setNearbyStops(prev => prev.filter(s => s.id !== stop.id));
  }

  function removeStop(stopId: string) {
    setRouteStops(prev => prev.filter(rs => rs.stop.id !== stopId));
  }

  function updateStopTime(
    stopId: string,
    field: "arrival_time" | "departure_time",
    value: string
  ) {
    setRouteStops(prev =>
      prev.map(rs => rs.stop.id === stopId ? { ...rs, [field]: value } : rs)
    );
  }

  function flyToStop(stop: Stop) {
    mapRef.current?.flyTo({ center: [stop.lng, stop.lat], zoom: 16, duration: 600 });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRouteStops(prev => {
      const oldIdx = prev.findIndex(s => s.stop.id === active.id);
      const newIdx = prev.findIndex(s => s.stop.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  async function handleSnapToRoads() {
    if (shapePoints.length < 2) { toast.error("Draw at least 2 points first"); return; }
    setIsSnapping(true);
    try {
      // Limit to 25 waypoints for Directions API
      const sampled =
        shapePoints.length > 25
          ? shapePoints.filter(
              (_, i) =>
                i === 0 ||
                i === shapePoints.length - 1 ||
                i % Math.ceil(shapePoints.length / 23) === 0
            )
          : shapePoints;

      const coords = sampled.map(p => p.join(",")).join(";");
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`;
      const res = await fetch(url);
      const data = (await res.json()) as { routes?: { geometry?: { coordinates?: [number, number][] } }[] };
      const snapped = data.routes?.[0]?.geometry?.coordinates;
      if (snapped && snapped.length >= 2) {
        dispatchShape({ type: "PUSH", points: snapped });
        toast.success("Route snapped to roads");
      } else {
        toast.error("Could not snap — no road geometry returned");
      }
    } catch {
      toast.error("Snap to roads failed");
    } finally {
      setIsSnapping(false);
    }
  }

  async function handleFindStops() {
    if (shapePoints.length < 2) { toast.error("Draw the route first"); return; }
    setIsFindingStops(true);
    try {
      const stops = await stopsNearLine(shapePoints, 200);
      const newStops = stops.filter(s => !routeStops.some(rs => rs.stop.id === s.id));
      setNearbyStops(newStops);
      toast.success(`Found ${stops.length} stop${stops.length !== 1 ? "s" : ""} along route`);
    } catch {
      toast.error("Failed to find stops");
    } finally {
      setIsFindingStops(false);
    }
  }

  // ── Derived / GeoJSON ───────────────────────────────────────────────────────
  const routeColor = form.color || "FF6F00";

  const routeGeoJSON = React.useMemo(() => ({
    type: "FeatureCollection" as const,
    features: shapePoints.length >= 2
      ? [{
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates: shapePoints },
          properties: {},
        }]
      : [],
  }), [shapePoints]);

  const canSave =
    !saveMutation.isPending &&
    form.short_name.trim() &&
    form.long_name.trim() &&
    (isEdit || form.route_id.trim());

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6 pb-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={handleBack}>
            <ArrowLeftIcon className="mr-1.5 size-4" />
            Back to routes
          </Button>
          <h2 className="text-lg font-semibold mt-2">{isEdit ? "Edit Route" : "New Route"}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <Button variant="outline" size="sm" onClick={discardChanges}>
              <RotateCcwIcon className="mr-1.5 size-3.5" />
              Discard
            </Button>
          )}
          <Button size="sm" disabled={!canSave} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create route"}
          </Button>
        </div>
      </div>

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

        {/* Left panel — route form + stop sequence */}
        <div className="w-full lg:w-[420px] shrink-0 flex flex-col gap-4">

          {/* Route details card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <RouteIcon className="size-3.5 text-primary" />
                Route details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              ) : (
                <>
                  {/* ID + Short name */}
                  <div className="grid grid-cols-2 gap-3">
                    {!isEdit && (
                      <div className="space-y-1.5">
                        <Label htmlFor="route_id" className="text-xs">Route ID</Label>
                        <Input
                          id="route_id" placeholder="NBO-001"
                          value={form.route_id} onChange={e => set("route_id", e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    )}
                    <div className={`space-y-1.5 ${!isEdit ? "" : "col-span-2"}`}>
                      <Label htmlFor="short_name" className="text-xs">Short name</Label>
                      <Input
                        id="short_name" placeholder="23"
                        value={form.short_name} onChange={e => set("short_name", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>

                  {/* Long name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="long_name" className="text-xs">Long name</Label>
                    <Input
                      id="long_name" placeholder="Westlands → CBD → Embakasi"
                      value={form.long_name} onChange={e => set("long_name", e.target.value)}
                      className="text-sm"
                    />
                  </div>

                  {/* Type + Color */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <Select value={form.route_type} onValueChange={v => set("route_type", v)}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROUTE_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="color" className="text-xs">Color</Label>
                      <div className="flex gap-2">
                        <div className="relative shrink-0">
                          <input
                            type="color"
                            value={`#${form.color}`}
                            onChange={e => set("color", e.target.value.replace("#", "").toUpperCase())}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                          />
                          <div
                            className="size-9 rounded-md border cursor-pointer"
                            style={{ backgroundColor: `#${form.color}` }}
                          />
                        </div>
                        <Input
                          id="color" value={form.color}
                          onChange={e => set("color", e.target.value.replace("#", "").toUpperCase())}
                          placeholder="FF6F00" className="font-mono text-sm uppercase" maxLength={6}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Route preview chip */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    Preview:
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: `#${routeColor}` }}
                    >
                      {form.short_name || "Route"}
                    </span>
                    <span className="truncate">{form.long_name || "Long name"}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Stop sequence card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm flex-1">Stop Sequence</CardTitle>
                {routeStops.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{routeStops.length}</Badge>
                )}
                {/* Add stop combobox */}
                <Popover open={stopSearchOpen} onOpenChange={setStopSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                      <PlusIcon className="size-3.5" />
                      Add stop
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search stops…"
                        value={stopSearch}
                        onValueChange={setStopSearch}
                      />
                      <CommandList>
                        {stopsFetching ? (
                          <div className="py-4 flex justify-center">
                            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <>
                            <CommandEmpty>No stops found</CommandEmpty>
                            <CommandGroup>
                              {stopOptions.map(s => (
                                <CommandItem
                                  key={s.id}
                                  value={s.id}
                                  onSelect={() => {
                                    addStop(s);
                                    setStopSearch("");
                                    setStopSearchOpen(false);
                                  }}
                                >
                                  <MapPinIcon className="size-3.5 mr-1.5 text-muted-foreground shrink-0" />
                                  <span className="flex-1 truncate">{s.name}</span>
                                  <span className="font-mono text-xs text-muted-foreground ml-2">{s.id}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0 max-h-96 overflow-y-auto pr-2">
              {routeStops.length === 0 ? (
                <div className="rounded-lg border border-dashed h-20 flex items-center justify-center text-xs text-muted-foreground">
                  Draw the route then click "Find Stops", or add stops manually
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={routeStops.map(s => s.stop.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {routeStops.map((rs, i) => (
                      <SortableStopCard
                        key={rs.stop.id}
                        editorStop={rs}
                        index={i}
                        routeColor={routeColor}
                        onUpdate={(field, value) => updateStopTime(rs.stop.id, field, value)}
                        onRemove={() => removeStop(rs.stop.id)}
                        onFly={() => flyToStop(rs.stop)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel — toolbar + map */}
        <div className={isFullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background"
          : "flex-1 flex flex-col gap-2 min-w-0"
        }>

          {/* Map toolbar */}
          <div className={`flex flex-wrap items-center gap-2 px-3 py-2 shrink-0 ${
            isFullscreen
              ? "border-b bg-background"
              : "rounded-xl border bg-muted/30"
          }`}>
            {/* Undo / Redo / Reset */}
            <div className="flex items-center gap-0.5">
              <Button
                size="sm" variant="ghost" className="h-7 w-7 p-0"
                onClick={() => dispatchShape({ type: "UNDO" })}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
              >
                <Undo2Icon className="size-3.5" />
              </Button>
              <Button
                size="sm" variant="ghost" className="h-7 w-7 p-0"
                onClick={() => dispatchShape({ type: "REDO" })}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
              >
                <Redo2Icon className="size-3.5" />
              </Button>
              {(canUndo || canRedo) && (
                <Button
                  size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
                  onClick={() => dispatchShape({ type: "LOAD", points: shapeHist.stack[0] })}
                  title="Reset to initial state"
                >
                  <RotateCcwIcon className="size-3.5" />
                </Button>
              )}
            </div>

            <Separator orientation="vertical" className="h-5 hidden sm:block" />

            {/* Draw controls */}
            <div className="flex items-center gap-1.5">
              {drawMode === "drawing" ? (
                <Button
                  size="sm" variant="default" className="h-7 text-xs gap-1"
                  onClick={() => setDrawMode("idle")}
                >
                  <CheckIcon className="size-3.5" />
                  Finish drawing
                </Button>
              ) : (
                <Button
                  size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => setDrawMode("drawing")}
                >
                  <PencilIcon className="size-3.5" />
                  Draw route
                </Button>
              )}

              <Button
                size="sm"
                variant={drawMode === "editing" ? "default" : "outline"}
                className="h-7 text-xs gap-1"
                onClick={() => setDrawMode(m => m === "editing" ? "idle" : "editing")}
                disabled={shapePoints.length === 0}
              >
                {drawMode === "editing"
                  ? <><UnlockIcon className="size-3.5" /> Editing</>
                  : <><LockIcon className="size-3.5" /> Edit points</>}
              </Button>

              {shapePoints.length > 0 && (
                <Button
                  size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                  onClick={() => {
                    dispatchShape({ type: "PUSH", points: [] });
                    setNearbyStops([]);
                    setDrawMode("idle");
                  }}
                >
                  <TrashIcon className="size-3.5" />
                  Clear
                </Button>
              )}
            </div>

            <Separator orientation="vertical" className="h-5 hidden sm:block" />

            {/* Snap + find stops */}
            <div className="flex items-center gap-1.5">
              <Button
                size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={handleSnapToRoads}
                disabled={isSnapping || shapePoints.length < 2 || !MAPBOX_TOKEN}
              >
                {isSnapping
                  ? <Loader2Icon className="size-3.5 animate-spin" />
                  : <RouteIcon className="size-3.5" />}
                Snap to roads
              </Button>

              <Button
                size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={handleFindStops}
                disabled={isFindingStops || shapePoints.length < 2}
              >
                {isFindingStops
                  ? <Loader2Icon className="size-3.5 animate-spin" />
                  : <ScanIcon className="size-3.5" />}
                Find stops
              </Button>
            </div>

            {/* Point count + fullscreen toggle */}
            <div className="flex items-center gap-2 ml-auto">
              {shapePoints.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {shapePoints.length} pts · {routeStops.length} stops
                </span>
              )}
              <Button
                size="sm" variant="ghost" className="h-7 w-7 p-0"
                onClick={() => setIsFullscreen(f => !f)}
                title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen map"}
              >
                {isFullscreen
                  ? <Minimize2Icon className="size-3.5" />
                  : <Maximize2Icon className="size-3.5" />}
              </Button>
            </div>
          </div>

          {/* Map */}
          <div
            ref={mapContainerRef}
            className={`relative overflow-hidden ${
              isFullscreen
                ? "flex-1 min-h-0"
                : "rounded-xl border"
            }`}
            style={isFullscreen ? undefined : { height: MAP_HEIGHT }}
          >
            {!MAPBOX_TOKEN ? (
              <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
                Set <code className="mx-1 font-mono bg-background px-1 rounded">VITE_MAPBOX_TOKEN</code> to enable map
              </div>
            ) : (
              <>
                <Map
                  ref={mapRef}
                  mapboxAccessToken={MAPBOX_TOKEN}
                  initialViewState={{
                    longitude: DEFAULT_CENTER.lng,
                    latitude: DEFAULT_CENTER.lat,
                    zoom: 12,
                  }}
                  style={{ width: "100%", height: "100%" }}
                  mapStyle={mapStyle}
                  onClick={handleMapClick}
                  doubleClickZoom={drawMode !== "drawing"}
                  onLoad={() => mapRef.current?.getMap()?.resize()}
                >
                  {/* Route line */}
                  <Source id="route-source" type="geojson" data={routeGeoJSON}>
                    {/* White outline for contrast */}
                    <Layer
                      id="route-outline"
                      type="line"
                      paint={{ "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.6 } as object}
                    />
                    {/* Colored route line */}
                    <Layer
                      id="route-line"
                      type="line"
                      layout={{ "line-cap": "round", "line-join": "round" } as object}
                      paint={{ "line-color": `#${routeColor}`, "line-width": 4, "line-opacity": 0.9 } as object}
                    />
                  </Source>

                  {/* Shape point markers (edit mode only) */}
                  {drawMode === "editing" && shapePoints.map((pt, i) => (
                    <Marker
                      key={`pt-${i}`}
                      longitude={pt[0]}
                      latitude={pt[1]}
                      draggable
                      onDragEnd={evt => updateShapePoint(i, evt.lngLat.lng, evt.lngLat.lat)}
                    >
                      <div className="group relative">
                        <div
                          className="size-3 rounded-full border-2 border-white shadow cursor-grab active:cursor-grabbing"
                          style={{ backgroundColor: `#${routeColor}` }}
                        />
                        <button
                          type="button"
                          onClick={() => removeShapePoint(i)}
                          className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-destructive text-destructive-foreground rounded-full size-4 items-center justify-center"
                        >
                          <XIcon className="size-2.5" />
                        </button>
                      </div>
                    </Marker>
                  ))}

                  {/* Route stop markers (numbered, always visible) */}
                  {routeStops.map((rs, i) => (
                    <Marker
                      key={`rs-${rs.stop.id}`}
                      longitude={rs.stop.lng}
                      latitude={rs.stop.lat}
                    >
                      <div
                        className="size-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white shadow-md cursor-pointer"
                        style={{ backgroundColor: `#${routeColor}` }}
                        title={rs.stop.name}
                        onClick={() => flyToStop(rs.stop)}
                      >
                        {i + 1}
                      </div>
                    </Marker>
                  ))}

                  {/* Nearby stop markers (gray dots, click to add) */}
                  {nearbyStops
                    .filter(s => !routeStops.some(rs => rs.stop.id === s.id))
                    .map(stop => (
                      <Marker key={`near-${stop.id}`} longitude={stop.lng} latitude={stop.lat}>
                        <button
                          type="button"
                          onClick={() => addStop(stop)}
                          title={`Add: ${stop.name}`}
                          className="size-4 rounded-full bg-muted-foreground/50 border-2 border-white shadow hover:bg-primary hover:scale-150 transition-all duration-150"
                        />
                      </Marker>
                    ))}
                </Map>

                {/* Map style switcher */}
                <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
                  {MAP_STYLES.map(style => (
                    <button
                      key={style.key}
                      type="button"
                      onClick={() => setMapStyle(style.uri)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border shadow-sm transition-colors ${
                        mapStyle === style.uri
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background/90 backdrop-blur-sm border-border hover:bg-muted"
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>

                {/* Draw mode hint */}
                {drawMode === "drawing" && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-1.5 text-xs text-muted-foreground shadow-md pointer-events-none">
                    Click to add points · Double-click to finish
                  </div>
                )}

                {/* Layer toggle button */}
                <div className="absolute bottom-3 right-3 z-10">
                  <button
                    type="button"
                    onClick={() => setDrawMode(m => m === "editing" ? "idle" : "editing")}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border shadow-sm transition-colors ${
                      drawMode === "editing"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background/90 backdrop-blur-sm border-border hover:bg-muted"
                    }`}
                    title="Toggle shape point editing"
                  >
                    <LayersIcon className="size-3.5" />
                    {drawMode === "editing" ? "Points on" : "Points off"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Nearby stops legend */}
          {nearbyStops.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <div className="size-3 rounded-full bg-muted-foreground/50 border border-muted-foreground shrink-0" />
              <span>
                {nearbyStops.filter(s => !routeStops.some(rs => rs.stop.id === s.id)).length} nearby stops —
                click a dot on the map to add
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
