import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDelayDashboard, fetchDelayHeatmap } from "@/api/realtime";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  LineChart, Line, ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import { GaugeIcon, ClockIcon, BusIcon, AlertTriangleIcon } from "lucide-react";
import type { DelayHeatmapCell } from "@/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function delayColor(seconds: number): string {
  if (seconds <= 0)   return "bg-green-100";
  if (seconds < 60)   return "bg-green-200";
  if (seconds < 120)  return "bg-yellow-200";
  if (seconds < 300)  return "bg-orange-300";
  return "bg-red-400";
}

function KpiCard({ label, value, sub, icon: Icon }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 flex items-start gap-4">
      <div className="rounded-md bg-muted p-2.5">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return <span className="text-muted-foreground text-xs">no data</span>;
  const pts = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width={80} height={28}>
      <LineChart data={pts}>
        <Line type="monotone" dataKey="v" dot={false} strokeWidth={1.5} stroke="#3b82f6" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function OnTimePerformancePage() {
  const [period, setPeriod] = React.useState<"7d" | "30d" | "90d">("7d");

  const { data, isLoading } = useQuery({
    queryKey: ["ops:delay-dashboard", period],
    queryFn: () => fetchDelayDashboard({ period }),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const { data: heatmap = [] } = useQuery({
    queryKey: ["ops:delay-heatmap"],
    queryFn: fetchDelayHeatmap,
    staleTime: 300_000,
  });

  // Build 7×24 grid
  const grid: Record<number, Record<number, DelayHeatmapCell>> = {};
  for (const cell of heatmap) {
    if (!grid[cell.day_of_week]) grid[cell.day_of_week] = {};
    grid[cell.day_of_week][cell.hour_of_day] = cell;
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">On-Time Performance</h2>
        <Select value={period} onValueChange={v => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-5">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))
        ) : data ? (
          <>
            <KpiCard label="Fleet On-Time %" value={`${data.on_time_pct}%`} icon={GaugeIcon} />
            <KpiCard label="Avg Delay" value={`${data.avg_delay_s}s`} icon={ClockIcon} />
            <KpiCard label="Trips Tracked" value={data.trips_tracked.toLocaleString()} icon={BusIcon} />
            <KpiCard
              label="Worst Route"
              value={data.worst_routes[0]?.route_id ?? "—"}
              sub={data.worst_routes[0] ? `${data.worst_routes[0].avg_delay_s}s avg delay` : undefined}
              icon={AlertTriangleIcon}
            />
          </>
        ) : null}
      </div>

      {/* Worst routes table */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Top 5 Worst Routes</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Route</TableHead>
              <TableHead className="text-right">On-Time %</TableHead>
              <TableHead className="text-right">Avg Delay</TableHead>
              <TableHead>Trend (7d)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {[1,2,3,4].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              : (data?.worst_routes ?? []).map(r => (
                  <TableRow key={r.route_id}>
                    <TableCell className="font-semibold">{r.route_id}</TableCell>
                    <TableCell className="text-right">
                      <span className={r.on_time_pct >= 80 ? "text-green-600" : r.on_time_pct >= 60 ? "text-amber-600" : "text-red-600"}>
                        {r.on_time_pct}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{r.avg_delay_s}s</TableCell>
                    <TableCell><Sparkline data={r.sparkline} /></TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {/* Delay heatmap */}
      {heatmap.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold text-sm mb-3">Delay Heatmap (90-day window)</h3>
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-muted-foreground font-normal pr-2 text-right" />
                  {Array.from({ length: 24 }, (_, h) => (
                    <th key={h} className="text-muted-foreground font-normal w-7 text-center pb-1">
                      {h % 6 === 0 ? `${h}h` : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, dow) => (
                  <tr key={dow}>
                    <td className="text-muted-foreground pr-2 text-right">{day}</td>
                    {Array.from({ length: 24 }, (_, h) => {
                      const cell = grid[dow]?.[h];
                      return (
                        <td
                          key={h}
                          title={cell ? `${cell.avg_delay_s}s avg (${cell.sample_count} samples)` : "No data"}
                          className={`w-7 h-5 rounded-sm ${cell ? delayColor(cell.avg_delay_s) : "bg-muted/30"}`}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>Low delay</span>
              {["bg-green-100","bg-green-200","bg-yellow-200","bg-orange-300","bg-red-400"].map((c,i) => (
                <div key={i} className={`w-4 h-4 rounded-sm ${c}`} />
              ))}
              <span>High delay</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
