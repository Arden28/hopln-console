import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFleetRevenue, fetchRouteRevenue, fetchWallets } from "@/api/ledger";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BanknoteIcon, TruckIcon, BuildingIcon, GlobeIcon } from "lucide-react";

function KpiCard({
  label, value, sub, icon: Icon,
}: { label: string; value: string; sub?: string; icon: React.ElementType }) {
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

function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

export function LedgerDashboardPage() {
  const [period, setPeriod] = React.useState<"7d" | "30d" | "90d">("7d");

  const { data: fleet = [], isLoading: fleetLoading } = useQuery({
    queryKey: ["ledger:fleet-revenue", period],
    queryFn: () => fetchFleetRevenue({ period }),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const { data: routeRevenue = [], isLoading: routeLoading } = useQuery({
    queryKey: ["ledger:route-revenue", period],
    queryFn: () => fetchRouteRevenue({ period }),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const { data: wallets = [] } = useQuery({
    queryKey: ["ledger:wallets"],
    queryFn: () => fetchWallets(),
    staleTime: 30_000,
  });

  const totalFloat = wallets.reduce((s, w) => s + w.balance, 0);
  const vehicleFloat = wallets.filter(w => w.entity_type === "vehicle").reduce((s, w) => s + w.balance, 0);
  const saccoFloat   = wallets.filter(w => w.entity_type === "agency").reduce((s, w) => s + w.balance, 0);
  const platformFloat= wallets.filter(w => w.entity_type === "platform").reduce((s, w) => s + w.balance, 0);

  const totalRevenue = fleet.reduce((s, r) => s + r.total_revenue, 0);
  const totalSplits  = fleet.reduce((s, r) => s + r.split_count, 0);

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Settlement Overview</h2>
        <Select value={period} onValueChange={v => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Wallet float KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Float" value={fmt(totalFloat)} icon={BanknoteIcon} />
        <KpiCard label="Vehicle Wallets" value={fmt(vehicleFloat)} sub={`${wallets.filter(w => w.entity_type === "vehicle").length} wallets`} icon={TruckIcon} />
        <KpiCard label="SACCO Wallets" value={fmt(saccoFloat)} sub={`${wallets.filter(w => w.entity_type === "agency").length} wallets`} icon={BuildingIcon} />
        <KpiCard label="Platform Wallet" value={fmt(platformFloat)} icon={GlobeIcon} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue per vehicle */}
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Revenue per Vehicle</h3>
            <span className="text-xs text-muted-foreground">{fmt(totalRevenue)} · {totalSplits} trips</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plate</TableHead>
                <TableHead>Route</TableHead>
                <TableHead className="text-right">Trips</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fleetLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {[1,2,3,4].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                    </TableRow>
                  ))
                : fleet.length === 0
                ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
                : fleet.slice(0, 10).map(r => (
                    <TableRow key={r.vehicle_id}>
                      <TableCell className="font-mono font-semibold">{r.plate}</TableCell>
                      <TableCell>{r.route_id ?? "—"}</TableCell>
                      <TableCell className="text-right">{r.split_count}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(r.total_revenue)}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>

        {/* Revenue per route */}
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">Revenue per Route</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead className="text-right">Trips</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routeLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {[1,2,3].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                    </TableRow>
                  ))
                : routeRevenue.length === 0
                ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
                : routeRevenue.map(r => (
                    <TableRow key={r.route_id}>
                      <TableCell>
                        <span className="font-semibold">{r.route_short_name ?? r.route_id}</span>
                        {r.route_short_name && <span className="text-xs text-muted-foreground ml-1">({r.route_id})</span>}
                      </TableCell>
                      <TableCell className="text-right">{r.split_count}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(r.total_revenue)}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
