import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSnapshots, fetchSnapshot } from "@/api/network";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HistoryIcon,
  RouteIcon,
  MapPinIcon,
  CalendarClockIcon,
  ShapesIcon,
  BoxIcon,
} from "lucide-react";
import type { NetworkSnapshot } from "@/types";

const ENTITY_ICONS: Record<string, React.ElementType> = {
  route:    RouteIcon,
  stop:     MapPinIcon,
  trip:     CalendarClockIcon,
  shape:    ShapesIcon,
  corridor: BoxIcon,
};

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  created: "default",
  updated: "secondary",
  deleted: "destructive",
  manual:  "outline",
};

function SnapshotRow({ snapshot, onView }: { snapshot: NetworkSnapshot; onView: (s: NetworkSnapshot) => void }) {
  const Icon = ENTITY_ICONS[snapshot.entity_type] ?? BoxIcon;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b hover:bg-muted/40 transition-colors">
      <Icon size={14} className="shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{snapshot.entity_id}</span>
          <Badge variant={ACTION_VARIANTS[snapshot.action] ?? "outline"} className="text-[10px] h-4">
            {snapshot.action}
          </Badge>
          <span className="text-xs text-muted-foreground capitalize">{snapshot.entity_type}</span>
          {snapshot.label && (
            <span className="text-xs italic text-muted-foreground">{snapshot.label}</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {new Date(snapshot.created_at).toLocaleString()}
        </div>
      </div>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onView(snapshot)}>
        View
      </Button>
    </div>
  );
}

export default function NetworkSnapshotsPage() {
  const [entityType, setEntityType] = React.useState<string>("all");
  const [page, setPage] = React.useState(1);
  const [viewSnapshot, setViewSnapshot] = React.useState<NetworkSnapshot | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["network:snapshots", entityType, page],
    queryFn: () =>
      fetchSnapshots({
        entity_type: entityType === "all" ? undefined : entityType,
        page,
        per_page: 30,
      }),
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center gap-3">
        <HistoryIcon size={16} />
        <h1 className="font-semibold text-sm flex-1">Network Snapshots</h1>
        <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            <SelectItem value="route">Routes</SelectItem>
            <SelectItem value="stop">Stops</SelectItem>
            <SelectItem value="trip">Trips</SelectItem>
            <SelectItem value="shape">Shapes</SelectItem>
            <SelectItem value="corridor">Corridors</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : data?.data.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No snapshots yet. Snapshots are recorded automatically when network entities are saved.
          </div>
        ) : (
          data?.data.map((s) => (
            <SnapshotRow key={s.id} snapshot={s} onView={setViewSnapshot} />
          ))
        )}
      </div>

      {data && data.last_page > 1 && (
        <div className="p-3 border-t flex items-center justify-between text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-xs">
            Page {page} of {data.last_page}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.last_page}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Snapshot viewer dialog */}
      <Dialog open={!!viewSnapshot} onOpenChange={(o) => !o && setViewSnapshot(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Snapshot — {viewSnapshot?.entity_type} · {viewSnapshot?.entity_id}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <pre className="text-xs bg-muted rounded p-4 overflow-auto whitespace-pre-wrap">
              {viewSnapshot
                ? JSON.stringify(viewSnapshot.snapshot_json, null, 2)
                : ""}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
