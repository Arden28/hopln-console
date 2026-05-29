import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SaveIcon, RefreshCwIcon, Loader2Icon, FilterIcon, XIcon } from "lucide-react";
import { fetchRoutes } from "@/api/routes";
import { fetchServiceCalendars } from "@/api/serviceCalendars";
import { fetchTimetable, saveTimetable } from "@/api/timetable";
import { TimetableGrid } from "@/components/timetable/TimetableGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimetableData, TimetableTrip } from "@/types";

interface Filters {
  headsign: string;
  serviceId: string;
  schedulingType: string;
  startTime: string;
  endTime: string;
  minStops: string;
}

const EMPTY_FILTERS: Filters = {
  headsign: "",
  serviceId: "",
  schedulingType: "",
  startTime: "",
  endTime: "",
  minStops: "",
};

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function applyFilters(trips: TimetableTrip[], f: Filters): TimetableTrip[] {
  return trips.filter((trip) => {
    if (f.headsign) {
      const search = f.headsign.toLowerCase();
      const label  = (trip.trip_headsign ?? trip.trip_id).toLowerCase();
      if (!label.includes(search)) return false;
    }
    if (f.serviceId && trip.service_id !== f.serviceId) return false;
    if (f.schedulingType && trip.scheduling_type !== f.schedulingType) return false;
    if (f.minStops && trip.stop_times_count < Number(f.minStops)) return false;

    // Time range: filter by the trip's first stop time (earliest time value)
    if (f.startTime || f.endTime) {
      const firstTime = Object.values(trip.times).find(Boolean);
      if (firstTime) {
        const mins = timeToMins(firstTime);
        if (f.startTime && mins < timeToMins(f.startTime)) return false;
        if (f.endTime   && mins > timeToMins(f.endTime))   return false;
      }
    }

    return true;
  });
}

function activeFilterCount(f: Filters): number {
  return Object.values(f).filter(Boolean).length;
}

export default function TimetableEditorPage() {
  const queryClient = useQueryClient();

  const [routeId, setRouteId]         = React.useState<string>("");
  const [directionId, setDirectionId] = React.useState<0 | 1>(0);
  const [times, setTimes]             = React.useState<Record<string, Record<string, string>>>({});
  const [isDirty, setIsDirty]         = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const [filters, setFilters]         = React.useState<Filters>(EMPTY_FILTERS);

  const { data: routesData } = useQuery({
    queryKey: ["routes", { per_page: 200 }],
    queryFn: () => fetchRoutes({ per_page: 200 }),
  });

  const { data: calendars } = useQuery({
    queryKey: ["service-calendars"],
    queryFn: fetchServiceCalendars,
  });

  const { data: timetable, isLoading: isFetching, refetch } = useQuery<TimetableData>({
    queryKey: ["timetable", routeId, directionId],
    queryFn: () => fetchTimetable(routeId, directionId),
    enabled: !!routeId,
  });

  React.useEffect(() => {
    if (!timetable) return;
    const initial: Record<string, Record<string, string>> = {};
    for (const trip of timetable.trips) {
      initial[trip.trip_id] = { ...trip.times };
    }
    setTimes(initial);
    setIsDirty(false);
  }, [timetable]);

  // Reset filters when route/direction changes
  React.useEffect(() => {
    setFilters(EMPTY_FILTERS);
  }, [routeId, directionId]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!timetable) throw new Error("No timetable loaded");
      const tripsPayload = timetable.trips.map((trip) => ({
        trip_id: trip.trip_id,
        times: times[trip.trip_id] ?? {},
      }));
      return saveTimetable(routeId, tripsPayload);
    },
    onSuccess: (res) => {
      toast.success(`Timetable saved — ${res.stop_time_count} stop times updated`);
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["timetable", routeId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleChange(tripId: string, stopId: string, value: string) {
    setTimes((prev) => ({
      ...prev,
      [tripId]: { ...(prev[tripId] ?? {}), [stopId]: value },
    }));
    setIsDirty(true);
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  const allTrips      = timetable?.trips ?? [];
  const filteredTrips = applyFilters(allTrips, filters);
  const filterCount   = activeFilterCount(filters);

  return (
    <div className="flex flex-col gap-3 p-4 h-full">

      {/* ── Row 1: Route / direction / reload / save ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-xs">
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

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={!routeId || isFetching}
        >
          <RefreshCwIcon size={14} className={isFetching ? "animate-spin" : ""} />
          Reload
        </Button>

        {/* Filters toggle */}
        {timetable && (
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
          >
            <FilterIcon size={14} />
            Filters
            {filterCount > 0 && (
              <Badge className="ml-1 h-4 px-1 text-[10px]">{filterCount}</Badge>
            )}
          </Button>
        )}

        {timetable && (
          <span className="text-xs text-muted-foreground">
            {filterCount > 0
              ? `${filteredTrips.length} / ${allTrips.length} trips`
              : `${allTrips.length} trip${allTrips.length !== 1 ? "s" : ""}`}
          </span>
        )}

        <Button
          size="sm"
          disabled={!isDirty || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="ml-auto"
        >
          {mutation.isPending
            ? <Loader2Icon size={14} className="animate-spin" />
            : <SaveIcon size={14} />}
          Save{isDirty ? " ●" : ""}
        </Button>
      </div>

      {/* ── Row 2: Filter bar (collapsible) ── */}
      {showFilters && timetable && (
        <div className="flex items-end gap-3 flex-wrap rounded-lg border bg-muted/30 p-3">

          {/* Headsign search */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Headsign</p>
            <Input
              placeholder="Search…"
              value={filters.headsign}
              onChange={(e) => setFilter("headsign", e.target.value)}
              className="h-8 w-40 text-sm"
            />
          </div>

          {/* Service calendar */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Service calendar</p>
            <Select
              value={filters.serviceId || "__all__"}
              onValueChange={(v) => setFilter("serviceId", v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="h-8 w-44 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All calendars</SelectItem>
                {(calendars ?? []).map((c) => (
                  <SelectItem key={c.service_id} value={c.service_id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scheduling type */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Type</p>
            <Select
              value={filters.schedulingType || "__all__"}
              onValueChange={(v) => setFilter("schedulingType", v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="h-8 w-36 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All types</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="frequency">Frequency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time range */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">First departure from</p>
            <Input
              type="text"
              placeholder="06:00"
              value={filters.startTime}
              onChange={(e) => setFilter("startTime", e.target.value)}
              className="h-8 w-24 text-sm font-mono"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">to</p>
            <Input
              type="text"
              placeholder="10:00"
              value={filters.endTime}
              onChange={(e) => setFilter("endTime", e.target.value)}
              className="h-8 w-24 text-sm font-mono"
            />
          </div>

          {/* Min stop count */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Min stops</p>
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={filters.minStops}
              onChange={(e) => setFilter("minStops", e.target.value)}
              className="h-8 w-20 text-sm"
            />
          </div>

          {filterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 self-end">
              <XIcon size={14} />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* ── Grid area ── */}
      {!routeId && (
        <div className="text-center text-muted-foreground py-20 text-sm">
          Select a route to load its timetable.
        </div>
      )}

      {routeId && isFetching && (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}

      {routeId && !isFetching && timetable && (
        <>
          {filteredTrips.length === 0 ? (
            <div className="text-center text-muted-foreground py-20 text-sm">
              {allTrips.length === 0
                ? "No trips found for this route and direction."
                : "No trips match the active filters."}
            </div>
          ) : (
            <TimetableGrid
              stops={timetable.stops}
              trips={filteredTrips}
              times={times}
              onChange={handleChange}
              isDirty={isDirty}
            />
          )}
        </>
      )}
    </div>
  );
}
