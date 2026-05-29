import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { fetchRoutes } from "@/api/routes";
import { fetchTimetable } from "@/api/timetable";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function TimeSpaceDiagramTab() {
  const [routeId, setRouteId] = React.useState<string>("");

  const { data: routesData } = useQuery({
    queryKey: ["routes", { per_page: 200 }],
    queryFn: () => fetchRoutes({ per_page: 200 }),
  });

  const { data: tt0, isLoading: l0 } = useQuery({
    queryKey: ["timetable", routeId, 0],
    queryFn: () => fetchTimetable(routeId, 0),
    enabled: !!routeId,
  });

  const { data: tt1, isLoading: l1 } = useQuery({
    queryKey: ["timetable", routeId, 1],
    queryFn: () => fetchTimetable(routeId, 1),
    enabled: !!routeId,
  });

  const isLoading = l0 || l1;

  // Build per-trip line data: [{x: mins, y: stop_sequence}]
  type TripLine = {
    tripId: string;
    direction: 0 | 1;
    points: { x: number; y: number }[];
    conflict: boolean;
  };

  const lines: TripLine[] = React.useMemo(() => {
    const result: TripLine[] = [];

    const processTimetable = (tt: typeof tt0, direction: 0 | 1) => {
      if (!tt) return;
      const stopSeqMap: Record<string, number> = {};
      for (const s of tt.stops) stopSeqMap[s.stop_id] = s.stop_sequence;

      for (const trip of tt.trips) {
        const points: { x: number; y: number }[] = [];
        for (const [stopId, time] of Object.entries(trip.times)) {
          if (!time) continue;
          points.push({ x: timeToMins(time), y: stopSeqMap[stopId] ?? 0 });
        }
        points.sort((a, b) => a.y - b.y);
        result.push({ tripId: trip.trip_id, direction, points, conflict: false });
      }
    };

    processTimetable(tt0, 0);
    processTimetable(tt1, 1);

    // Detect conflicts: same direction, same stop (y), time diff < 1 min
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        if (result[i].direction !== result[j].direction) continue;
        for (const pi of result[i].points) {
          for (const pj of result[j].points) {
            if (pi.y === pj.y && Math.abs(pi.x - pj.x) < 1) {
              result[i].conflict = true;
              result[j].conflict = true;
            }
          }
        }
      }
    }

    return result;
  }, [tt0, tt1]);

  const conflictCount = lines.filter((l) => l.conflict).length;

  const stopNames: Record<number, string> = React.useMemo(() => {
    const map: Record<number, string> = {};
    for (const s of (tt0?.stops ?? [])) map[s.stop_sequence] = s.stop_name;
    for (const s of (tt1?.stops ?? [])) map[s.stop_sequence] = s.stop_name;
    return map;
  }, [tt0, tt1]);

  const maxSeq = Math.max(
    ...(tt0?.stops ?? []).map((s) => s.stop_sequence),
    ...(tt1?.stops ?? []).map((s) => s.stop_sequence),
    1
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
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

        {conflictCount > 0 && (
          <Badge variant="destructive">
            {conflictCount} conflict{conflictCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {!routeId && (
        <div className="text-center text-muted-foreground py-20 text-sm">
          Select a route to draw its time-space diagram.
        </div>
      )}

      {routeId && isLoading && <Skeleton className="h-[400px] w-full" />}

      {routeId && !isLoading && lines.length > 0 && (
        <div className="border rounded-lg p-4">
          <ResponsiveContainer width="100%" height={480}>
            <ComposedChart margin={{ top: 10, right: 20, bottom: 10, left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[240, 1440]}
                tickFormatter={fmtMins}
                tickCount={13}
                label={{ value: "Time", position: "insideBottom", offset: -5 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[1, maxSeq]}
                reversed
                tickFormatter={(v) => stopNames[v] ?? String(v)}
                width={75}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(val, name) => [fmtMins(val as number), name]}
                labelFormatter={(v) => stopNames[v as number] ?? String(v)}
              />
              {lines.map((line) => (
                <Line
                  key={line.tripId}
                  data={line.points}
                  dataKey="y"
                  stroke={
                    line.conflict
                      ? "hsl(0,80%,50%)"
                      : line.direction === 0
                      ? "var(--primary)"
                      : "hsl(210,70%,55%)"
                  }
                  strokeWidth={line.conflict ? 2 : 1.5}
                  dot={false}
                  isAnimationActive={false}
                  name={line.tripId}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground justify-end">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-primary" /> Outbound
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-[hsl(210,70%,55%)]" /> Inbound
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-red-500" /> Conflict
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
