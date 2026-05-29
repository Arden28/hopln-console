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
  fetchTrip,
  createTrip,
  updateTrip,
  deleteTrip,
  saveTripShape,
  saveTripStopTimes,
  stopsNearTripLine,
  type TripStopInput,
} from "@/api/trips";
import { fetchRoute, fetchRoutes } from "@/api/routes";
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
  LayersIcon,
  LockIcon,
  UnlockIcon,
  ScanIcon,
  Maximize2Icon,
  Minimize2Icon,
  Undo2Icon,
  Redo2Icon,
  CalendarClockIcon,
  Trash2Icon,
} from "lucide-react";
import type { Stop, Trip } from "@/types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };
const MAP_HEIGHT = 580;

const MAP_STYLES = [
  { key: "streets",   label: "Streets",   uri: "mapbox://styles/mapbox/streets-v12" },
  { key: "satellite", label: "Satellite", uri: "mapbox://styles/mapbox/satellite-streets-v12" },
  { key: "outdoors",  label: "Outdoors",  uri: "mapbox://styles/mapbox/outdoors-v12" },
] as const;

const SERVICE_OPTIONS = [
  { value: "daily",       label: "Daily" },
  { value: "weekdays",    label: "Weekdays" },
  { value: "weekends",    label: "Weekends" },
  { value: "school_days", label: "School days" },
  { value: "default",     label: "Default" },
];

// ── Shape history reducer ─────────────────────────────────────────────────────
const MAX_HISTORY = 60;

interface ShapeHist { stack: [number, number][][]; idx: number; }
type ShapeAction =
  | { type: "PUSH"; points: [number, number][] }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "LOAD"; points: [number, number][] };

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
  const [d, setD] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

// ── Trip stop entry ───────────────────────────────────────────────────────────
interface TripStopEntry {
  key: string;
  stop_id: string;
  name: string;
  lat: number;
  lng: number;
  arrival_time: string;
  departure_time: string;
}

// ── Sortable stop card ────────────────────────────────────────────────────────
function SortableStopCard({
  entry,
  index,
  color,
  onUpdate,
  onRemove,
  onFly,
}: {
  entry: TripStopEntry;
  index: number;
  color: string;
  onUpdate: (field: "arrival_time" | "departure_time", value: string) => void;
  onRemove: () => void;
  onFly: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.key });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1, zIndex: isDragging ? 50 : undefined }}
      className="rounded-lg border bg-card p-2.5 space-y-2 touch-none select-none"
    >
      <div className="flex items-center gap-1.5">
        <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5 shrink-0" type="button">
          <GripVerticalIcon className="size-4" />
        </button>
        <div className="size-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: color }}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-none truncate">{entry.name}</p>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">{entry.stop_id}</p>
        </div>
        <button type="button" onClick={onFly} className="text-muted-foreground hover:text-primary p-1 shrink-0" title="Fly to stop">
          <MapPinIcon className="size-3.5" />
        </button>
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive p-1 shrink-0">
          <XIcon className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 pl-8">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Arrival</Label>
          <Input value={entry.arrival_time} onChange={e => onUpdate("arrival_time", e.target.value)} placeholder="HH:MM:SS" className="h-6 font-mono text-xs px-2" />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Departure</Label>
          <Input value={entry.departure_time} onChange={e => onUpdate("departure_time", e.target.value)} placeholder="HH:MM:SS" className="h-6 font-mono text-xs px-2" />
        </div>
      </div>
    </div>
  );
}

// ── TripForm type ─────────────────────────────────────────────────────────────
interface TripForm {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign: string;
  direction_id: "0" | "1";
}

// ── Main component ────────────────────────────────────────────────────────────
export function TripEditorPage() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const router  = useRouter();
  const qc      = useQueryClient();
  const isEdit  = !!id;

  const mapRef          = React.useRef<MapRef>(null);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);

  // ── Form ────────────────────────────────────────────────────────────────────
  const [form, setForm] = React.useState<TripForm>({
    trip_id: "", route_id: "", service_id: "daily", trip_headsign: "", direction_id: "0",
  });
  const [originalForm, setOriginalForm] = React.useState<TripForm | null>(null);

  // ── Shape history ───────────────────────────────────────────────────────────
  const [shapeHist, dispatchShape] = React.useReducer(shapeReducer, { stack: [[]], idx: 0 });
  const shapePoints     = shapeHist.stack[shapeHist.idx];
  const canUndo         = shapeHist.idx > 0;
  const canRedo         = shapeHist.idx < shapeHist.stack.length - 1;
  const [originalShape, setOriginalShape] = React.useState<[number, number][]>([]);

  // ── Map ─────────────────────────────────────────────────────────────────────
  const [mapStyle, setMapStyle]       = React.useState(MAP_STYLES[0].uri);
  const [drawMode, setDrawMode]       = React.useState<"idle" | "drawing" | "editing">("idle");
  const [isSnapping, setIsSnapping]   = React.useState(false);
  const [isFindingStops, setIsFindingStops] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [nearbyStops, setNearbyStops] = React.useState<Stop[]>([]);

  // ── Stop sequence ───────────────────────────────────────────────────────────
  const [tripStops, setTripStops]         = React.useState<TripStopEntry[]>([]);
  const [originalStops, setOriginalStops] = React.useState<TripStopEntry[]>([]);
  const [stopSearchOpen, setStopSearchOpen] = React.useState(false);
  const [stopSearch, setStopSearch]       = React.useState("");
  const debouncedStopSearch               = useDebounce(stopSearch);

  // ── Route combobox ──────────────────────────────────────────────────────────
  const [routeSearchOpen, setRouteSearchOpen] = React.useState(false);
  const [routeSearch, setRouteSearch]         = React.useState("");
  const debouncedRouteSearch                  = useDebounce(routeSearch);

  // ── Delete ──────────────────────────────────────────────────────────────────
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  // ── Dirty tracking ──────────────────────────────────────────────────────────
  const isDirty = React.useMemo(() => {
    if (!isEdit) return false;
    if (!originalForm) return false;
    return (
      form.service_id    !== originalForm.service_id    ||
      form.trip_headsign !== originalForm.trip_headsign ||
      form.direction_id  !== originalForm.direction_id  ||
      JSON.stringify(shapePoints) !== JSON.stringify(originalShape) ||
      JSON.stringify(tripStops.map(s => s.stop_id)) !== JSON.stringify(originalStops.map(s => s.stop_id))
    );
  }, [form, originalForm, shapePoints, originalShape, tripStops, originalStops, isEdit]);

  // Browser close guard
  React.useEffect(() => {
    if (!isDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty]);

  // Fullscreen ESC
  React.useEffect(() => {
    if (!isFullscreen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isFullscreen]);

  // Fullscreen resize
  React.useEffect(() => {
    const id2 = setTimeout(() => mapRef.current?.getMap()?.resize(), 0);
    return () => clearTimeout(id2);
  }, [isFullscreen]);

  // Ctrl+Z / Ctrl+Y
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

  // ResizeObserver
  React.useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => mapRef.current?.getMap()?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Map cursor
  React.useEffect(() => {
    const canvas = mapRef.current?.getMap()?.getCanvas();
    if (canvas) canvas.style.cursor = drawMode === "drawing" ? "crosshair" : "";
  }, [drawMode]);

  // ── Fetch existing trip ─────────────────────────────────────────────────────
  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => fetchTrip(id!),
    enabled: isEdit,
  });

  React.useEffect(() => {
    if (!trip) return;
    const f: TripForm = {
      trip_id:      trip.trip_id,
      route_id:     trip.route_id,
      service_id:   trip.service_id ?? "daily",
      trip_headsign: trip.trip_headsign ?? "",
      direction_id: trip.direction_id !== undefined ? String(trip.direction_id) as "0" | "1" : "0",
    };
    setForm(f);
    setOriginalForm(f);

    const pts: [number, number][] = trip.shape?.points ?? [];
    dispatchShape({ type: "LOAD", points: pts });
    setOriginalShape(pts);

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

    if (trip.stop_times) {
      const stops: TripStopEntry[] = trip.stop_times
        .slice()
        .sort((a, b) => a.stop_sequence - b.stop_sequence)
        .filter(st => st.stop)
        .map(st => ({
          key:            st.stop!.id,
          stop_id:        st.stop!.id,
          name:           st.stop!.name,
          lat:            st.stop!.lat,
          lng:            st.stop!.lng,
          arrival_time:   st.arrival_time,
          departure_time: st.departure_time,
        }));
      setTripStops(stops);
      setOriginalStops(stops);
    }
  }, [trip]);

  // ── Reference route shape (parent route) ────────────────────────────────────
  const { data: refRoute } = useQuery({
    queryKey: ["route", form.route_id],
    queryFn: () => fetchRoute(form.route_id),
    enabled: !!form.route_id,
    staleTime: 60_000,
  });

  const refGeoJSON = React.useMemo(() => {
    const features: object[] = [];
    refRoute?.shapes?.forEach(sh => {
      if (sh.points && sh.points.length >= 2) {
        features.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: sh.points },
          properties: {},
        });
      }
    });
    return { type: "FeatureCollection" as const, features };
  }, [refRoute]);

  // ── Route search ────────────────────────────────────────────────────────────
  const { data: routeSearchResult, isFetching: routesFetching } = useQuery({
    queryKey: ["routes:combobox", debouncedRouteSearch],
    queryFn: () => fetchRoutes({ search: debouncedRouteSearch || undefined, per_page: 12 }),
    enabled: routeSearchOpen,
    staleTime: 30_000,
  });

  // ── Stop search ─────────────────────────────────────────────────────────────
  const { data: stopSearchResult, isFetching: stopsFetching } = useQuery({
    queryKey: ["stops:combobox", debouncedStopSearch],
    queryFn: () => fetchStops({ search: debouncedStopSearch || undefined, per_page: 12 }),
    enabled: stopSearchOpen,
    staleTime: 30_000,
  });
  const stopOptions = (stopSearchResult?.data ?? []).filter(
    s => !tripStops.some(ts => ts.stop_id === s.id)
  );

  // ── DnD sensors ─────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Mutations ────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const meta = {
        trip_id:       form.trip_id,
        route_id:      form.route_id,
        service_id:    form.service_id,
        trip_headsign: form.trip_headsign || null,
        direction_id:  parseInt(form.direction_id),
      };

      const saved: Trip = isEdit
        ? await updateTrip(id!, meta)
        : await createTrip(meta);

      const tripId = saved.trip_id;

      if (shapePoints.length >= 2) {
        await saveTripShape(tripId, shapePoints);
      }

      if (tripStops.length > 0) {
        const stops: TripStopInput[] = tripStops.map(ts => ({
          stop_id:        ts.stop_id,
          arrival_time:   ts.arrival_time  || "00:00:00",
          departure_time: ts.departure_time || "00:00:00",
        }));
        await saveTripStopTimes(tripId, stops);
      }

      return tripId;
    },
    onSuccess: (tripId) => {
      toast.success(isEdit ? "Trip saved" : "Trip created");
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      setOriginalForm({ ...form });
      setOriginalShape([...shapePoints]);
      dispatchShape({ type: "LOAD", points: shapePoints });
      setOriginalStops([...tripStops]);
      if (!isEdit) router.navigate({ to: "/trips" });
    },
    onError: () => toast.error("Failed to save trip"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTrip(id!),
    onSuccess: () => {
      toast.success("Trip deleted");
      qc.invalidateQueries({ queryKey: ["trips"] });
      router.navigate({ to: "/trips" });
    },
    onError: () => toast.error("Failed to delete trip"),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function set<K extends keyof TripForm>(key: K, value: TripForm[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleBack() {
    if (isDirty && !window.confirm("Leave without saving?")) return;
    router.history.back();
  }

  function discardChanges() {
    if (!originalForm) return;
    setForm(originalForm);
    dispatchShape({ type: "LOAD", points: originalShape });
    setTripStops(originalStops);
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
    if (tripStops.some(ts => ts.stop_id === stop.id)) return;
    setTripStops(prev => [...prev, {
      key: stop.id, stop_id: stop.id, name: stop.name,
      lat: stop.lat, lng: stop.lng, arrival_time: "", departure_time: "",
    }]);
    setNearbyStops(prev => prev.filter(s => s.id !== stop.id));
  }

  function removeStop(key: string) {
    setTripStops(prev => prev.filter(ts => ts.key !== key));
  }

  function updateStopTime(key: string, field: "arrival_time" | "departure_time", value: string) {
    setTripStops(prev => prev.map(ts => ts.key === key ? { ...ts, [field]: value } : ts));
  }

  function flyToStop(stop: { lat: number; lng: number }) {
    mapRef.current?.flyTo({ center: [stop.lng, stop.lat], zoom: 16, duration: 600 });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTripStops(prev => {
      const oldIdx = prev.findIndex(s => s.key === active.id);
      const newIdx = prev.findIndex(s => s.key === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  async function handleSnapToRoads() {
    if (shapePoints.length < 2) { toast.error("Draw at least 2 points first"); return; }
    setIsSnapping(true);
    try {
      const sampled = shapePoints.length > 25
        ? shapePoints.filter((_, i) =>
            i === 0 || i === shapePoints.length - 1 ||
            i % Math.ceil(shapePoints.length / 23) === 0
          )
        : shapePoints;
      const coords = sampled.map(p => p.join(",")).join(";");
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`;
      const res  = await fetch(url);
      const data = (await res.json()) as { routes?: { geometry?: { coordinates?: [number, number][] } }[] };
      const snapped = data.routes?.[0]?.geometry?.coordinates;
      if (snapped && snapped.length >= 2) {
        dispatchShape({ type: "PUSH", points: snapped });
        toast.success("Snapped to roads");
      } else {
        toast.error("No road geometry returned");
      }
    } catch {
      toast.error("Snap to roads failed");
    } finally {
      setIsSnapping(false);
    }
  }

  async function handleFindStops() {
    if (shapePoints.length < 2) { toast.error("Draw the route shape first"); return; }
    setIsFindingStops(true);
    try {
      const stops = await stopsNearTripLine(shapePoints, 200);
      const newStops = stops.filter(s => !tripStops.some(ts => ts.stop_id === s.id));
      setNearbyStops(newStops);
      toast.success(`Found ${stops.length} stop${stops.length !== 1 ? "s" : ""} along route`);
    } catch {
      toast.error("Failed to find stops");
    } finally {
      setIsFindingStops(false);
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const tripColor = refRoute?.route_color ? `#${refRoute.route_color}` : "#6366f1";

  const tripGeoJSON = React.useMemo(() => ({
    type: "FeatureCollection" as const,
    features: shapePoints.length >= 2
      ? [{ type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: shapePoints }, properties: {} }]
      : [],
  }), [shapePoints]);

  const canSave = !saveMutation.isPending && (isEdit || (form.trip_id.trim() && form.route_id));

  const selectedRoute = routeSearchResult?.data?.find(r => r.route_id === form.route_id);
  const displayRoute  = trip?.route ?? selectedRoute;

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6 pb-8">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={handleBack}>
            <ArrowLeftIcon className="mr-1.5 size-4" />
            Back to trips
          </Button>
          <h2 className="text-lg font-semibold mt-2 flex items-center gap-2">
            <CalendarClockIcon className="size-4 text-primary" />
            {isEdit ? `Edit Trip: ${id}` : "New Trip"}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <Button variant="outline" size="sm" onClick={discardChanges}>
              <RotateCcwIcon className="mr-1.5 size-3.5" />
              Discard
            </Button>
          )}
          {isEdit && (
            <Button
              variant="outline" size="sm"
              className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2Icon className="mr-1.5 size-3.5" />
              Delete
            </Button>
          )}
          <Button size="sm" disabled={!canSave} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create trip"}
          </Button>
        </div>
      </div>

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

        {/* Left panel — metadata */}
        <div className="w-full lg:w-[360px] shrink-0 flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <CalendarClockIcon className="size-3.5 text-primary" />
                Trip details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tripLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              ) : (
                <>
                  {/* Trip ID (new only) */}
                  {!isEdit && (
                    <div className="space-y-1.5">
                      <Label htmlFor="trip_id" className="text-xs">Trip ID</Label>
                      <Input
                        id="trip_id" placeholder="route_23_trip_1"
                        value={form.trip_id} onChange={e => set("trip_id", e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                  )}

                  {/* Route selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Route</Label>
                    {isEdit ? (
                      <div className="flex items-center gap-2 p-2.5 rounded-md border bg-muted/30">
                        {displayRoute ? (
                          <>
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                              style={{ backgroundColor: tripColor }}
                            >
                              {displayRoute.route_short_name}
                            </span>
                            <span className="text-sm truncate">{displayRoute.route_long_name}</span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground font-mono">{form.route_id}</span>
                        )}
                      </div>
                    ) : (
                      <Popover open={routeSearchOpen} onOpenChange={setRouteSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-sm h-9" role="combobox">
                            {form.route_id ? (
                              displayRoute ? (
                                <span className="flex items-center gap-2">
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                                    style={{ backgroundColor: tripColor }}
                                  >
                                    {displayRoute.route_short_name}
                                  </span>
                                  <span className="truncate">{displayRoute.route_long_name}</span>
                                </span>
                              ) : (
                                <span className="font-mono">{form.route_id}</span>
                              )
                            ) : (
                              <span className="text-muted-foreground">Select route…</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput placeholder="Search routes…" value={routeSearch} onValueChange={setRouteSearch} />
                            <CommandList>
                              {routesFetching ? (
                                <div className="py-4 flex justify-center">
                                  <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                                </div>
                              ) : (
                                <>
                                  <CommandEmpty>No routes found</CommandEmpty>
                                  <CommandGroup>
                                    {(routeSearchResult?.data ?? []).map(r => (
                                      <CommandItem
                                        key={r.route_id}
                                        value={r.route_id}
                                        onSelect={() => {
                                          set("route_id", r.route_id);
                                          if (!form.trip_headsign) set("trip_headsign", r.route_short_name);
                                          setRouteSearchOpen(false);
                                        }}
                                      >
                                        <span
                                          className="mr-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                                          style={{ backgroundColor: r.route_color ? `#${r.route_color}` : "#6366f1" }}
                                        >
                                          {r.route_short_name}
                                        </span>
                                        <span className="flex-1 truncate text-sm">{r.route_long_name}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>

                  {/* Headsign */}
                  <div className="space-y-1.5">
                    <Label htmlFor="headsign" className="text-xs">Headsign</Label>
                    <Input
                      id="headsign" placeholder="CBD → Westlands"
                      value={form.trip_headsign} onChange={e => set("trip_headsign", e.target.value)}
                      className="text-sm"
                    />
                  </div>

                  {/* Service + Direction */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Service</Label>
                      <Select value={form.service_id} onValueChange={v => set("service_id", v)}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SERVICE_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Direction</Label>
                      <Select value={form.direction_id} onValueChange={v => set("direction_id", v as "0" | "1")}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 — Outbound</SelectItem>
                          <SelectItem value="1">1 — Inbound</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Route preview */}
                  {displayRoute && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/40 text-xs text-muted-foreground">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: tripColor }}>
                        {displayRoute.route_short_name}
                      </span>
                      <span className="truncate">{displayRoute.route_long_name}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Stop sequence card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm flex-1">Stop Sequence</CardTitle>
                {tripStops.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{tripStops.length}</Badge>
                )}
                <Popover open={stopSearchOpen} onOpenChange={setStopSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                      <PlusIcon className="size-3.5" />
                      Add stop
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Search stops…" value={stopSearch} onValueChange={setStopSearch} />
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
              {tripStops.length === 0 ? (
                <div className="rounded-lg border border-dashed h-20 flex items-center justify-center text-xs text-muted-foreground text-center px-4">
                  Draw the shape, then click "Find stops" — or add manually
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={tripStops.map(s => s.key)} strategy={verticalListSortingStrategy}>
                    {tripStops.map((ts, i) => (
                      <SortableStopCard
                        key={ts.key}
                        entry={ts}
                        index={i}
                        color={tripColor}
                        onUpdate={(field, value) => updateStopTime(ts.key, field, value)}
                        onRemove={() => removeStop(ts.key)}
                        onFly={() => flyToStop(ts)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
              {tripStops.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTripStops([])}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors w-full text-center pt-1"
                >
                  Clear all stops
                </button>
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
            isFullscreen ? "border-b bg-background" : "rounded-xl border bg-muted/30"
          }`}>
            {/* Undo / Redo / Reset */}
            <div className="flex items-center gap-0.5">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => dispatchShape({ type: "UNDO" })} disabled={!canUndo} title="Undo (Ctrl+Z)">
                <Undo2Icon className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => dispatchShape({ type: "REDO" })} disabled={!canRedo} title="Redo (Ctrl+Y)">
                <Redo2Icon className="size-3.5" />
              </Button>
              {(canUndo || canRedo) && (
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => dispatchShape({ type: "LOAD", points: shapeHist.stack[0] })} title="Reset to initial state">
                  <RotateCcwIcon className="size-3.5" />
                </Button>
              )}
            </div>

            <Separator orientation="vertical" className="h-5 hidden sm:block" />

            {/* Draw controls */}
            <div className="flex items-center gap-1.5">
              {drawMode === "drawing" ? (
                <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => setDrawMode("idle")}>
                  <CheckIcon className="size-3.5" /> Finish drawing
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setDrawMode("drawing")}>
                  <PencilIcon className="size-3.5" /> Draw shape
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
                  : <><LockIcon className="size-3.5" /> Edit points</>
                }
              </Button>
              {shapePoints.length > 0 && (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                  onClick={() => { dispatchShape({ type: "PUSH", points: [] }); setNearbyStops([]); setDrawMode("idle"); }}>
                  <TrashIcon className="size-3.5" /> Clear
                </Button>
              )}
            </div>

            <Separator orientation="vertical" className="h-5 hidden sm:block" />

            {/* Snap + find stops */}
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleSnapToRoads} disabled={isSnapping || shapePoints.length < 2 || !MAPBOX_TOKEN}>
                {isSnapping ? <Loader2Icon className="size-3.5 animate-spin" /> : <RouteIcon className="size-3.5" />}
                Snap to roads
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleFindStops} disabled={isFindingStops || shapePoints.length < 2}>
                {isFindingStops ? <Loader2Icon className="size-3.5 animate-spin" /> : <ScanIcon className="size-3.5" />}
                Find stops
              </Button>
            </div>

            {/* Count + fullscreen */}
            <div className="flex items-center gap-2 ml-auto">
              {shapePoints.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {shapePoints.length} pts · {tripStops.length} stops
                </span>
              )}
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setIsFullscreen(f => !f)} title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}>
                {isFullscreen ? <Minimize2Icon className="size-3.5" /> : <Maximize2Icon className="size-3.5" />}
              </Button>
            </div>
          </div>

          {/* Map */}
          <div
            ref={mapContainerRef}
            className={`relative overflow-hidden ${isFullscreen ? "flex-1 min-h-0" : "rounded-xl border"}`}
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
                  initialViewState={{ longitude: DEFAULT_CENTER.lng, latitude: DEFAULT_CENTER.lat, zoom: 12 }}
                  style={{ width: "100%", height: "100%" }}
                  mapStyle={mapStyle}
                  onClick={handleMapClick}
                  doubleClickZoom={drawMode !== "drawing"}
                  onLoad={() => mapRef.current?.getMap()?.resize()}
                >
                  {/* Reference route shape (faint gray dashed) */}
                  {refGeoJSON.features.length > 0 && (
                    <Source id="route-ref-source" type="geojson" data={refGeoJSON}>
                      <Layer
                        id="route-ref-line"
                        type="line"
                        layout={{ "line-cap": "round", "line-join": "round" } as object}
                        paint={{ "line-color": "#94a3b8", "line-width": 3, "line-opacity": 0.4, "line-dasharray": [2, 3] } as object}
                      />
                    </Source>
                  )}

                  {/* Trip shape */}
                  <Source id="trip-shape-source" type="geojson" data={tripGeoJSON}>
                    <Layer id="trip-outline" type="line" paint={{ "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.6 } as object} />
                    <Layer
                      id="trip-line"
                      type="line"
                      layout={{ "line-cap": "round", "line-join": "round" } as object}
                      paint={{ "line-color": tripColor, "line-width": 4, "line-opacity": 0.9 } as object}
                    />
                  </Source>

                  {/* Shape point markers (edit mode) */}
                  {drawMode === "editing" && shapePoints.map((pt, i) => (
                    <Marker key={`pt-${i}`} longitude={pt[0]} latitude={pt[1]} draggable onDragEnd={evt => updateShapePoint(i, evt.lngLat.lng, evt.lngLat.lat)}>
                      <div className="group relative">
                        <div className="size-3 rounded-full border-2 border-white shadow cursor-grab active:cursor-grabbing" style={{ backgroundColor: tripColor }} />
                        <button type="button" onClick={() => removeShapePoint(i)} className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-destructive text-destructive-foreground rounded-full size-4 items-center justify-center">
                          <XIcon className="size-2.5" />
                        </button>
                      </div>
                    </Marker>
                  ))}

                  {/* Trip stop markers (numbered) */}
                  {tripStops.map((ts, i) => (
                    <Marker key={`ts-${ts.key}`} longitude={ts.lng} latitude={ts.lat}>
                      <div
                        className="size-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white shadow-md cursor-pointer"
                        style={{ backgroundColor: tripColor }}
                        title={ts.name}
                        onClick={() => flyToStop(ts)}
                      >
                        {i + 1}
                      </div>
                    </Marker>
                  ))}

                  {/* Nearby stop markers (gray dots, click to add) */}
                  {nearbyStops
                    .filter(s => !tripStops.some(ts => ts.stop_id === s.id))
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

                {/* Edit points toggle button */}
                <div className="absolute bottom-3 right-3 z-10">
                  <button
                    type="button"
                    onClick={() => setDrawMode(m => m === "editing" ? "idle" : "editing")}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border shadow-sm transition-colors ${
                      drawMode === "editing"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background/90 backdrop-blur-sm border-border hover:bg-muted"
                    }`}
                  >
                    <LayersIcon className="size-3.5" />
                    {drawMode === "editing" ? "Points on" : "Points off"}
                  </button>
                </div>

                {/* Reference layer legend */}
                {refGeoJSON.features.length > 0 && (
                  <div className="absolute bottom-3 left-3 z-10 bg-background/80 backdrop-blur-sm border rounded-md px-2 py-1 flex items-center gap-1.5 text-xs text-muted-foreground shadow-sm">
                    <div className="w-4 h-0 border-t-2 border-dashed border-slate-400 shrink-0" />
                    Route reference shape
                  </div>
                )}
              </>
            )}
          </div>

          {/* Nearby stops legend */}
          {nearbyStops.filter(s => !tripStops.some(ts => ts.stop_id === s.id)).length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <div className="size-3 rounded-full bg-muted-foreground/50 border border-muted-foreground shrink-0" />
              <span>
                {nearbyStops.filter(s => !tripStops.some(ts => ts.stop_id === s.id)).length} nearby stops — click a dot on the map to add
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Delete dialog ──────────────────────────────────────────────────── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trip?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{id}</strong> and all its stop times. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
