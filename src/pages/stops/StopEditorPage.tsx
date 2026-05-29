import * as React from "react";
import { useParams, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Map, { Marker } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchStop, createStop, updateStop, createStopTime, fetchStops } from "@/api/stops";
import { fetchRoutes } from "@/api/routes";
import { approveContribution, declineContribution } from "@/api/contributions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, timeAgo, resolveStorageUrl } from "@/lib/utils";
import {
  ArrowLeftIcon,
  Loader2Icon,
  MapPinIcon,
  ClockIcon,
  MessageSquareIcon,
  ImageIcon,
  CalendarIcon,
  ChevronsUpDownIcon,
  XIcon,
  CheckIcon,
  LockIcon,
  UnlockIcon,
  SearchIcon,
  PlusIcon,
  RotateCcwIcon,
} from "lucide-react";
import type { Contribution, Route, Stop, StopTime } from "@/types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };
const MAP_HEIGHT = 520;

const STATUS_COLORS: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  declined: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300",
};

const MAP_STYLES = [
  { key: "streets",   label: "Streets",   uri: "mapbox://styles/mapbox/streets-v12" },
  { key: "satellite", label: "Satellite", uri: "mapbox://styles/mapbox/satellite-streets-v12" },
  { key: "outdoors",  label: "Outdoors",  uri: "mapbox://styles/mapbox/outdoors-v12" },
] as const;

interface StopForm {
  id: string;
  name: string;
  lat: string;
  lng: string;
  parent_sta: string;
}

interface GeocodingFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

function useDebounce(value: string, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function StopEditorPage() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = !!id;
  const mapRef = React.useRef<MapRef>(null);

  // ── Form state ────────────────────────────────────────────────
  const [form, setForm] = React.useState<StopForm>({
    id: "", name: "",
    lat: String(DEFAULT_CENTER.lat), lng: String(DEFAULT_CENTER.lng),
    parent_sta: "",
  });
  const [originalForm, setOriginalForm] = React.useState<StopForm | null>(null);
  const [selectedRoutes, setSelectedRoutes] = React.useState<Route[]>([]);
  const [originalRoutes, setOriginalRoutes] = React.useState<Route[]>([]);

  // ── Map state ─────────────────────────────────────────────────
  const [draggable, setDraggable] = React.useState(false);
  const [mapStyle, setMapStyle] = React.useState<string>(MAP_STYLES[0].uri);
  const [geocodeQuery, setGeocodeQuery] = React.useState("");
  const [geocodeOpen, setGeocodeOpen] = React.useState(false);
  const debouncedGeocode = useDebounce(geocodeQuery, 400);

  // ── Combobox state ────────────────────────────────────────────
  const [parentOpen, setParentOpen]     = React.useState(false);
  const [parentSearch, setParentSearch] = React.useState("");
  const debouncedParentSearch           = useDebounce(parentSearch);
  const [routeOpen, setRouteOpen]       = React.useState(false);
  const [routeSearch, setRouteSearch]   = React.useState("");
  const debouncedRouteSearch            = useDebounce(routeSearch);

  // ── Modal / UI state ──────────────────────────────────────────
  const [photoModal, setPhotoModal]       = React.useState<Contribution | null>(null);
  const [declineTarget, setDeclineTarget] = React.useState<Contribution | null>(null);
  const [declineReason, setDeclineReason] = React.useState("");
  const [addingStopTime, setAddingStopTime] = React.useState(false);
  const [newSt, setNewSt] = React.useState({
    trip_id: "", arrival_time: "", departure_time: "", stop_sequence: "",
  });

  // ── Dirty tracking ────────────────────────────────────────────
  const isDirty = React.useMemo(() => {
    if (!originalForm || !isEdit) return false;
    return (
      form.name !== originalForm.name ||
      form.lat  !== originalForm.lat  ||
      form.lng  !== originalForm.lng  ||
      form.parent_sta !== originalForm.parent_sta ||
      JSON.stringify(selectedRoutes.map(r => r.route_id)) !==
      JSON.stringify(originalRoutes.map(r => r.route_id))
    );
  }, [form, originalForm, selectedRoutes, originalRoutes, isEdit]);

  // Browser tab/window close guard
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Data queries ──────────────────────────────────────────────
  const { data: stop, isLoading } = useQuery({
    queryKey: ["stop", id],
    queryFn: () => fetchStop(id!),
    enabled: isEdit,
  });

  React.useEffect(() => {
    if (!stop) return;
    const f: StopForm = {
      id: stop.id, name: stop.name,
      lat: String(stop.lat), lng: String(stop.lng),
      parent_sta: stop.parent_sta ?? "",
    };
    setForm(f);
    setOriginalForm(f);
    const routes: Route[] = stop.route_nams
      ? [...new Set(stop.route_nams.split(",").filter(Boolean))].map(n => ({
          route_id: n, route_short_name: n, route_long_name: n, route_type: 3,
        }))
      : [];
    setSelectedRoutes(routes);
    setOriginalRoutes(routes);
    mapRef.current?.flyTo({ center: [stop.lng, stop.lat], zoom: 15, duration: 800 });
  }, [stop]);

  const { data: parentResult, isFetching: parentFetching } = useQuery({
    queryKey: ["stops:combobox", debouncedParentSearch],
    queryFn: () => fetchStops({ search: debouncedParentSearch || undefined, per_page: 12 }),
    enabled: parentOpen,
    staleTime: 30_000,
  });
  const parentOptions = (parentResult?.data ?? []).filter((s: Stop) => s.id !== form.id);

  const { data: routeOptions = [], isFetching: routeFetching } = useQuery({
    queryKey: ["routes:combobox", debouncedRouteSearch],
    queryFn: () => fetchRoutes({ search: debouncedRouteSearch || undefined, per_page: 15 }),
    select: (res) => res.data,
    enabled: routeOpen,
    staleTime: 30_000,
  });

  const { data: geocodeResults = [] } = useQuery<GeocodingFeature[]>({
    queryKey: ["geocode", debouncedGeocode],
    queryFn: async () => {
      if (!debouncedGeocode || !MAPBOX_TOKEN) return [];
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(debouncedGeocode)}.json?access_token=${MAPBOX_TOKEN}&country=KE&limit=5`;
      const res = await fetch(url);
      const json = await res.json() as { features?: GeocodingFeature[] };
      return json.features ?? [];
    },
    enabled: debouncedGeocode.length >= 2,
    staleTime: 60_000,
  });

  // ── Mutations ─────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        id:         form.id,
        name:       form.name,
        lat:        parseFloat(form.lat),
        lng:        parseFloat(form.lng),
        parent_sta: form.parent_sta || null,
        route_ids:  selectedRoutes.map(r => r.route_id).join(",") || null,
        route_nams: selectedRoutes.map(r => r.route_short_name).join(",") || null,
      };
      return isEdit ? updateStop(id!, payload) : createStop(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Stop updated" : "Stop created");
      qc.invalidateQueries({ queryKey: ["stops"] });
      if (isEdit) {
        setOriginalForm({ ...form });
        setOriginalRoutes([...selectedRoutes]);
      }
      router.navigate({ to: "/stops" });
    },
    onError: () => toast.error(isEdit ? "Failed to update stop" : "Failed to create stop"),
  });

  const approveMutation = useMutation({
    mutationFn: (contributionId: string) => approveContribution(contributionId),
    onSuccess: () => {
      toast.success("Contribution approved");
      qc.invalidateQueries({ queryKey: ["stop", id] });
    },
    onError: () => toast.error("Failed to approve contribution"),
  });

  const declineMutation = useMutation({
    mutationFn: ({ cId, reason }: { cId: string; reason: string }) =>
      declineContribution(cId, reason),
    onSuccess: () => {
      toast.success("Contribution declined");
      setDeclineTarget(null);
      setDeclineReason("");
      qc.invalidateQueries({ queryKey: ["stop", id] });
    },
    onError: () => toast.error("Failed to decline contribution"),
  });

  const addStopTimeMutation = useMutation({
    mutationFn: () =>
      createStopTime(id!, {
        trip_id:        newSt.trip_id,
        arrival_time:   newSt.arrival_time,
        departure_time: newSt.departure_time,
        stop_sequence:  parseInt(newSt.stop_sequence) || 0,
      }),
    onSuccess: () => {
      toast.success("Stop time added");
      setAddingStopTime(false);
      setNewSt({ trip_id: "", arrival_time: "", departure_time: "", stop_sequence: "" });
      qc.invalidateQueries({ queryKey: ["stop", id] });
    },
    onError: () => toast.error("Failed to add stop time"),
  });

  // ── Handlers ──────────────────────────────────────────────────
  const lat = parseFloat(form.lat) || DEFAULT_CENTER.lat;
  const lng = parseFloat(form.lng) || DEFAULT_CENTER.lng;

  function handleMarkerDrag(evt: { lngLat: { lat: number; lng: number } }) {
    setForm(f => ({
      ...f,
      lat: evt.lngLat.lat.toFixed(6),
      lng: evt.lngLat.lng.toFixed(6),
    }));
  }

  function set(key: keyof StopForm, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function toggleRoute(route: Route) {
    setSelectedRoutes(prev =>
      prev.some(r => r.route_id === route.route_id)
        ? prev.filter(r => r.route_id !== route.route_id)
        : [...prev, route]
    );
  }

  function handleBack() {
    if (isDirty && !window.confirm("Leave without saving? Your changes will be lost.")) return;
    router.history.back();
  }

  function discardChanges() {
    if (!originalForm) return;
    setForm(originalForm);
    setSelectedRoutes(originalRoutes);
  }

  function handleGeocodeSelect(feature: GeocodingFeature) {
    const [fLng, fLat] = feature.center;
    setForm(f => ({ ...f, lat: fLat.toFixed(6), lng: fLng.toFixed(6) }));
    mapRef.current?.flyTo({ center: [fLng, fLat], zoom: 16, duration: 800 });
    setGeocodeQuery("");
    setGeocodeOpen(false);
  }

  // ── Derived ───────────────────────────────────────────────────
  const reviews: Contribution[] = (stop?.contributions ?? []).filter(
    c => c.type === "stop_review" || c.type === "delay_report"
  );
  const photos: Contribution[] = (stop?.contributions ?? []).filter(
    c => c.type === "stop_photo"
  );
  const stopTimes: StopTime[] = stop?.stop_times ?? [];

  const parentLabel = form.parent_sta
    ? (parentOptions.find(s => s.id === form.parent_sta)?.name ?? form.parent_sta)
    : "Select parent stop…";

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6 pb-8">

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={handleBack}>
            <ArrowLeftIcon className="mr-1.5 size-4" />
            Back to stops
          </Button>
          <h2 className="text-lg font-semibold mt-2">{isEdit ? "Edit Stop" : "New Stop"}</h2>
        </div>

        {isEdit && (
          <div className="flex items-center gap-2 shrink-0">
            {isDirty && (
              <Button variant="outline" size="sm" onClick={discardChanges}>
                <RotateCcwIcon className="mr-1.5 size-3.5" />
                Discard
              </Button>
            )}
            <Button
              size="sm"
              disabled={saveMutation.isPending || !form.name}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        )}
      </div>

      {/* ── Top row: form card + map ──────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

        {/* Left — details card */}
        <Card className="w-full lg:w-96 shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Stop details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : (
              <>
                {/* ID + Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="stop_id">Stop ID</Label>
                    <Input
                      id="stop_id" placeholder="NBO_001"
                      value={form.id} onChange={e => set("id", e.target.value)}
                      disabled={isEdit}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name" placeholder="CBD Bus Stop"
                      value={form.name} onChange={e => set("name", e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Coordinates */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <MapPinIcon className="size-3.5 text-primary" />
                    Location
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="lat" className="text-xs text-muted-foreground">Latitude</Label>
                      <Input
                        id="lat" type="number" step="0.000001"
                        value={form.lat} onChange={e => set("lat", e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lng" className="text-xs text-muted-foreground">Longitude</Label>
                      <Input
                        id="lng" type="number" step="0.000001"
                        value={form.lng} onChange={e => set("lng", e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Search above, click the map, or{" "}
                    <button
                      type="button"
                      className="underline underline-offset-2 hover:text-foreground transition-colors"
                      onClick={() => setDraggable(v => !v)}
                    >
                      {draggable ? "lock the pin" : "enable pin drag"}
                    </button>
                  </p>
                </div>

                <Separator />

                {/* Parent stop — searchable single-select */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Parent Stop</Label>
                  <Popover open={parentOpen} onOpenChange={setParentOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline" role="combobox" aria-expanded={parentOpen}
                        className="w-full justify-between font-normal"
                      >
                        <span className="truncate text-sm">
                          {form.parent_sta ? (
                            <span className="flex items-center gap-1.5">
                              <MapPinIcon className="size-3 text-primary" />
                              {parentLabel}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No parent stop</span>
                          )}
                        </span>
                        <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search stops…"
                          value={parentSearch}
                          onValueChange={setParentSearch}
                        />
                        <CommandList>
                          {parentFetching ? (
                            <div className="py-4 flex justify-center">
                              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : (
                            <>
                              <CommandEmpty>No stops found</CommandEmpty>
                              <CommandGroup>
                                {form.parent_sta && (
                                  <CommandItem
                                    value="__clear__"
                                    onSelect={() => { set("parent_sta", ""); setParentOpen(false); }}
                                    className="text-muted-foreground italic"
                                  >
                                    <XIcon className="size-3.5 mr-1.5" />
                                    Clear parent stop
                                  </CommandItem>
                                )}
                                {parentOptions.map(s => (
                                  <CommandItem
                                    key={s.id} value={s.id}
                                    onSelect={() => {
                                      set("parent_sta", s.id === form.parent_sta ? "" : s.id);
                                      setParentOpen(false);
                                    }}
                                  >
                                    <span className="flex-1 truncate">{s.name}</span>
                                    <span className="font-mono text-xs text-muted-foreground ml-2">{s.id}</span>
                                    {form.parent_sta === s.id && <CheckIcon className="size-3.5 ml-1 text-primary" />}
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

                {/* Routes — searchable multi-select */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Routes</Label>
                  <Popover open={routeOpen} onOpenChange={setRouteOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline" role="combobox" aria-expanded={routeOpen}
                        className="w-full justify-between font-normal h-auto min-h-9 py-1.5"
                      >
                        {selectedRoutes.length === 0 ? (
                          <span className="text-muted-foreground text-sm">No routes assigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {selectedRoutes.map(r => (
                              <Badge key={r.route_id} variant="secondary" className="text-xs px-1.5 py-0">
                                {r.route_short_name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search routes…"
                          value={routeSearch}
                          onValueChange={setRouteSearch}
                        />
                        <CommandList>
                          {routeFetching ? (
                            <div className="py-4 flex justify-center">
                              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : (
                            <>
                              <CommandEmpty>No routes found</CommandEmpty>
                              {selectedRoutes.length > 0 && (
                                <CommandGroup heading="Selected">
                                  {selectedRoutes.map(r => (
                                    <CommandItem key={r.route_id} value={r.route_id} onSelect={() => toggleRoute(r)}>
                                      <span
                                        className="inline-block size-2 rounded-full mr-1.5 shrink-0"
                                        style={{ backgroundColor: r.route_color ? `#${r.route_color}` : "var(--primary)" }}
                                      />
                                      <span className="font-medium">{r.route_short_name}</span>
                                      <span className="ml-1.5 text-xs text-muted-foreground truncate">{r.route_long_name}</span>
                                      <CheckIcon className="ml-auto size-3.5 text-primary" />
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                              <CommandGroup heading="All routes">
                                {routeOptions
                                  .filter(r => !selectedRoutes.some(s => s.route_id === r.route_id))
                                  .map(r => (
                                    <CommandItem key={r.route_id} value={r.route_id} onSelect={() => toggleRoute(r)}>
                                      <span
                                        className="inline-block size-2 rounded-full mr-1.5 shrink-0"
                                        style={{ backgroundColor: r.route_color ? `#${r.route_color}` : "var(--muted-foreground)" }}
                                      />
                                      <span className="font-medium">{r.route_short_name}</span>
                                      <span className="ml-1.5 text-xs text-muted-foreground truncate">{r.route_long_name}</span>
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

                {/* Read-only metadata (edit only) */}
                {isEdit && stop && (stop.trip_count != null || stop.aliases) && (
                  <>
                    <Separator />
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {stop.trip_count != null && (
                        <p>Trips served: <span className="font-medium text-foreground">{stop.trip_count}</span></p>
                      )}
                      {stop.aliases && (
                        <p>Aliases: <span className="font-medium text-foreground">{stop.aliases}</span></p>
                      )}
                    </div>
                  </>
                )}

                {/* Create button (new stop only) */}
                {!isEdit && (
                  <Button
                    className="w-full"
                    disabled={saveMutation.isPending || !form.name || !form.id}
                    onClick={() => saveMutation.mutate()}
                  >
                    {saveMutation.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                    Create stop
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Right — geocode + map */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">

          {/* Geocode address search */}
          {MAPBOX_TOKEN && (
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none z-10" />
              <Input
                placeholder="Search for a place…"
                value={geocodeQuery}
                onChange={e => {
                  setGeocodeQuery(e.target.value);
                  setGeocodeOpen(e.target.value.length >= 2);
                }}
                onFocus={() => geocodeQuery.length >= 2 && setGeocodeOpen(true)}
                onBlur={() => setTimeout(() => setGeocodeOpen(false), 150)}
                className="pl-9"
              />
              {geocodeOpen && geocodeResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border bg-popover shadow-md overflow-hidden">
                  {geocodeResults.map(feature => (
                    <button
                      key={feature.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-start gap-2 transition-colors"
                      onMouseDown={e => { e.preventDefault(); handleGeocodeSelect(feature); }}
                    >
                      <MapPinIcon className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <span className="line-clamp-1">{feature.place_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Map container */}
          <div className="relative rounded-xl overflow-hidden border" style={{ height: MAP_HEIGHT }}>
            {!MAPBOX_TOKEN ? (
              <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
                Set{" "}
                <code className="mx-1 font-mono bg-background px-1 rounded">VITE_MAPBOX_TOKEN</code>
                {" "}(public <code className="font-mono">pk.*</code> token) to enable map
              </div>
            ) : (
              <>
                <Map
                  ref={mapRef}
                  mapboxAccessToken={MAPBOX_TOKEN}
                  initialViewState={{ longitude: lng, latitude: lat, zoom: 14 }}
                  style={{ width: "100%", height: MAP_HEIGHT }}
                  mapStyle={mapStyle}
                  onClick={evt => {
                    setForm(f => ({
                      ...f,
                      lat: evt.lngLat.lat.toFixed(6),
                      lng: evt.lngLat.lng.toFixed(6),
                    }));
                  }}
                >
                  <Marker
                    longitude={lng} latitude={lat}
                    color="var(--primary)"
                    draggable={draggable}
                    onDragEnd={handleMarkerDrag}
                  />
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

                {/* Drag toggle */}
                <button
                  type="button"
                  onClick={() => setDraggable(v => !v)}
                  className={`absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border shadow-sm transition-colors ${
                    draggable
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background/90 backdrop-blur-sm border-border hover:bg-muted"
                  }`}
                >
                  {draggable
                    ? <><UnlockIcon className="size-3.5" /> Drag on</>
                    : <><LockIcon className="size-3.5" /> Enable drag</>}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Sections below (edit mode only) ──────────────────── */}
      {isEdit && (
        <>

          {/* ── Stop Times ───────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ClockIcon className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Stop Times</h3>
              {!isLoading && (
                <Badge variant="secondary" className="text-xs">{stopTimes.length}</Badge>
              )}
              <Button
                variant="outline" size="sm"
                className="ml-auto h-7 text-xs gap-1"
                onClick={() => setAddingStopTime(v => !v)}
              >
                <PlusIcon className="size-3.5" />
                Add
              </Button>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Trip ID</TableHead>
                    <TableHead>Arrival</TableHead>
                    <TableHead>Departure</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <>
                      {stopTimes.length === 0 && !addingStopTime && (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                            No schedule data for this stop
                          </TableCell>
                        </TableRow>
                      )}
                      {stopTimes.map(st => (
                        <TableRow key={st.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{st.stop_sequence}</TableCell>
                          <TableCell className="font-mono text-xs">{st.trip_id}</TableCell>
                          <TableCell className="font-mono text-sm">{st.arrival_time}</TableCell>
                          <TableCell className="font-mono text-sm">{st.departure_time}</TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                      {addingStopTime && (
                        <TableRow className="bg-muted/20">
                          <TableCell className="py-2">
                            <Input
                              type="number" min={0} placeholder="0"
                              value={newSt.stop_sequence}
                              onChange={e => setNewSt(s => ({ ...s, stop_sequence: e.target.value }))}
                              className="h-7 w-16 font-mono text-xs"
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            <Input
                              placeholder="trip_001"
                              value={newSt.trip_id}
                              onChange={e => setNewSt(s => ({ ...s, trip_id: e.target.value }))}
                              className="h-7 font-mono text-xs"
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            <Input
                              placeholder="08:30:00"
                              value={newSt.arrival_time}
                              onChange={e => setNewSt(s => ({ ...s, arrival_time: e.target.value }))}
                              className="h-7 font-mono text-xs w-28"
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            <Input
                              placeholder="08:31:00"
                              value={newSt.departure_time}
                              onChange={e => setNewSt(s => ({ ...s, departure_time: e.target.value }))}
                              className="h-7 font-mono text-xs w-28"
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon" variant="ghost" className="size-7"
                                disabled={
                                  addStopTimeMutation.isPending ||
                                  !newSt.trip_id || !newSt.arrival_time || !newSt.departure_time
                                }
                                onClick={() => addStopTimeMutation.mutate()}
                              >
                                {addStopTimeMutation.isPending
                                  ? <Loader2Icon className="size-3.5 animate-spin" />
                                  : <CheckIcon className="size-3.5 text-emerald-600" />}
                              </Button>
                              <Button
                                size="icon" variant="ghost" className="size-7"
                                onClick={() => {
                                  setAddingStopTime(false);
                                  setNewSt({ trip_id: "", arrival_time: "", departure_time: "", stop_sequence: "" });
                                }}
                              >
                                <XIcon className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── Reviews ──────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquareIcon className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Reviews</h3>
              {!isLoading && reviews.length > 0 && (
                <Badge variant="secondary" className="text-xs">{reviews.length}</Badge>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="rounded-xl border p-4 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <div className="rounded-xl border h-24 flex items-center justify-center text-sm text-muted-foreground">
                No reviews for this stop yet
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map(c => (
                  <div key={c.id} className="rounded-xl border p-4 space-y-3">
                    {/* User + status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-9">
                          {c.user?.avatar && (
                            <AvatarImage src={resolveStorageUrl(c.user.avatar)} alt={c.user.name} />
                          )}
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {c.user?.name?.slice(0, 2).toUpperCase() ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium leading-none">{c.user?.name ?? "Unknown"}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <CalendarIcon className="size-3" />
                            {formatDate(c.created_at)} · {timeAgo(c.created_at)}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${STATUS_COLORS[c.status] ?? ""}`}
                      >
                        {c.status}
                      </Badge>
                    </div>

                    {/* Content */}
                    {c.title && (
                      <p className="text-sm font-semibold">{c.title}</p>
                    )}
                    {c.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {c.description}
                      </p>
                    )}

                    {/* Moderation (pending only) */}
                    {c.status === "pending" && (
                      <div className="flex items-center gap-2 pt-1 border-t">
                        <Button
                          variant="outline" size="sm"
                          className="h-7 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 border-emerald-200 dark:text-emerald-400 dark:hover:bg-emerald-950"
                          disabled={approveMutation.isPending || declineMutation.isPending}
                          onClick={() => approveMutation.mutate(c.id)}
                        >
                          {approveMutation.isPending
                            ? <Loader2Icon className="size-3 animate-spin mr-1" />
                            : <CheckIcon className="size-3 mr-1" />}
                          Approve
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 dark:text-red-400 dark:hover:bg-red-950"
                          disabled={approveMutation.isPending || declineMutation.isPending}
                          onClick={() => { setDeclineTarget(c); setDeclineReason(""); }}
                        >
                          <XIcon className="size-3 mr-1" />
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Photos ───────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Photos</h3>
              {!isLoading && photos.length > 0 && (
                <Badge variant="secondary" className="text-xs">{photos.length}</Badge>
              )}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-video rounded-xl" />
                ))}
              </div>
            ) : photos.length === 0 ? (
              <div className="rounded-xl border h-24 flex items-center justify-center text-sm text-muted-foreground">
                No photos submitted for this stop yet
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {photos.map(c => {
                  const d = c.data as Record<string, unknown> | null;
                  const imageUrl = resolveStorageUrl(
                    (d?.url ?? d?.image_url ?? d?.photo_url ?? d?.photo ?? d?.path ?? d?.file_url) as string | undefined
                  );
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPhotoModal(c)}
                      className="rounded-xl border overflow-hidden group text-left hover:shadow-md transition-shadow focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={c.description ?? "Stop photo"}
                          className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full aspect-video bg-muted flex items-center justify-center">
                          <ImageIcon className="size-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="p-2 space-y-0.5">
                        <p className="text-xs font-medium truncate">{c.user?.name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Photo lightbox ────────────────────────────────────── */}
      <Dialog open={!!photoModal} onOpenChange={() => setPhotoModal(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0">
          {photoModal && (() => {
            const pd = photoModal.data as Record<string, unknown> | null;
            const imageUrl = resolveStorageUrl(
              (pd?.url ?? pd?.image_url ?? pd?.photo_url ?? pd?.photo ?? pd?.path ?? pd?.file_url) as string | undefined
            );
            return (
              <>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={photoModal.description ?? "Stop photo"}
                    className="w-full max-h-[68vh] object-contain bg-black"
                  />
                ) : (
                  <div className="h-60 flex items-center justify-center bg-muted">
                    <ImageIcon className="size-10 text-muted-foreground" />
                  </div>
                )}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8">
                      {photoModal.user?.avatar && (
                        <AvatarImage src={photoModal.user.avatar} alt={photoModal.user.name} />
                      )}
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {photoModal.user?.name?.slice(0, 2).toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none">{photoModal.user?.name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(photoModal.created_at)}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 ${STATUS_COLORS[photoModal.status] ?? ""}`}
                    >
                      {photoModal.status}
                    </Badge>
                  </div>
                  {photoModal.description && (
                    <p className="text-sm text-muted-foreground">{photoModal.description}</p>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Decline reason dialog ─────────────────────────────── */}
      <Dialog
        open={!!declineTarget}
        onOpenChange={() => { setDeclineTarget(null); setDeclineReason(""); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Decline contribution</DialogTitle>
            <DialogDescription>
              Provide a reason — the user will see this when their contribution is declined.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Duplicate entry, inaccurate location…"
            value={declineReason}
            onChange={e => setDeclineReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeclineTarget(null); setDeclineReason(""); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!declineReason.trim() || declineMutation.isPending}
              onClick={() =>
                declineTarget && declineMutation.mutate({ cId: declineTarget.id, reason: declineReason })
              }
            >
              {declineMutation.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
