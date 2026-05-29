import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Map, { Marker, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fetchInteropEntries, createEntry, updateEntry, deleteEntry } from "@/api/interop";
import { PathwayEditorDialog } from "@/components/PathwayEditorDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PlusIcon, Trash2Icon, PlugIcon, MapPinIcon } from "lucide-react";
import type { InteropEntry, InteropEntryType } from "@/types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

const ENTRY_TYPES: { value: InteropEntryType; label: string; icon: string }[] = [
  { value: "bikeshare",       label: "Bikeshare",          icon: "🚲" },
  { value: "park_and_ride",   label: "Park & Ride",         icon: "🅿" },
  { value: "taxi_rank",       label: "Taxi Rank",           icon: "🚕" },
  { value: "airport_terminal",label: "Airport Terminal",    icon: "✈" },
  { value: "ferry_terminal",  label: "Ferry Terminal",      icon: "⛴" },
  { value: "brt_station",     label: "BRT Station",         icon: "🚌" },
  { value: "rail_station",    label: "Rail Station",        icon: "🚉" },
];

function typeLabel(t: string) {
  return ENTRY_TYPES.find((e) => e.value === t) ?? { label: t, icon: "📍" };
}

const entrySchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  description: z.string().optional(),
  gtfs_stop_id: z.string().optional(),
});
type EntryForm = z.infer<typeof entrySchema>;

export default function InteropRegistryPage() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<InteropEntry | null>(null);
  const [popupEntry, setPopupEntry] = React.useState<InteropEntry | null>(null);
  const [addDialog, setAddDialog] = React.useState(false);
  const [pathwayDialog, setPathwayDialog] = React.useState<InteropEntry | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["network:interop"],
    queryFn: () => fetchInteropEntries(),
    staleTime: 60_000,
  });

  const form = useForm<EntryForm>({ resolver: zodResolver(entrySchema) });

  const createMutation = useMutation({
    mutationFn: (d: EntryForm) => createEntry({ ...d, type: d.type as InteropEntryType }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["network:interop"] });
      setAddDialog(false);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["network:interop"] });
      if (selected) setSelected(null);
    },
  });

  const filtered = entries.filter((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* List panel */}
      <div className="w-80 shrink-0 border-r bg-background flex flex-col overflow-hidden">
        <div className="p-4 border-b space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-sm">
              <PlugIcon size={15} />
              Interop Registry
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddDialog(true)}>
              <PlusIcon size={12} /> Add
            </Button>
          </div>
          <div className="relative">
            <Input
              className="h-8 text-xs pl-3"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ENTRY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y">
            {filtered.map((entry) => {
              const meta = typeLabel(entry.type);
              return (
                <div
                  key={entry.id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted ${selected?.id === entry.id ? "bg-muted" : ""}`}
                  onClick={() => setSelected(selected?.id === entry.id ? null : entry)}
                >
                  <span className="text-lg shrink-0 mt-0.5">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{entry.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge variant="outline" className="text-xs py-0">{meta.label}</Badge>
                      {entry.gtfs_stop_id && (
                        <Badge variant="secondary" className="text-xs py-0 flex items-center gap-0.5">
                          <MapPinIcon size={9} /> linked
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={(e) => { e.stopPropagation(); setPathwayDialog(entry); }}
                    >
                      Pathways
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(entry.id); }}
                    >
                      <Trash2Icon size={11} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1">
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{ latitude: -1.2921, longitude: 36.8219, zoom: 11 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          {filtered.map((entry) => {
            const meta = typeLabel(entry.type);
            return (
              <Marker
                key={entry.id}
                longitude={entry.lng}
                latitude={entry.lat}
                anchor="bottom"
                onClick={(e) => { e.originalEvent.stopPropagation(); setPopupEntry(entry); }}
              >
                <div
                  className="text-xl cursor-pointer hover:scale-110 transition-transform"
                  title={entry.name}
                >
                  {meta.icon}
                </div>
              </Marker>
            );
          })}

          {popupEntry && (
            <Popup
              longitude={popupEntry.lng}
              latitude={popupEntry.lat}
              onClose={() => setPopupEntry(null)}
              closeButton
              offset={20}
            >
              <div className="text-xs space-y-1 min-w-[160px]">
                <div className="font-medium">{popupEntry.name}</div>
                <Badge variant="outline" className="text-xs py-0">{typeLabel(popupEntry.type).label}</Badge>
                {popupEntry.description && <p className="text-muted-foreground">{popupEntry.description}</p>}
                {popupEntry.gtfs_stop_id && (
                  <p>Linked stop: <span className="font-mono">{popupEntry.gtfs_stop_id}</span></p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs mt-1"
                  onClick={() => { setPathwayDialog(popupEntry); setPopupEntry(null); }}
                >
                  Open Pathways
                </Button>
              </div>
            </Popup>
          )}
        </Map>
      </div>

      {/* Add Entry Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Interop Entry</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input {...form.register("name")} placeholder="Nairobi Bikeshare CBD" />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select onValueChange={(v) => form.setValue("type", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {ENTRY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Latitude</Label>
                <Input type="number" step="any" {...form.register("lat")} placeholder="-1.2921" />
              </div>
              <div className="space-y-1">
                <Label>Longitude</Label>
                <Input type="number" step="any" {...form.register("lng")} placeholder="36.8219" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input {...form.register("description")} placeholder="Optional description" />
            </div>
            <div className="space-y-1">
              <Label>Linked GTFS Stop ID</Label>
              <Input {...form.register("gtfs_stop_id")} placeholder="Optional stop ID" />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setAddDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>Add Entry</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pathway Editor */}
      {pathwayDialog && (
        <PathwayEditorDialog
          open={!!pathwayDialog}
          onClose={() => setPathwayDialog(null)}
          stopId={pathwayDialog.gtfs_stop_id ?? String(pathwayDialog.id)}
          stopName={pathwayDialog.name}
        />
      )}
    </div>
  );
}
