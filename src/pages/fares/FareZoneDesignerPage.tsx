import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Map, { Source, Layer } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  fetchFareZones, createFareZone, updateFareZone, deleteFareZone,
  fetchFareAttributes, saveFareAttribute, deleteFareAttribute,
  fetchFareRules, saveFareRule, previewFare, exportFareFiles,
} from "@/api/fares";
import { fetchNetworkAgencies } from "@/api/network";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusIcon, Trash2Icon, DownloadIcon, EyeIcon } from "lucide-react";
import type { FareZone, FareAttribute } from "@/types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

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

export default function FareZoneDesignerPage() {
  const mapRef = React.useRef<MapRef>(null);
  const drawRef = React.useRef<MapboxDraw | null>(null);
  const [selectedZone, setSelectedZone] = React.useState<FareZone | null>(null);
  const [drawMode, setDrawMode] = React.useState(false);
  const [zoneDialog, setZoneDialog] = React.useState(false);
  const [fareDialog, setFareDialog] = React.useState<{ originId: string; destId: string } | null>(null);
  const [previewOrigin, setPreviewOrigin] = React.useState("");
  const [previewDest, setPreviewDest] = React.useState("");
  const [previewResult, setPreviewResult] = React.useState<string | null>(null);
  const [pendingGeojson, setPendingGeojson] = React.useState<object | null>(null);
  const qc = useQueryClient();

  const { data: zones = [], isLoading: zonesLoading } = useQuery({
    queryKey: ["fares:zones"],
    queryFn: fetchFareZones,
    staleTime: 60_000,
  });
  const { data: attrs = [] } = useQuery({
    queryKey: ["fares:attributes"],
    queryFn: fetchFareAttributes,
    staleTime: 60_000,
  });
  const { data: rules = [] } = useQuery({
    queryKey: ["fares:rules"],
    queryFn: fetchFareRules,
    staleTime: 60_000,
  });
  const { data: agencies = [] } = useQuery({
    queryKey: ["network:agencies"],
    queryFn: fetchNetworkAgencies,
    staleTime: 300_000,
  });

  const zoneForm = useForm<ZoneForm>({ resolver: zodResolver(zoneSchema), defaultValues: { color: "FF6F00" } });
  const fareForm = useForm<FareForm>({ resolver: zodResolver(fareSchema), defaultValues: { currency_type: "KES", payment_method: 0 } });

  const createZoneMutation = useMutation({
    mutationFn: (d: ZoneForm & { geojson: object }) => createFareZone(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fares:zones"] }); setZoneDialog(false); setPendingGeojson(null); },
  });

  const deleteZoneMutation = useMutation({
    mutationFn: (id: number) => deleteFareZone(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fares:zones"] }); setSelectedZone(null); },
  });

  const saveFareMutation = useMutation({
    mutationFn: async (d: FareForm) => {
      if (!fareDialog) return;
      const fareId = `FARE_${fareDialog.originId}_${fareDialog.destId}`;
      const attr = await saveFareAttribute({ ...d, fare_id: fareId, payment_method: d.payment_method as 0 | 1 });
      await saveFareRule({ fare_id: attr.fare_id, origin_id: fareDialog.originId, destination_id: fareDialog.destId });
      return attr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fares:attributes"] });
      qc.invalidateQueries({ queryKey: ["fares:rules"] });
      setFareDialog(null);
    },
  });

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

  const onZoneSubmit = zoneForm.handleSubmit((d) => {
    if (!pendingGeojson) return;
    createZoneMutation.mutate({ ...d, geojson: pendingGeojson });
  });

  const handlePreview = async () => {
    if (!previewOrigin || !previewDest) return;
    const res = await previewFare(previewOrigin, previewDest);
    setPreviewResult(res.found ? `${res.currency_type} ${res.price}` : "No fare found");
  };

  const handleExport = async () => {
    const blob = await exportFareFiles();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "fare_gtfs.zip"; a.click();
    URL.revokeObjectURL(url);
  };

  const zonesGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: zones
      .filter((z) => z.geojson)
      .map((z) => ({
        type: "Feature" as const,
        geometry: z.geojson!,
        properties: { zone_id: z.zone_id, name: z.name, color: `#${z.color}` },
      })),
  };

  function getCellFare(aId: string, bId: string) {
    const rule = rules.find(
      (r) => (r.origin_id === aId && r.destination_id === bId) ||
             (r.origin_id === bId && r.destination_id === aId)
    );
    if (!rule) return null;
    return attrs.find((a: FareAttribute) => a.fare_id === rule.fare_id) ?? null;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Zone list */}
        <div className="w-72 shrink-0 border-r bg-background flex flex-col overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <span className="font-medium text-sm">Fare Zones</span>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={() => { drawRef.current?.changeMode("draw_polygon"); setDrawMode(true); }}>
              <PlusIcon size={12} /> New Zone
            </Button>
          </div>
          {zonesLoading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y">
              {zones.map((z) => (
                <div
                  key={z.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted ${selectedZone?.id === z.id ? "bg-muted" : ""}`}
                  onClick={() => setSelectedZone(selectedZone?.id === z.id ? null : z)}
                >
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: `#${z.color}` }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{z.name}</div>
                    <div className="text-xs text-muted-foreground">{z.zone_id}</div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteZoneMutation.mutate(z.id); }}>
                    <Trash2Icon size={12} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1">
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{ latitude: -1.2921, longitude: 36.8219, zoom: 11 }}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/light-v11"
            onLoad={handleMapLoad}
          >
            <Source id="fare-zones" type="geojson" data={zonesGeoJSON}>
              <Layer
                id="fare-zones-fill"
                type="fill"
                paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.25 }}
              />
              <Layer
                id="fare-zones-line"
                type="line"
                paint={{ "line-color": ["get", "color"], "line-width": 2 }}
              />
            </Source>
          </Map>
        </div>
      </div>

      {/* Fare Matrix */}
      {zones.length >= 2 && (
        <div className="border-t p-4 bg-background overflow-x-auto">
          <div className="text-sm font-medium mb-3">Fare Matrix</div>
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="w-24" />
                {zones.map((z) => (
                  <th key={z.id} className="px-2 py-1 text-center font-medium border bg-muted/30 min-w-[80px]">
                    {z.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.map((rowZone) => (
                <tr key={rowZone.id}>
                  <td className="px-2 py-1 font-medium border bg-muted/30">{rowZone.name}</td>
                  {zones.map((colZone) => {
                    if (rowZone.id === colZone.id) {
                      return <td key={colZone.id} className="border text-center bg-muted/10">—</td>;
                    }
                    const fare = getCellFare(rowZone.zone_id, colZone.zone_id);
                    return (
                      <td
                        key={colZone.id}
                        className="border text-center cursor-pointer hover:bg-muted/40 px-2 py-1 min-w-[80px]"
                        onClick={() => setFareDialog({ originId: rowZone.zone_id, destId: colZone.zone_id })}
                      >
                        {fare ? (
                          <Badge variant="outline" className="text-xs">{fare.currency_type} {fare.price}</Badge>
                        ) : (
                          <span className="text-muted-foreground">+ Set</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview + Export bar */}
      <div className="border-t p-3 bg-background flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium">Preview:</span>
        <Select value={previewOrigin} onValueChange={setPreviewOrigin}>
          <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Origin zone" /></SelectTrigger>
          <SelectContent>{zones.map((z) => <SelectItem key={z.zone_id} value={z.zone_id}>{z.name}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">→</span>
        <Select value={previewDest} onValueChange={setPreviewDest}>
          <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Dest zone" /></SelectTrigger>
          <SelectContent>{zones.map((z) => <SelectItem key={z.zone_id} value={z.zone_id}>{z.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handlePreview}>
          <EyeIcon size={12} /> Preview
        </Button>
        {previewResult && <Badge variant="secondary" className="text-xs">{previewResult}</Badge>}
        <div className="ml-auto">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleExport}>
            <DownloadIcon size={12} /> Export GTFS Fare Files
          </Button>
        </div>
      </div>

      {/* New Zone Dialog */}
      <Dialog open={zoneDialog} onOpenChange={setZoneDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Fare Zone</DialogTitle></DialogHeader>
          <form onSubmit={onZoneSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input {...zoneForm.register("name")} placeholder="Zone A — CBD" />
            </div>
            <div className="space-y-1">
              <Label>Agency</Label>
              <Select onValueChange={(v) => zoneForm.setValue("agency_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select agency" /></SelectTrigger>
                <SelectContent>{agencies.map((a) => <SelectItem key={a.agency_id} value={a.agency_id}>{a.agency_name}</SelectItem>)}</SelectContent>
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

      {/* Set Fare Dialog */}
      <Dialog open={!!fareDialog} onOpenChange={(o) => !o && setFareDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Fare</DialogTitle>
            {fareDialog && (
              <p className="text-xs text-muted-foreground">{fareDialog.originId} → {fareDialog.destId}</p>
            )}
          </DialogHeader>
          <form onSubmit={fareForm.handleSubmit((d) => saveFareMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label>Price</Label>
              <Input type="number" step="0.01" {...fareForm.register("price")} placeholder="30" />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input {...fareForm.register("currency_type")} defaultValue="KES" />
            </div>
            <div className="space-y-1">
              <Label>Payment Method</Label>
              <Select onValueChange={(v) => fareForm.setValue("payment_method", Number(v) as 0 | 1)} defaultValue="0">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">On board</SelectItem>
                  <SelectItem value="1">Before boarding</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Agency</Label>
              <Select onValueChange={(v) => fareForm.setValue("agency_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select agency" /></SelectTrigger>
                <SelectContent>{agencies.map((a) => <SelectItem key={a.agency_id} value={a.agency_id}>{a.agency_name}</SelectItem>)}</SelectContent>
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
