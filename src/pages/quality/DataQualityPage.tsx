import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCwIcon, ChevronDownIcon, ChevronUpIcon, ExternalLinkIcon } from "lucide-react";
import { fetchQualityScore, fetchDrillDown } from "@/api/quality";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";
import type { DataQualityScore, QualityMetric } from "@/types";

// ── Gauge ─────────────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const color =
    score >= 70 ? "hsl(142,71%,45%)" :
    score >= 40 ? "hsl(38,92%,50%)"  :
                  "hsl(0,84%,60%)";

  return (
    <div className="relative flex flex-col items-center">
      <div className="w-48 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="90%"
            startAngle={220}
            endAngle={-40}
            data={[{ value: score, fill: color }]}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" background={{ fill: "hsl(var(--muted))" }} cornerRadius={6} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold" style={{ color }}>{Math.round(score)}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ metric, onDuplicate }: { metric: QualityMetric; onDuplicate?: () => void }) {
  const [open, setOpen] = React.useState(false);
  const queryClient    = useQueryClient();

  const drillQuery = useQuery({
    queryKey: ["quality:drill-down", metric.key],
    queryFn:  () => fetchDrillDown(metric.key),
    enabled:  open,
  });

  const isGood = metric.inverse ? metric.value === 0 : metric.score >= 90;
  const isBad  = metric.inverse ? metric.value > 5   : metric.score < 40;

  const badgeVariant = isGood ? "default" : isBad ? "destructive" : "secondary";
  const badgeLabel   = metric.inverse
    ? String(metric.value)
    : `${metric.score}% (${metric.value}/${metric.total})`;

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{metric.label}</p>
          {!metric.inverse && (
            <p className="text-xs text-muted-foreground">{metric.value} of {metric.total}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          {metric.key === "duplicate_stop_pairs" && onDuplicate ? (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDuplicate}>
              Open detector <ExternalLinkIcon size={12} className="ml-1" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t pt-2 text-xs">
          {drillQuery.isLoading && <Skeleton className="h-20 w-full" />}
          {drillQuery.data && drillQuery.data.data.length === 0 && (
            <p className="text-muted-foreground italic">No issues found.</p>
          )}
          {drillQuery.data && drillQuery.data.data.length > 0 && (
            <div className="max-h-60 overflow-auto">
              <table className="w-full text-left">
                <tbody>
                  {(drillQuery.data.data as Record<string, unknown>[]).slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {Object.entries(row).slice(0, 4).map(([k, v]) => (
                        <td key={k} className="py-1 pr-3 text-muted-foreground">
                          <span className="text-foreground/60">{k}: </span>
                          {String(v ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DataQualityPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<DataQualityScore>({
    queryKey: ["quality:score"],
    queryFn:  () => fetchQualityScore(),
  });

  const refreshMutation = useMutation({
    mutationFn: () => fetchQualityScore(true),
    onSuccess: (fresh) => {
      queryClient.setQueryData(["quality:score"], fresh);
      toast.success("Quality score refreshed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function goToDuplicates() {
    window.location.href = "/stops/duplicates";
  }

  return (
    <div className="flex flex-col gap-6 p-4 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Data Quality</h1>
          {data && (
            <p className="text-xs text-muted-foreground">
              Last computed {new Date(data.computed_at).toLocaleString()}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCwIcon size={14} className={refreshMutation.isPending ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}

      {data && (
        <>
          {/* Score gauge */}
          <div className="flex flex-col items-center gap-2 py-4">
            <ScoreGauge score={data.overall} />
            <p className="text-sm text-muted-foreground">Overall data quality score</p>
          </div>

          {/* Metric cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.metrics.map((m) => (
              <MetricCard
                key={m.key}
                metric={m}
                onDuplicate={m.key === "duplicate_stop_pairs" ? goToDuplicates : undefined}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
