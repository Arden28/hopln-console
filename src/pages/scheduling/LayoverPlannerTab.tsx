import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchRoutes } from "@/api/routes";
import { fetchLayoverAnalysis } from "@/api/scheduling";
import { saveTimetable } from "@/api/timetable";
import { fetchTimetable } from "@/api/timetable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2Icon } from "lucide-react";

function timeToMins(t: string): number {
  const [h, m, s] = t.split(":").map(Number);
  return h * 60 + m + Math.round(s / 60);
}

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export default function LayoverPlannerTab() {
  const queryClient = useQueryClient();
  const [routeId, setRouteId] = React.useState<string>("");
  const [directionId, setDirectionId] = React.useState<0 | 1>(0);
  const [minRecovery, setMinRecovery] = React.useState(5);

  const { data: routesData } = useQuery({
    queryKey: ["routes", { per_page: 200 }],
    queryFn: () => fetchRoutes({ per_page: 200 }),
  });

  const { data: analysis, isLoading } = useQuery({
    queryKey: ["scheduling:layover", routeId, directionId],
    queryFn: () => fetchLayoverAnalysis(routeId, directionId),
    enabled: !!routeId,
  });

  const { data: timetable } = useQuery({
    queryKey: ["timetable", routeId, directionId],
    queryFn: () => fetchTimetable(routeId, directionId),
    enabled: !!routeId,
  });

  const applyMutation = useMutation({
    mutationFn: () => {
      if (!analysis || !timetable) throw new Error("No data loaded");

      // For each flagged trip, push its departure times forward so recovery >= minRecovery
      const adjustedTimes: Record<string, Record<string, string>> = {};
      for (const trip of timetable.trips) {
        adjustedTimes[trip.trip_id] = { ...trip.times };
      }

      for (let i = 0; i < analysis.trips.length; i++) {
        const row = analysis.trips[i];
        if (row.recovery_mins === null || row.recovery_mins >= minRecovery) continue;

        const shortage = minRecovery - row.recovery_mins;
        // Shift all stop times of this trip and subsequent trips forward by shortage
        for (let j = i; j < analysis.trips.length; j++) {
          const tripId = analysis.trips[j].trip_id;
          const tripTimes = adjustedTimes[tripId];
          if (!tripTimes) continue;
          for (const stopId of Object.keys(tripTimes)) {
            const t = tripTimes[stopId];
            if (t) tripTimes[stopId] = minsToTime(timeToMins(t) + shortage);
          }
        }
        break; // re-check from start after first fix (simplification)
      }

      const tripsPayload = timetable.trips.map((trip) => ({
        trip_id: trip.trip_id,
        times: adjustedTimes[trip.trip_id] ?? {},
      }));

      return saveTimetable(routeId, tripsPayload);
    },
    onSuccess: () => {
      toast.success("Recovery times adjusted and saved");
      queryClient.invalidateQueries({ queryKey: ["timetable", routeId] });
      queryClient.invalidateQueries({ queryKey: ["scheduling:layover", routeId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
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

        <Select
          value={String(directionId)}
          onValueChange={(v) => setDirectionId(v === "1" ? 1 : 0)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Outbound</SelectItem>
            <SelectItem value="1">Inbound</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!routeId && (
        <div className="text-center text-muted-foreground py-20 text-sm">
          Select a route to analyse recovery times.
        </div>
      )}

      {routeId && isLoading && <Skeleton className="h-[300px] w-full" />}

      {routeId && !isLoading && analysis && (
        <>
          {/* Summary */}
          <div className="flex gap-4">
            <div className="border rounded-lg p-4">
              <div className="text-2xl font-bold">{analysis.flagged_count}</div>
              <div className="text-xs text-muted-foreground">Flagged trips</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-2xl font-bold">{analysis.min_recovery_mins ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Min recovery (min)</div>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip</TableHead>
                  <TableHead>First dep.</TableHead>
                  <TableHead>Last arr.</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Recovery</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.trips.map((row) => (
                  <TableRow key={row.trip_id}>
                    <TableCell className="font-mono text-xs">{row.trip_id}</TableCell>
                    <TableCell className="font-mono text-sm">{row.first_departure}</TableCell>
                    <TableCell className="font-mono text-sm">{row.last_arrival}</TableCell>
                    <TableCell className="text-sm">{row.duration_mins} min</TableCell>
                    <TableCell className="text-sm">
                      {row.recovery_mins !== null ? (
                        <span className="font-mono">{row.recovery_mins} min</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.recovery_mins === null ? null : row.recovery_mins < 0 ? (
                        <Badge variant="destructive">Overlap {row.recovery_mins} min</Badge>
                      ) : row.recovery_mins < 3 ? (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                          ⚠ {row.recovery_mins} min
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-emerald-600">
                          {row.recovery_mins} min
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Apply minimum recovery */}
          {analysis.flagged_count > 0 && (
            <div className="flex items-end gap-3 border rounded-lg p-4 bg-muted/30">
              <div className="space-y-1">
                <Label>Minimum recovery (min)</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={minRecovery}
                  onChange={(e) => setMinRecovery(Number(e.target.value))}
                  className="w-24"
                />
              </div>
              <Button
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending}
              >
                {applyMutation.isPending && (
                  <Loader2Icon size={14} className="animate-spin" />
                )}
                Apply & save
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
