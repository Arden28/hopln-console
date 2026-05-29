import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Map, { Source, Layer } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  fetchFareZones, createFareZone, deleteFareZone,
  fetchFareAttributes, saveFareAttribute,
  fetchFareRules, saveFareRule,
  previewFare, exportFareFiles,
  fetchRouteFares, saveRouteFare, deleteRouteFare,
  fetchFareModifiers, saveFareModifier, updateFareModifier,
  deleteFareModifier, toggleModifier,
} from "@/api/fares";
import { fetchNetworkAgencies } from "@/api/network";
import { fetchRoutes } from "@/api/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  PlusIcon, Trash2Icon, DownloadIcon, EyeIcon, PencilIcon,
  ZapIcon, CalendarIcon, CloudRainIcon, RouteIcon,
  Maximize2Icon, Minimize2Icon, ChevronsUpDownIcon, TableIcon,
} from "lucide-react";
import type { FareZone, FareAttribute, FareModifier, RouteFare, Route } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const NONE = "__none__";

// ── Confirm Delete Dialog ─────────────────────────────────────────────────────

type ConfirmState = { description: string; onConfirm: () => void } | null;

function ConfirmDialog({ state, onCancel }: { state: ConfirmState; onCancel: () => void }) {
  return (
    <AlertDialog open={!!state} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>{state?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => { state?.onConfirm(); onCancel(); }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const zoneSchema = z.object({
  name: z.string().min(1),
  agency_id: z.string().min(1),
  color: z.string().length(6),
});
type ZoneForm = z.infer<typeof zoneSchema>;

const fareSchema = z.object({
  price: z.coerce.number().min(0),
  currency_type: z.string().default("KES"),
  payment_method: z.coerce.number().int().min(0).max(1) as z.ZodNumber,
  agency_id: z.string().min(1),
});
type FareForm = z.infer<typeof fareSchema>;

const routeFareSchema = z.object({
  route_id: z.string().min(1),
  price: z.coerce.number().min(0),
  currency_type: z.string().default("KES"),
  payment_method: z.coerce.number().int().min(0).max(1) as z.ZodNumber,
  agency_id: z.string().optional(),
});
type RouteFareForm = z.infer<typeof routeFareSchema>;

const modifierSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["weather", "event", "peak_hours", "day_of_week"]),
  applies_to: z.enum(["all", "agency", "route", "zone"]).default("all"),
  applies_to_id: z.string().optional().nullable(),
  multiplier: z.coerce.number().optional().nullable(),
  fixed_surcharge: z.coerce.number().optional().nullable(),
  start_at: z.string().optional().nullable(),
  end_at: z.string().optional().nullable(),
});
type ModifierForm = z.infer<typeof modifierSchema>;

// ── Shared: Route Combobox ────────────────────────────────────────────────────

function RouteCombobox({
  value,
  onSelect,
  placeholder = "Search routes…",
  className,
}: {
  value: string;
  onSelect: (route: Route) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const { data } = useQuery({
    queryKey: ["routes:search", search],
    queryFn: () => fetchRoutes({ search, per_page: 20 }),
    staleTime: 30_000,
    enabled: open,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal h-9 px-3", className)}
        >
          {value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDownIcon size={13} className="ml-2 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Type route name or number…"
          />
          <CommandList>
            <CommandEmpty>No routes found.</CommandEmpty>
            <CommandGroup>
              {data?.data.map((route) => (
                <CommandItem
                  key={route.route_id}
                  value={route.route_id}
                  onSelect={() => { onSelect(route); setOpen(false); setSearch(""); }}
                >
                  <span className="font-medium shrink-0">{route.route_short_name}</span>
                  {route.route_long_name && (
                    <span className="ml-2 text-muted-foreground text-xs truncate">{route.route_long_name}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Modifier helpers ──────────────────────────────────────────────────────────

function ModifierTypeIcon({ type }: { type: string }) {
  if (type === "weather")    return <CloudRainIcon size={13} className="text-blue-500" />;
  if (type === "event")      return <CalendarIcon  size={13} className="text-purple-500" />;
  if (type === "peak_hours") return <ZapIcon       size={13} className="text-orange-500" />;
  return                            <RouteIcon     size={13} className="text-green-500" />;
}

function modifierEffect(mod: FareModifier): string {
  const parts: string[] = [];
  if (mod.multiplier != null && mod.multiplier !== 1)
    parts.push(`×${mod.multiplier}`);
  if (mod.fixed_surcharge != null && mod.fixed_surcharge !== 0)
    parts.push(`${mod.fixed_surcharge > 0 ? "+" : ""}KES ${mod.fixed_surcharge}`);
  return parts.length ? parts.join(" ") : "—";
}

// ── Zone Fares Tab ────────────────────────────────────────────────────────────

function ZoneFaresTab() {
  const mapRef          = React.useRef<MapRef>(null);
  const drawRef         = React.useRef<MapboxDraw | null>(null);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { mapRef.current?.getMap().resize(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [selectedZone,   setSelectedZone]   = React.useState<FareZone | null>(null);
  const [zoneDialog,     setZoneDialog]     = React.useState(false);
  const [fareDialog,     setFareDialog]     = React.useState<{ originId: string; destId: string } | null>(null);
  const [pendingGeojson, setPendingGeojson] = React.useState<object | null>(null);
  const [fullscreen,     setFullscreen]     = React.useState(false);
  const [showMatrix,     setShowMatrix]     = React.useState(true);
  const [confirmDelete,  setConfirmDelete]  = React.useState<ConfirmState>(null);
  const qc = useQueryClient();

  const { data: zones = [], isLoading: zonesLoading } = useQuery({ queryKey: ["fares:zones"],      queryFn: fetchFareZones,      staleTime: 60_000 });
  const { data: attrs = [] }                           = useQuery({ queryKey: ["fares:attributes"], queryFn: fetchFareAttributes, staleTime: 60_000, placeholderData: (p: FareAttribute[] | undefined) => p });
  const { data: rules = [] }                           = useQuery({ queryKey: ["fares:rules"],      queryFn: fetchFareRules,      staleTime: 60_000, placeholderData: (p) => p });
  const { data: agencies = [] }                        = useQuery({ queryKey: ["network:agencies"], queryFn: fetchNetworkAgencies, staleTime: 300_000 });

  const zoneForm = useForm<ZoneForm>({ resolver: zodResolver(zoneSchema) as Resolver<ZoneForm>, defaultValues: { color: "FF6F00" } });
  const fareForm = useForm<FareForm>({ resolver: zodResolver(fareSchema) as Resolver<FareForm>, defaultValues: { currency_type: "KES", payment_method: 0 } });

  const createZoneMutation = useMutation({
    mutationFn: (d: ZoneForm & { geojson: object }) => createFareZone(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fares:zones"] }); setZoneDialog(false); setPendingGeojson(null); zoneForm.reset({ color: "FF6F00" }); },
  });
  const deleteZoneMutation = useMutation({
    mutationFn: (id: number) => deleteFareZone(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fares:zones"] }); setSelectedZone(null); },
  });
  const saveFareMutation = useMutation({
    mutationFn: async (d: FareForm) => {
      if (!fareDialog) return;
      const fareId = `FARE_${fareDialog.originId}_${fareDialog.destId}`;
      const attr   = await saveFareAttribute({ ...d, fare_id: fareId, payment_method: d.payment_method as 0 | 1 });
      await saveFareRule({ fare_id: attr.fare_id, origin_id: fareDialog.originId, destination_id: fareDialog.destId });
      return attr;
    },
    onSuccess: (attr) => {
      // Optimistic-style immediate cache patch so the cell updates without a refetch flash
      if (attr && fareDialog) {
        qc.setQueryData<FareAttribute[]>(["fares:attributes"], (old = []) => {
          const existing = old.find((a) => a.fare_id === attr.fare_id);
          return existing
            ? old.map((a) => a.fare_id === attr.fare_id ? { ...a, ...attr } : a)
            : [...old, attr];
        });
      }
      qc.invalidateQueries({ queryKey: ["fares:attributes"] });
      qc.invalidateQueries({ queryKey: ["fares:rules"] });
      setFareDialog(null);
    },
  });

  // Pre-populate fare form whenever a cell is opened
  React.useEffect(() => {
    if (!fareDialog) return;
    const rule = rules.find(
      (r) =>
        (r.origin_id === fareDialog.originId && r.destination_id === fareDialog.destId) ||
        (r.origin_id === fareDialog.destId    && r.destination_id === fareDialog.originId),
    );
    const existing = rule ? (attrs.find((a) => a.fare_id === rule.fare_id) ?? null) : null;
    fareForm.reset(
      existing
        ? { price: existing.price, currency_type: existing.currency_type, payment_method: existing.payment_method as 0 | 1, agency_id: existing.agency_id }
        : { price: undefined as unknown as number, currency_type: "KES", payment_method: 0, agency_id: "" },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fareDialog]);

  const handleMapLoad = React.useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const draw = new MapboxDraw({ displayControlsDefault: false, controls: { polygon: true, trash: true } });
    drawRef.current = draw;
    map.addControl(draw);
    map.on("draw.create", (e: { features: GeoJSON.Feature[] }) => {
      const geom = e.features[0]?.geometry;
      if (geom) { setPendingGeojson(geom); setZoneDialog(true); draw.deleteAll(); }
    });
  }, []);

  const zonesGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: zones.filter((z) => z.geojson).map((z) => ({
      type: "Feature" as const,
      geometry: z.geojson!,
      properties: { zone_id: z.zone_id, name: z.name, color: `#${z.color}` },
    })),
  };

  function getCellFare(aId: string, bId: string): FareAttribute | null {
    const rule = rules.find(
      (r) => (r.origin_id === aId && r.destination_id === bId) ||
             (r.origin_id === bId && r.destination_id === aId),
    );
    return rule ? (attrs.find((a: FareAttribute) => a.fare_id === rule.fare_id) ?? null) : null;
  }

  // Color-code cells relative to the cheapest/most expensive fare in the matrix
  const allPrices = attrs.map((a) => a.price).filter((p) => p > 0);
  const minPrice  = allPrices.length ? Math.min(...allPrices) : 0;
  const maxPrice  = allPrices.length ? Math.max(...allPrices) : 0;

  function cellColor(fare: FareAttribute | null): string {
    if (!fare || maxPrice === minPrice) return "";
    const ratio = (fare.price - minPrice) / (maxPrice - minPrice);
    if (ratio < 0.33) return "bg-emerald-50 dark:bg-emerald-950/20";
    if (ratio < 0.67) return "bg-amber-50 dark:bg-amber-950/20";
    return "bg-rose-50 dark:bg-rose-950/20";
  }
  function cellText(fare: FareAttribute | null): string {
    if (!fare || maxPrice === minPrice) return "";
    const ratio = (fare.price - minPrice) / (maxPrice - minPrice);
    if (ratio < 0.33) return "text-emerald-700 dark:text-emerald-400";
    if (ratio < 0.67) return "text-amber-700 dark:text-amber-400";
    return "text-rose-700 dark:text-rose-400";
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 shrink-0 border-r bg-background flex flex-col overflow-hidden">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="font-medium text-sm">Fare Zones</span>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={() => drawRef.current?.changeMode("draw_polygon")}>
              <PlusIcon size={12} /> New Zone
            </Button>
          </div>

          {zonesLoading ? (
            <div className="p-3 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y">
              {zones.map((z) => (
                <div
                  key={z.id}
                  className={cn("flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted text-sm",
                    selectedZone?.id === z.id && "bg-muted")}
                  onClick={() => setSelectedZone(selectedZone?.id === z.id ? null : z)}
                >
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: `#${z.color}` }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{z.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{z.zone_id}</div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete({ description: `Delete zone "${z.name}"? Any fare rules using this zone will also be removed.`, onConfirm: () => deleteZoneMutation.mutate(z.id) }); }}>
                    <Trash2Icon size={12} />
                  </Button>
                </div>
              ))}
              {zones.length === 0 && (
                <p className="text-xs text-muted-foreground p-3 leading-relaxed">
                  Draw a polygon on the map to create a fare zone.
                </p>
              )}
            </div>
          )}

          {zones.length >= 2 && (
            <div className="border-t p-2">
              <Button
                size="sm"
                variant={showMatrix ? "secondary" : "ghost"}
                className="w-full h-7 text-xs gap-1.5 justify-start"
                onClick={() => setShowMatrix((v) => !v)}
              >
                <TableIcon size={12} />
                {showMatrix ? "Hide" : "Show"} Fare Matrix
              </Button>
            </div>
          )}
        </div>

        {/* Map — fullscreen only expands this div */}
        <div
          ref={mapContainerRef}
          className={cn("relative", fullscreen ? "fixed inset-0 z-50" : "flex-1")}
        >
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{ latitude: -1.2921, longitude: 36.8219, zoom: 11 }}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/light-v11"
            onLoad={handleMapLoad}
          >
            <Source id="fare-zones" type="geojson" data={zonesGeoJSON}>
              <Layer id="fare-zones-fill" type="fill" paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.25 }} />
              <Layer id="fare-zones-line" type="line" paint={{ "line-color": ["get", "color"], "line-width": 2 }} />
            </Source>
          </Map>

          <button
            className="absolute top-2 right-2 z-10 bg-white dark:bg-zinc-800 rounded-md p-1.5 shadow-md border hover:bg-muted transition-colors"
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2Icon size={15} /> : <Maximize2Icon size={15} />}
          </button>
        </div>
      </div>

      {/* Fare Matrix */}
      {showMatrix && zones.length >= 2 && (
        <div className="border-t bg-background shrink-0 overflow-hidden" style={{ maxHeight: "280px" }}>
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <span className="text-sm font-medium">Fare Matrix</span>
            <span className="text-xs text-muted-foreground">— click a cell to set a fare</span>
            {allPrices.length > 1 && (
              <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded bg-emerald-200 dark:bg-emerald-800" /> low</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded bg-amber-200 dark:bg-amber-800" /> mid</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded bg-rose-200 dark:bg-rose-800" /> high</span>
              </div>
            )}
          </div>
          <div className="overflow-auto px-4 pb-4">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="w-28 border-b border-r" />
                  {zones.map((z) => (
                    <th key={z.id} className="px-3 py-1.5 text-center font-medium border-b border-r bg-muted/40 min-w-[96px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: `#${z.color}` }} />
                        <span className="truncate max-w-[72px]">{z.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zones.map((rowZone) => (
                  <tr key={rowZone.id}>
                    <td className="px-3 py-2 font-medium border-b border-r bg-muted/40">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: `#${rowZone.color}` }} />
                        <span className="truncate max-w-[80px]">{rowZone.name}</span>
                      </div>
                    </td>
                    {zones.map((colZone) => {
                      if (rowZone.id === colZone.id) {
                        return (
                          <td key={colZone.id} className="border-b border-r text-center bg-muted/10 text-muted-foreground/30 select-none">
                            ╲
                          </td>
                        );
                      }
                      const fare = getCellFare(rowZone.zone_id, colZone.zone_id);
                      return (
                        <td
                          key={colZone.id}
                          className={cn(
                            "border-b border-r text-center cursor-pointer px-3 py-2 min-w-[96px] transition-all hover:ring-1 hover:ring-inset hover:ring-primary/60",
                            cellColor(fare),
                          )}
                          onClick={() => setFareDialog({ originId: rowZone.zone_id, destId: colZone.zone_id })}
                        >
                          {fare ? (
                            <div>
                              <span className={cn("font-semibold tabular-nums", cellText(fare))}>
                                {fare.price}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-0.5">{fare.currency_type}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50 border border-dashed border-muted-foreground/30 rounded px-1.5 py-0.5">
                              + set
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Zone Dialog */}
      <Dialog open={zoneDialog} onOpenChange={setZoneDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Fare Zone</DialogTitle></DialogHeader>
          <form onSubmit={zoneForm.handleSubmit((d) => { if (!pendingGeojson) return; createZoneMutation.mutate({ ...d, geojson: pendingGeojson }); })} className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input {...zoneForm.register("name")} placeholder="Zone A — CBD" />
            </div>
            <div className="space-y-1">
              <Label>Agency</Label>
              <Select onValueChange={(v) => zoneForm.setValue("agency_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select agency" /></SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => <SelectItem key={a.agency_id} value={a.agency_id}>{a.agency_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Color (hex, no #)</Label>
              <Input {...zoneForm.register("color")} placeholder="FF6F00" maxLength={6} />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setZoneDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createZoneMutation.isPending}>Save Zone</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog state={confirmDelete} onCancel={() => setConfirmDelete(null)} />

      {/* Set Fare Dialog */}
      <Dialog open={!!fareDialog} onOpenChange={(o) => !o && setFareDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Fare</DialogTitle>
            {fareDialog && (
              <p className="text-xs text-muted-foreground mt-1">
                {zones.find((z) => z.zone_id === fareDialog.originId)?.name ?? fareDialog.originId}
                {" → "}
                {zones.find((z) => z.zone_id === fareDialog.destId)?.name ?? fareDialog.destId}
                <span className="ml-1 text-muted-foreground/60">(bidirectional)</span>
              </p>
            )}
          </DialogHeader>
          <form onSubmit={fareForm.handleSubmit((d) => saveFareMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Price</Label>
                <Input type="number" step="0.01" {...fareForm.register("price")} placeholder="30" />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Input {...fareForm.register("currency_type")} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Payment Method</Label>
              <Select
                value={String(fareForm.watch("payment_method") ?? 0)}
                onValueChange={(v) => fareForm.setValue("payment_method", Number(v) as 0 | 1)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">On board</SelectItem>
                  <SelectItem value="1">Before boarding</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Agency</Label>
              <Select
                value={fareForm.watch("agency_id") || NONE}
                onValueChange={(v) => fareForm.setValue("agency_id", v === NONE ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Select agency" /></SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => <SelectItem key={a.agency_id} value={a.agency_id}>{a.agency_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setFareDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={saveFareMutation.isPending}>Save Fare</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Route Fares Tab ───────────────────────────────────────────────────────────

function RouteFaresTab() {
  const [dialog,        setDialog]        = React.useState(false);
  const [selectedRoute, setSelectedRoute] = React.useState<Route | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<ConfirmState>(null);
  const qc = useQueryClient();

  const { data: routeFares = [], isLoading } = useQuery({ queryKey: ["fares:route-fares"], queryFn: fetchRouteFares, staleTime: 60_000 });
  const { data: agencies = [] }              = useQuery({ queryKey: ["network:agencies"],   queryFn: fetchNetworkAgencies, staleTime: 300_000 });

  const form = useForm<RouteFareForm>({
    resolver: zodResolver(routeFareSchema) as Resolver<RouteFareForm>,
    defaultValues: { currency_type: "KES", payment_method: 0 },
  });

  const createMutation = useMutation({
    mutationFn: (d: RouteFareForm) => saveRouteFare({ ...d, payment_method: d.payment_method as 0 | 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fares:route-fares"] });
      setDialog(false);
      setSelectedRoute(null);
      form.reset({ currency_type: "KES", payment_method: 0 });
      toast("Route fare saved");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRouteFare(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fares:route-fares"] }); toast("Route fare deleted"); },
  });

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Route-Based Fares</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Flat fares applied to all trips on a route, regardless of origin/destination zones.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialog(true)}>
          <PlusIcon size={14} /> New Route Fare
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : routeFares.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No route-based fares yet. Create one to assign a flat price to a route.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2 text-left font-medium text-xs">Route</th>
                <th className="px-4 py-2 text-left font-medium text-xs">Fare ID</th>
                <th className="px-4 py-2 text-left font-medium text-xs">Price</th>
                <th className="px-4 py-2 text-left font-medium text-xs">Currency</th>
                <th className="px-4 py-2 text-right font-medium text-xs" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {routeFares.map((rf: RouteFare) => (
                <tr key={rf.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{rf.route?.route_short_name ?? rf.route_id}</div>
                    {rf.route?.route_long_name && <div className="text-xs text-muted-foreground">{rf.route.route_long_name}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{rf.fare_id}</td>
                  <td className="px-4 py-3 tabular-nums font-medium">{rf.price}</td>
                  <td className="px-4 py-3">{rf.currency_type}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDelete({ description: `Remove the ${rf.currency_type} ${rf.price} fare for route ${rf.route?.route_short_name ?? rf.route_id}?`, onConfirm: () => deleteMutation.mutate(rf.id) })}>
                      <Trash2Icon size={13} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog state={confirmDelete} onCancel={() => setConfirmDelete(null)} />

      <Dialog open={dialog} onOpenChange={(o) => { setDialog(o); if (!o) { setSelectedRoute(null); form.reset({ currency_type: "KES", payment_method: 0 }); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Route Fare</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label>Route</Label>
              <RouteCombobox
                value={selectedRoute ? `${selectedRoute.route_short_name}${selectedRoute.route_long_name ? ` — ${selectedRoute.route_long_name}` : ""}` : ""}
                onSelect={(route) => { setSelectedRoute(route); form.setValue("route_id", route.route_id, { shouldValidate: true }); }}
                placeholder="Search and select a route…"
              />
              {form.formState.errors.route_id && (
                <p className="text-xs text-destructive">{form.formState.errors.route_id.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Price</Label>
                <Input type="number" step="0.01" {...form.register("price")} placeholder="50" />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Input {...form.register("currency_type")} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Payment Method</Label>
              <Select onValueChange={(v) => form.setValue("payment_method", Number(v) as 0 | 1)} defaultValue="0">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">On board</SelectItem>
                  <SelectItem value="1">Before boarding</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Agency <span className="text-muted-foreground">(optional)</span></Label>
              <Select onValueChange={(v) => form.setValue("agency_id", v)}>
                <SelectTrigger><SelectValue placeholder="Any agency" /></SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => <SelectItem key={a.agency_id} value={a.agency_id}>{a.agency_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Modifiers Tab ─────────────────────────────────────────────────────────────

function ModifiersTab() {
  const [dialog,        setDialog]        = React.useState<FareModifier | "new" | null>(null);
  const [selectedRoute, setSelectedRoute] = React.useState<Route | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<ConfirmState>(null);
  const qc = useQueryClient();

  const { data: modifiers = [], isLoading } = useQuery({ queryKey: ["fares:modifiers"],   queryFn: fetchFareModifiers,  staleTime: 30_000 });
  const { data: agencies = [] }             = useQuery({ queryKey: ["network:agencies"],   queryFn: fetchNetworkAgencies, staleTime: 300_000 });
  const { data: zones = [] }                = useQuery({ queryKey: ["fares:zones"],        queryFn: fetchFareZones,      staleTime: 60_000 });

  const form = useForm<ModifierForm>({
    resolver: zodResolver(modifierSchema) as Resolver<ModifierForm>,
    defaultValues: { applies_to: "all", type: "weather" },
  });

  React.useEffect(() => {
    if (!dialog) return;
    if (dialog === "new") {
      form.reset({ applies_to: "all", type: "weather" });
      setSelectedRoute(null);
    } else {
      form.reset({
        name: dialog.name, type: dialog.type, applies_to: dialog.applies_to,
        applies_to_id: dialog.applies_to_id, multiplier: dialog.multiplier,
        fixed_surcharge: dialog.fixed_surcharge,
        start_at: dialog.start_at ?? undefined, end_at: dialog.end_at ?? undefined,
      });
      setSelectedRoute(null);
    }
  }, [dialog, form]);

  const saveMutation = useMutation({
    mutationFn: (d: ModifierForm) =>
      dialog && dialog !== "new" ? updateFareModifier(dialog.id, d) : saveFareModifier(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fares:modifiers"] });
      toast(dialog === "new" ? "Modifier created" : "Modifier updated");
      setDialog(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFareModifier(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fares:modifiers"] }); toast("Modifier deleted"); },
  });
  const toggleMutation = useMutation({
    mutationFn: (id: number) => toggleModifier(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["fares:modifiers"] });
      const prev = qc.getQueryData<FareModifier[]>(["fares:modifiers"]);
      qc.setQueryData<FareModifier[]>(["fares:modifiers"], (old) =>
        old?.map((m) => m.id === id ? { ...m, is_active: !m.is_active } : m),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(["fares:modifiers"], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["fares:modifiers"] }),
  });

  const appliesTo = form.watch("applies_to");

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Dynamic Fare Modifiers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Surcharges and discounts on top of base fares. Not exported to GTFS.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialog("new")}>
          <PlusIcon size={14} /> New Modifier
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : modifiers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No modifiers yet. Create one to handle rain surcharges, event pricing, peak hours, etc.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2 text-left font-medium text-xs">Name</th>
                <th className="px-4 py-2 text-left font-medium text-xs">Type</th>
                <th className="px-4 py-2 text-left font-medium text-xs">Applies to</th>
                <th className="px-4 py-2 text-left font-medium text-xs">Effect</th>
                <th className="px-4 py-2 text-left font-medium text-xs">Window</th>
                <th className="px-4 py-2 text-center font-medium text-xs">Active</th>
                <th className="px-4 py-2 text-right font-medium text-xs" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {modifiers.map((mod: FareModifier) => (
                <tr key={mod.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{mod.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <ModifierTypeIcon type={mod.type} />
                      <span className="text-xs capitalize">{mod.type.replace(/_/g, " ")}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {mod.applies_to === "all" ? "All fares" : `${mod.applies_to}: ${mod.applies_to_id ?? "—"}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "text-xs font-mono px-1.5 py-0.5 rounded",
                      mod.multiplier && mod.multiplier > 1
                        ? "bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400"
                        : "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400",
                    )}>
                      {modifierEffect(mod)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {mod.start_at || mod.end_at ? (
                      <>{mod.start_at ? new Date(mod.start_at).toLocaleDateString() : "∞"}{" → "}{mod.end_at ? new Date(mod.end_at).toLocaleDateString() : "∞"}</>
                    ) : "Always"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch checked={mod.is_active} onCheckedChange={() => toggleMutation.mutate(mod.id)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setDialog(mod)}>
                        <PencilIcon size={13} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDelete({ description: `Delete modifier "${mod.name}"? This cannot be undone.`, onConfirm: () => deleteMutation.mutate(mod.id) })}>
                        <Trash2Icon size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog state={confirmDelete} onCancel={() => setConfirmDelete(null)} />

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === "new" ? "New Modifier" : "Edit Modifier"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input {...form.register("name")} placeholder="Heavy Rain Surcharge" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.watch("type")} onValueChange={(v) => form.setValue("type", v as ModifierForm["type"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weather">Weather</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="peak_hours">Peak Hours</SelectItem>
                    <SelectItem value="day_of_week">Day of Week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Applies To</Label>
                <Select
                  value={form.watch("applies_to")}
                  onValueChange={(v) => { form.setValue("applies_to", v as ModifierForm["applies_to"]); form.setValue("applies_to_id", null); setSelectedRoute(null); }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All fares</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                    <SelectItem value="route">Route</SelectItem>
                    <SelectItem value="zone">Zone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {appliesTo === "route" && (
              <div className="space-y-1">
                <Label>Route</Label>
                <RouteCombobox
                  value={
                    selectedRoute
                      ? `${selectedRoute.route_short_name}${selectedRoute.route_long_name ? ` — ${selectedRoute.route_long_name}` : ""}`
                      : form.watch("applies_to_id") ?? ""
                  }
                  onSelect={(route) => { setSelectedRoute(route); form.setValue("applies_to_id", route.route_id); }}
                  placeholder="Search and select a route…"
                />
              </div>
            )}

            {appliesTo === "agency" && (
              <div className="space-y-1">
                <Label>Agency</Label>
                <Select
                  value={form.watch("applies_to_id") ?? NONE}
                  onValueChange={(v) => form.setValue("applies_to_id", v === NONE ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select agency" /></SelectTrigger>
                  <SelectContent>
                    {agencies.map((a) => <SelectItem key={a.agency_id} value={a.agency_id}>{a.agency_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {appliesTo === "zone" && (
              <div className="space-y-1">
                <Label>Zone</Label>
                <Select
                  value={form.watch("applies_to_id") ?? NONE}
                  onValueChange={(v) => form.setValue("applies_to_id", v === NONE ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                  <SelectContent>
                    {zones.map((z) => (
                      <SelectItem key={z.zone_id} value={z.zone_id}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: `#${z.color}` }} />
                          {z.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Multiplier</Label>
                <Input type="number" step="0.01" {...form.register("multiplier")} placeholder="1.50 = +50%" />
              </div>
              <div className="space-y-1">
                <Label>Fixed Surcharge (KES)</Label>
                <Input type="number" step="0.01" {...form.register("fixed_surcharge")} placeholder="20.00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start <span className="text-muted-foreground">(optional)</span></Label>
                <Input type="datetime-local" {...form.register("start_at")} />
              </div>
              <div className="space-y-1">
                <Label>End <span className="text-muted-foreground">(optional)</span></Label>
                <Input type="datetime-local" {...form.register("end_at")} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{dialog === "new" ? "Create" : "Update"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Preview Tab ───────────────────────────────────────────────────────────────

function PreviewTab() {
  const [originZone,    setOriginZone]    = React.useState(NONE);
  const [destZone,      setDestZone]      = React.useState(NONE);
  const [selectedRoute, setSelectedRoute] = React.useState<Route | null>(null);
  const [result,        setResult]        = React.useState<Awaited<ReturnType<typeof previewFare>> | null>(null);
  const [loading,       setLoading]       = React.useState(false);

  const { data: zones = [] } = useQuery({ queryKey: ["fares:zones"], queryFn: fetchFareZones, staleTime: 60_000 });

  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await previewFare({
        origin_zone_id:      originZone !== NONE ? originZone : undefined,
        destination_zone_id: destZone   !== NONE ? destZone   : undefined,
        route_id:            selectedRoute?.route_id,
      });
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <div>
        <h2 className="text-sm font-semibold">Fare Preview</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Resolve the effective fare including active modifier surcharges.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Origin Zone</Label>
          <Select value={originZone} onValueChange={setOriginZone}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Any zone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Any zone</SelectItem>
              {zones.map((z) => <SelectItem key={z.zone_id} value={z.zone_id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Destination Zone</Label>
          <Select value={destZone} onValueChange={setDestZone}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Any zone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Any zone</SelectItem>
              {zones.map((z) => <SelectItem key={z.zone_id} value={z.zone_id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Route <span className="text-muted-foreground">(optional)</span></Label>
          <RouteCombobox
            value={selectedRoute ? selectedRoute.route_short_name : ""}
            onSelect={setSelectedRoute}
            placeholder="Any route"
            className="h-9 text-sm"
          />
        </div>
      </div>

      <Button onClick={handlePreview} disabled={loading} className="w-fit gap-1.5">
        <EyeIcon size={14} />
        {loading ? "Resolving…" : "Preview Fare"}
      </Button>

      {result && (
        <div className="rounded-lg border p-4 space-y-4">
          {!result.found ? (
            <p className="text-sm text-muted-foreground">No fare rule matched for this combination.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground">Resolved via</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {result.resolved_via?.replace(/_/g, " ")}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">{result.fare_id}</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Base fare</span>
                  <span className="tabular-nums font-medium">{result.currency_type} {result.base_price ?? result.price}</span>
                </div>

                {result.modifiers_applied && result.modifiers_applied.length > 0 && (
                  <div className="border-t pt-1.5 space-y-1">
                    {result.modifiers_applied.map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <ModifierTypeIcon type={m.type} />
                          {m.name}
                        </div>
                        <span className="tabular-nums text-orange-600 dark:text-orange-400">
                          {[
                            m.multiplier != null && m.multiplier !== 1 ? `×${m.multiplier}` : null,
                            m.fixed_surcharge != null && m.fixed_surcharge !== 0 ? `+KES ${m.fixed_surcharge}` : null,
                          ].filter(Boolean).join(" ")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between border-t pt-1.5">
                  <span className="text-sm font-semibold">Effective fare</span>
                  <span className="text-base font-bold tabular-nums text-primary">
                    {result.currency_type} {result.effective_price ?? result.price}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Export Tab ────────────────────────────────────────────────────────────────

function ExportTab() {
  const [exporting, setExporting] = React.useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportFareFiles();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = "fare_gtfs.zip"; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6 max-w-lg">
      <div>
        <h2 className="text-sm font-semibold">Export GTFS Fare Files</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Downloads a zip with <code className="text-xs">fare_attributes.txt</code> and{" "}
          <code className="text-xs">fare_rules.txt</code>. Base fares only — dynamic modifiers are not exported to GTFS.
        </p>
      </div>
      <div className="rounded-lg border p-4 space-y-2 bg-muted/20 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-mono bg-muted px-1.5 py-0.5 rounded">fare_attributes.txt</span>
          <span>Fare IDs, prices, currency, payment method, transfers</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono bg-muted px-1.5 py-0.5 rounded">fare_rules.txt</span>
          <span>Zone-to-zone and route-based fare rule mappings</span>
        </div>
      </div>
      <Button onClick={handleExport} disabled={exporting} className="w-fit gap-1.5">
        <DownloadIcon size={14} />
        {exporting ? "Exporting…" : "Export Fare Files (.zip)"}
      </Button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FareManagerPage() {
  return (
    <Tabs defaultValue="zones" className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="border-b px-4 shrink-0">
        <TabsList className="h-10 bg-transparent border-none gap-0 p-0 rounded-none">
          {[
            { value: "zones",     label: "Zone Fares" },
            { value: "routes",    label: "Route Fares" },
            { value: "modifiers", label: "Modifiers" },
            { value: "preview",   label: "Preview" },
            { value: "export",    label: "Export" },
          ].map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 text-sm"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="zones"     className="flex-1 overflow-hidden mt-0 flex flex-col"><ZoneFaresTab /></TabsContent>
      <TabsContent value="routes"    className="flex-1 overflow-y-auto mt-0"><RouteFaresTab /></TabsContent>
      <TabsContent value="modifiers" className="flex-1 overflow-y-auto mt-0"><ModifiersTab /></TabsContent>
      <TabsContent value="preview"   className="flex-1 overflow-y-auto mt-0"><PreviewTab /></TabsContent>
      <TabsContent value="export"    className="flex-1 overflow-y-auto mt-0"><ExportTab /></TabsContent>
    </Tabs>
  );
}
