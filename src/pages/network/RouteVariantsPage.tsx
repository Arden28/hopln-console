import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchRoutePatterns, updateRoutePattern } from "@/api/routePatterns";
import { fetchRoutes } from "@/api/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GitBranchIcon,
  ChevronsUpDownIcon,
  CheckIcon,
  StarIcon,
} from "lucide-react";
import type { Route, RoutePattern, RoutePatternStop } from "@/types";

function StopDiff({
  patternA,
  patternB,
}: {
  patternA: RoutePattern;
  patternB: RoutePattern;
}) {
  const stopsA = (patternA.pattern_stops ?? []).map((s) => s.stop_id);
  const stopsB = (patternB.pattern_stops ?? []).map((s) => s.stop_id);
  const setA = new Set(stopsA);
  const setB = new Set(stopsB);
  const allStops = [...new Set([...stopsA, ...stopsB])];

  const getName = (ps: RoutePatternStop) => ps.stop?.name ?? ps.stop_id;

  return (
    <div className="grid grid-cols-2 gap-4 mt-4">
      {[
        { pattern: patternA, other: setB, label: "Pattern A" },
        { pattern: patternB, other: setA, label: "Pattern B" },
      ].map(({ pattern, other, label }) => (
        <div key={pattern.id} className="border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-muted/40 border-b text-xs font-medium flex items-center gap-2">
            {label} — {pattern.name}
            {pattern.is_canonical && (
              <Badge variant="default" className="text-[10px] h-4">canonical</Badge>
            )}
          </div>
          <div className="divide-y max-h-72 overflow-y-auto">
            {(pattern.pattern_stops ?? []).map((ps) => {
              const inOther = other.has(ps.stop_id);
              return (
                <div
                  key={ps.id}
                  className={`px-3 py-1.5 text-xs flex items-center gap-2 ${inOther ? "" : "bg-destructive/10 text-destructive"}`}
                >
                  <span className="w-5 text-muted-foreground tabular-nums text-right shrink-0">
                    {ps.stop_sequence}
                  </span>
                  <span className="truncate">{getName(ps)}</span>
                  {!inOther && <Badge variant="destructive" className="ml-auto text-[9px] h-3.5">only here</Badge>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RouteVariantsPage() {
  const qc = useQueryClient();
  const [routeOpen, setRouteOpen] = React.useState(false);
  const [routeSearch, setRouteSearch] = React.useState("");
  const [selectedRoute, setSelectedRoute] = React.useState<Route | null>(null);
  const [compareA, setCompareA] = React.useState<RoutePattern | null>(null);
  const [compareB, setCompareB] = React.useState<RoutePattern | null>(null);

  const { data: routesData } = useQuery({
    queryKey: ["routes:combobox", routeSearch],
    queryFn: () => fetchRoutes({ search: routeSearch || undefined, per_page: 20 }),
    select: (res) => res.data,
    enabled: routeOpen,
    staleTime: 30_000,
  });

  const { data: patterns = [], isLoading: patternsLoading } = useQuery({
    queryKey: ["route-patterns", selectedRoute?.route_id],
    queryFn: () => fetchRoutePatterns({ route_id: selectedRoute!.route_id }),
    enabled: !!selectedRoute,
    staleTime: 30_000,
  });

  const canonicalMutation = useMutation({
    mutationFn: (patternId: string) => updateRoutePattern(patternId, { is_canonical: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route-patterns", selectedRoute?.route_id] });
      toast.success("Canonical pattern updated.");
    },
    onError: () => toast.error("Failed to update canonical pattern."),
  });

  const showDiff = compareA && compareB && compareA.id !== compareB.id;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <GitBranchIcon size={18} />
        <div>
          <h1 className="text-xl font-semibold">Route Variants</h1>
          <p className="text-sm text-muted-foreground">Compare stop patterns across route variants.</p>
        </div>
      </div>

      {/* Route selector */}
      <div className="flex items-center gap-3">
        <Popover open={routeOpen} onOpenChange={setRouteOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-64 justify-between">
              {selectedRoute ? `${selectedRoute.route_short_name} — ${selectedRoute.route_long_name}` : "Select a route…"}
              <ChevronsUpDownIcon size={13} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0">
            <Command>
              <CommandInput
                placeholder="Search routes…"
                value={routeSearch}
                onValueChange={setRouteSearch}
              />
              <CommandList>
                <CommandEmpty>No routes found.</CommandEmpty>
                <CommandGroup>
                  {(routesData ?? []).map((r) => (
                    <CommandItem
                      key={r.route_id}
                      value={r.route_short_name}
                      onSelect={() => {
                        setSelectedRoute(r);
                        setRouteOpen(false);
                        setCompareA(null);
                        setCompareB(null);
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full mr-2"
                        style={{ background: r.route_color ? `#${r.route_color}` : "#6366f1" }}
                      />
                      {r.route_short_name}
                      <span className="ml-1.5 text-muted-foreground text-xs truncate">
                        {r.route_long_name}
                      </span>
                      {selectedRoute?.route_id === r.route_id && (
                        <CheckIcon size={12} className="ml-auto" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {patterns.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {patterns.length} pattern{patterns.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Patterns list */}
      {selectedRoute && (
        <>
          {patternsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : patterns.length === 0 ? (
            <div className="text-sm text-muted-foreground">No patterns defined for this route.</div>
          ) : (
            <div className="rounded-lg border divide-y">
              {patterns.map((p) => {
                const selectedForA = compareA?.id === p.id;
                const selectedForB = compareB?.id === p.id;
                return (
                  <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{p.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          Direction {p.direction_id}
                        </Badge>
                        {p.is_canonical && (
                          <Badge variant="default" className="text-[10px] gap-0.5">
                            <StarIcon size={9} />
                            Canonical
                          </Badge>
                        )}
                        {p.trips_count !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {p.trips_count} trip{p.trips_count !== 1 ? "s" : ""}
                          </span>
                        )}
                        {p.pattern_stops && (
                          <span className="text-xs text-muted-foreground">
                            {p.pattern_stops.length} stop{p.pattern_stops.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant={selectedForA ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setCompareA(selectedForA ? null : p)}
                      >
                        A
                      </Button>
                      <Button
                        variant={selectedForB ? "secondary" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setCompareB(selectedForB ? null : p)}
                      >
                        B
                      </Button>
                      {!p.is_canonical && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => canonicalMutation.mutate(p.id)}
                          disabled={canonicalMutation.isPending}
                          title="Set as canonical"
                        >
                          <StarIcon size={12} />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Diff view */}
          {showDiff && <StopDiff patternA={compareA} patternB={compareB} />}
          {compareA && !compareB && (
            <p className="text-xs text-muted-foreground">Select pattern B to compare.</p>
          )}
        </>
      )}
    </div>
  );
}
