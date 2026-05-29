import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchWallets } from "@/api/ledger";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronRightIcon } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

const ENTITY_COLORS: Record<string, string> = {
  vehicle:  "bg-blue-100 text-blue-700 border-blue-200",
  agency:   "bg-purple-100 text-purple-700 border-purple-200",
  platform: "bg-slate-100 text-slate-700 border-slate-200",
};

export function WalletsPage() {
  const [entityType, setEntityType] = React.useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["ledger:wallets", entityType],
    queryFn: () => fetchWallets({
      entity_type: entityType === "all" ? undefined : entityType as "vehicle" | "agency" | "platform",
    }),
    staleTime: 30_000,
  });

  const wallets = data ?? [];

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All wallets</SelectItem>
            <SelectItem value="vehicle">Vehicle</SelectItem>
            <SelectItem value="agency">Agency (SACCO)</SelectItem>
            <SelectItem value="platform">Platform</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Last Credited</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {[1,2,3,4,5,6].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              : wallets.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No wallets
                    </TableCell>
                  </TableRow>
                )
              : wallets.map(w => (
                  <TableRow key={w.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell className="font-mono text-sm">{w.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ENTITY_COLORS[w.entity_type] ?? ""}>
                        {w.entity_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmt(w.balance)}</TableCell>
                    <TableCell>{w.currency}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {w.last_credited_at
                        ? new Date(w.last_credited_at).toLocaleDateString("en-KE")
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <Link to="/ledger/wallets/$walletId" params={{ walletId: String(w.id) }}>
                        <ChevronRightIcon className="size-4 text-muted-foreground" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
