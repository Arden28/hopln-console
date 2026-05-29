import * as React from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchRoutes } from "@/api/routes";
import { fetchBlocks } from "@/api/scheduling";
import { updateTrip } from "@/api/trips";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2Icon, AlertTriangleIcon } from "lucide-react";
import type { BlockTrip, BlockEntry } from "@/types";

// Time span for Gantt: 05:00 (300 min) → 23:00 (1380 min) = 1080 min
const GANTT_START = 300;
const GANTT_SPAN = 1080;

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function pct(mins: number): string {
  return `${Math.max(0, Math.min(100, ((mins - GANTT_START) / GANTT_SPAN) * 100)).toFixed(2)}%`;
}

const COLORS = [
  "bg-blue-200 border-blue-400",
  "bg-emerald-200 border-emerald-400",
  "bg-amber-200 border-amber-400",
  "bg-violet-200 border-violet-400",
  "bg-rose-200 border-rose-400",
  "bg-cyan-200 border-cyan-400",
];

function colorFor(idx: number) {
  return COLORS[idx % COLORS.length];
}

// ── Draggable trip chip ───────────────────────────────────────────────────────

function DraggableTrip({ trip, colorIdx }: { trip: BlockTrip; colorIdx: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: trip.trip_id,
    data: { trip },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`px-2 py-1 text-xs rounded border cursor-grab select-none ${colorFor(colorIdx)} ${isDragging ? "opacity-40" : ""}`}
    >
      {trip.trip_headsign ?? trip.trip_id.slice(-8)}{" "}
      <span className="text-muted-foreground">{trip.first_departure?.slice(0, 5)}</span>
    </div>
  );
}

// ── Gantt bar ─────────────────────────────────────────────────────────────────

function GanttBar({
  trip,
  colorIdx,
  conflict,
}: {
  trip: BlockTrip;
  colorIdx: number;
  conflict: boolean;
}) {
  const startMins = timeToMins(trip.first_departure);
  const durationMins = trip.duration_mins;

  return (
    <div
      className={`absolute h-7 rounded border flex items-center px-1.5 text-xs overflow-hidden whitespace-nowrap ${colorFor(colorIdx)} ${conflict ? "outline outline-2 outline-red-500 z-10" : ""}`}
      style={{
        left: pct(startMins),
        width: pct(startMins + durationMins).replace("%", "") === "0.00" ? "4px" : `${((durationMins / GANTT_SPAN) * 100).toFixed(2)}%`,
      }}
      title={`${trip.trip_id} ${trip.first_departure} → ${trip.last_arrival}`}
    >
      {trip.trip_id.slice(-6)}
    </div>
  );
}

// ── Block row (droppable) ─────────────────────────────────────────────────────

function BlockRow({
  block,
  blockIdx,
  onUnassign,
}: {
  block: BlockEntry;
  blockIdx: number;
  onUnassign: (tripId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: block.block_id });
  const conflictIds = new Set(
    block.conflicts.flatMap((c) => [c.trip1_id, c.trip2_id])
  );

  return (
    <div
      ref={setNodeRef}
      className={`relative border rounded-lg p-2 transition-colors ${isOver ? "bg-primary/10 border-primary" : "bg-background"}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-mono font-semibold">{block.block_id}</span>
        <span className="text-xs text-muted-foreground">{block.total_hours}h</span>
        {block.conflicts.length > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1 py-0">
            <AlertTriangleIcon size={10} className="mr-0.5" />
            {block.conflicts.length} conflict
          </Badge>
        )}
      </div>

      {/* Time axis */}
      <div className="relative h-8 bg-muted/30 rounded overflow-hidden">
        {block.trips.map((trip, i) => (
          <GanttBar
            key={trip.trip_id}
            trip={trip}
            colorIdx={blockIdx * 3 + i}
            conflict={conflictIds.has(trip.trip_id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BlockBuilderTab() {
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor));

  const [routeId, setRouteId] = React.useState<string>("");
  const [localBlocks, setLocalBlocks] = React.useState<BlockEntry[] | null>(null);
  const [localUnblocked, setLocalUnblocked] = React.useState<BlockTrip[]>([]);

  const { data: routesData } = useQuery({
    queryKey: ["routes", { per_page: 200 }],
    queryFn: () => fetchRoutes({ per_page: 200 }),
  });

  const { data: blocksData, isLoading } = useQuery({
    queryKey: ["scheduling:blocks", routeId],
    queryFn: () => fetchBlocks(routeId),
    enabled: !!routeId,
  });

  React.useEffect(() => {
    if (!blocksData) return;
    setLocalBlocks(blocksData.blocks);
    setLocalUnblocked(blocksData.unblocked);
  }, [blocksData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!localBlocks) return;
      const updates: Array<{ trip_id: string; block_id: string | null }> = [];
      for (const block of localBlocks) {
        for (const trip of block.trips) {
          if (trip.block_id !== block.block_id) {
            updates.push({ trip_id: trip.trip_id, block_id: block.block_id });
          }
        }
      }
      for (const trip of localUnblocked) {
        if (trip.block_id !== null) {
          updates.push({ trip_id: trip.trip_id, block_id: null });
        }
      }
      await Promise.all(updates.map((u) => updateTrip(u.trip_id, { block_id: u.block_id })));
    },
    onSuccess: () => {
      toast.success("Block assignments saved");
      queryClient.invalidateQueries({ queryKey: ["scheduling:blocks", routeId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !localBlocks) return;

    const tripId = active.id as string;
    const targetBlockId = over.id as string;

    setLocalBlocks((prev) => {
      if (!prev) return prev;
      // Remove trip from wherever it is
      let movedTrip: BlockTrip | undefined;
      const newBlocks = prev.map((b) => ({
        ...b,
        trips: b.trips.filter((t) => {
          if (t.trip_id === tripId) { movedTrip = t; return false; }
          return true;
        }),
      }));

      if (!movedTrip) {
        // Was in unblocked
        movedTrip = localUnblocked.find((t) => t.trip_id === tripId);
        setLocalUnblocked((u) => u.filter((t) => t.trip_id !== tripId));
      }

      if (!movedTrip) return prev;

      if (targetBlockId === "__unblocked__") {
        setLocalUnblocked((u) => [...u, { ...movedTrip!, block_id: null }]);
        return newBlocks;
      }

      return newBlocks.map((b) =>
        b.block_id === targetBlockId
          ? { ...b, trips: [...b.trips, { ...movedTrip!, block_id: targetBlockId }].sort((a, z) => a.first_departure.localeCompare(z.first_departure)) }
          : b
      );
    });
  }

  function autoAssign() {
    if (!blocksData) return;
    const allTrips = [
      ...(localBlocks?.flatMap((b) => b.trips) ?? []),
      ...localUnblocked,
    ].sort((a, b) => a.first_departure.localeCompare(b.first_departure));

    const newBlocks: BlockEntry[] = [];
    for (const trip of allTrips) {
      const assigned = newBlocks.find(
        (b) =>
          b.trips.length > 0 &&
          timeToMins(b.trips[b.trips.length - 1].last_arrival) + 10 <=
            timeToMins(trip.first_departure)
      );
      if (assigned) {
        assigned.trips.push({ ...trip, block_id: assigned.block_id });
      } else {
        const blockId = `BLK-${String(newBlocks.length + 1).padStart(2, "0")}`;
        newBlocks.push({
          block_id: blockId,
          trips: [{ ...trip, block_id: blockId }],
          total_hours: 0,
          conflicts: [],
        });
      }
    }

    setLocalBlocks(newBlocks);
    setLocalUnblocked([]);
  }

  const { setNodeRef: unblockedRef, isOver: unblockedOver } = useDroppable({ id: "__unblocked__" });

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-72">
          <Select value={routeId} onValueChange={setRouteId}>
            <SelectTrigger>
              <SelectValue placeholder="Select route…" />
            </SelectTrigger>
            <SelectContent>
              {(routesData?.data ?? []).map((r) => (
                <SelectItem key={r.route_id} value={r.route_id}>
                  {r.route_short_name} — {r.route_long_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {localBlocks && (
          <>
            <Button variant="outline" size="sm" onClick={autoAssign}>
              Auto-assign
            </Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2Icon size={14} className="animate-spin" />}
              Save assignments
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              Fleet: {localBlocks.length} vehicles
            </span>
          </>
        )}
      </div>

      {!routeId && (
        <div className="text-center text-muted-foreground py-20 text-sm">
          Select a route to manage block assignments.
        </div>
      )}

      {routeId && isLoading && <Skeleton className="h-[400px] w-full" />}

      {routeId && !isLoading && localBlocks && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {/* Time axis header */}
          <div className="grid text-[10px] text-muted-foreground px-[8px]" style={{ gridTemplateColumns: `repeat(18, 1fr)` }}>
            {Array.from({ length: 18 }, (_, i) => (
              <span key={i}>{String(5 + i).padStart(2, "0")}:00</span>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {localBlocks.map((block, idx) => (
              <BlockRow
                key={block.block_id}
                block={block}
                blockIdx={idx}
                onUnassign={(tripId) => {
                  setLocalBlocks((prev) => {
                    if (!prev) return prev;
                    let moved: BlockTrip | undefined;
                    const updated = prev.map((b) => ({
                      ...b,
                      trips: b.trips.filter((t) => {
                        if (t.trip_id === tripId) { moved = t; return false; }
                        return true;
                      }),
                    }));
                    if (moved) setLocalUnblocked((u) => [...u, { ...moved!, block_id: null }]);
                    return updated;
                  });
                }}
              />
            ))}
          </div>

          {/* Unblocked pool */}
          <div
            ref={unblockedRef}
            className={`border-2 border-dashed rounded-lg p-3 min-h-[60px] transition-colors ${unblockedOver ? "border-primary bg-primary/5" : "border-muted"}`}
          >
            <div className="text-xs text-muted-foreground mb-2">
              Unassigned trips ({localUnblocked.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {localUnblocked.map((trip, i) => (
                <DraggableTrip key={trip.trip_id} trip={trip} colorIdx={i} />
              ))}
            </div>
          </div>
        </DndContext>
      )}
    </div>
  );
}
