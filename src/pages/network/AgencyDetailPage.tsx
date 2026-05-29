import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "@tanstack/react-router";
import { fetchAgencies } from "@/api/agencies";
import { fetchRoutes } from "@/api/routes";
import { fetchVehicles } from "@/api/fleet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronLeftIcon, GlobeIcon, PhoneIcon, MailIcon, ClockIcon } from "lucide-react";
import type { Agency, Route, Vehicle } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-green-100 text-green-700 border-green-200",
  inactive:  "bg-slate-100 text-slate-700 border-slate-200",
  suspended: "bg-red-100 text-red-700 border-red-200",
};

export function AgencyDetailPage() {
  const { agencyId } = useParams({ strict: false }) as { agencyId: string };

  const { data: agencies, isLoading: agencyLoading } = useQuery({
    queryKey: ["agencies"],
    queryFn: fetchAgencies,
    staleTime: 120_000,
  });

  const agency: Agency | undefined = (agencies ?? []).find(a => a.agency_id === agencyId);

  const { data: routesRes, isLoading: routesLoading } = useQuery({
    queryKey: ["routes", { agency_id: agencyId }],
    queryFn: () => fetchRoutes({ agency_id: agencyId, per_page: 200 }),
    enabled: !!agencyId,
    staleTime: 60_000,
  });

  const { data: vehiclesRes, isLoading: vehiclesLoading } = useQuery({
    queryKey: ["vehicles", { agency_id: agencyId }],
    queryFn: () => fetchVehicles({ agency_id: agencyId }),
    enabled: !!agencyId,
    staleTime: 60_000,
  });

  const routes   = routesRes?.data   ?? [];
  const vehicles = vehiclesRes?.data ?? [];

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      {/* Back */}
      <div>
        <Link to="/network/agencies">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ChevronLeftIcon className="size-4 mr-1" /> Agencies
          </Button>
        </Link>
      </div>

      {/* Agency header */}
      <div className="rounded-lg border bg-card p-5">
        {agencyLoading || !agency ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">{agency.agency_name}</h2>
              <p className="text-sm font-mono text-muted-foreground mt-0.5">{agency.agency_id}</p>
              <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
                {agency.agency_url && (
                  <a href={agency.agency_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <GlobeIcon className="size-3.5" />{agency.agency_url}
                  </a>
                )}
                {agency.agency_phone && (
                  <span className="flex items-center gap-1">
                    <PhoneIcon className="size-3.5" />{agency.agency_phone}
                  </span>
                )}
                {agency.agency_email && (
                  <span className="flex items-center gap-1">
                    <MailIcon className="size-3.5" />{agency.agency_email}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <ClockIcon className="size-3.5" />{agency.agency_timezone}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {agency.routes_count != null && (
                <div className="text-center px-4 py-2 rounded-lg bg-muted">
                  <p className="text-xl font-bold">{agency.routes_count}</p>
                  <p className="text-xs text-muted-foreground">Routes</p>
                </div>
              )}
              <div className="text-center px-4 py-2 rounded-lg bg-muted">
                <p className="text-xl font-bold">{vehicles.length}</p>
                <p className="text-xs text-muted-foreground">Vehicles</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Routes */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Routes ({routesLoading ? "…" : routes.length})</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Short Name</TableHead>
              <TableHead>Long Name</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routesLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {[1,2,3].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              : routes.length === 0
              ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No routes</TableCell></TableRow>
              : routes.map((r: Route) => (
                  <TableRow key={r.route_id}>
                    <TableCell>
                      <span className="font-semibold font-mono"
                        style={{ color: r.route_color ? `#${r.route_color}` : undefined }}>
                        {r.route_short_name}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{r.route_long_name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.route_type ?? "—"}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {/* Vehicles */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Vehicles ({vehiclesLoading ? "…" : vehicles.length})</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plate</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehiclesLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {[1,2,3,4,5].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              : vehicles.length === 0
              ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No vehicles</TableCell></TableRow>
              : vehicles.map((v: Vehicle) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono font-semibold">{v.plate}</TableCell>
                    <TableCell>{v.model ?? "—"}</TableCell>
                    <TableCell>{v.route?.route_short_name ?? v.route_id ?? "—"}</TableCell>
                    <TableCell>{v.capacity ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[v.status]}>
                        {v.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
