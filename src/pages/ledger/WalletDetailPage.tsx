import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { fetchWalletTransactions } from "@/api/ledger";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { WalletTransaction } from "@/types";

function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

const TYPE_COLORS: Record<string, string> = {
  credit:  "bg-green-100 text-green-700 border-green-200",
  debit:   "bg-red-100 text-red-700 border-red-200",
  hold:    "bg-amber-100 text-amber-700 border-amber-200",
  release: "bg-blue-100 text-blue-700 border-blue-200",
};

export function WalletDetailPage() {
  const { walletId } = useParams({ strict: false }) as { walletId: string };
  const id = parseInt(walletId ?? "0");

  const [txType, setTxType] = React.useState("all");

  const { data: txPage, isLoading } = useQuery({
    queryKey: ["ledger:transactions", id, txType],
    queryFn: () => fetchWalletTransactions(id, { type: txType === "all" ? undefined : txType }),
    enabled: id > 0,
    staleTime: 15_000,
  });

  const wallet: Wallet | undefined = txPage?.wallet;
  const transactions = txPage?.transactions?.data ?? [];

  // Build balance timeline for chart (reverse to chronological order)
  const chartData = [...transactions].reverse().map(t => ({
    date: new Date(t.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric" }),
    balance: t.balance_after,
  }));

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      {/* Wallet header */}
      <div className="rounded-lg border bg-card p-5">
        {!wallet ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-32" />
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground capitalize">{wallet.entity_type} wallet</p>
              <p className="text-sm font-mono text-muted-foreground">{wallet.label}</p>
              <p className="text-3xl font-bold mt-1">{fmt(wallet.balance)}</p>
              {wallet.last_credited_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last credited {new Date(wallet.last_credited_at).toLocaleString("en-KE")}
                </p>
              )}
            </div>
            <Badge variant="outline">{wallet.currency}</Badge>
          </div>
        )}
      </div>

      {/* Balance timeline */}
      {chartData.length > 1 && (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-semibold mb-3">Balance Timeline</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
                tick={{ fontSize: 11 }}
                width={48}
              />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Line type="monotone" dataKey="balance" stroke="#2563eb" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Transaction log */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">Transactions</h3>
          <Select value={txType} onValueChange={setTxType}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
              <SelectItem value="debit">Debit</SelectItem>
              <SelectItem value="hold">Hold</SelectItem>
              <SelectItem value="release">Release</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance After</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {[1,2,3,4,5,6].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              : transactions.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No transactions
                    </TableCell>
                  </TableRow>
                )
              : transactions.map((t: WalletTransaction) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(t.created_at).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TYPE_COLORS[t.type] ?? ""}>
                        {t.type}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-mono font-medium ${
                      t.type === "credit" || t.type === "release" ? "text-green-600" : "text-red-600"
                    }`}>
                      {t.type === "credit" || t.type === "release" ? "+" : "-"}{fmt(t.amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmt(t.balance_after)}</TableCell>
                    <TableCell className="font-mono text-xs">{t.reference ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.description ?? "—"}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
