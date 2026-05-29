import { useQuery } from "@tanstack/react-query";
import { fetchActivity, fetchSystemHealth } from "@/api/dashboard";
import { SectionCards } from "@/components/section-cards";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo, formatDateTime } from "@/lib/utils";
import {
  CheckCircle2Icon,
  XCircleIcon,
  AlertCircleIcon,
  ActivityIcon,
  DatabaseIcon,
  CpuIcon,
  RefreshCwIcon,
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  user?: string;
  created_at: string;
}

function ActivityIcon2({ type }: { type: string }) {
  if (type.includes("approve") || type.includes("accept"))
    return <CheckCircle2Icon className="size-4 text-emerald-500 shrink-0" />;
  if (type.includes("decline") || type.includes("reject") || type.includes("ban"))
    return <XCircleIcon className="size-4 text-destructive shrink-0" />;
  return <ActivityIcon className="size-4 text-muted-foreground shrink-0" />;
}

function HealthIndicator({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      {ok === undefined ? (
        <Badge variant="outline" className="text-xs">Unknown</Badge>
      ) : ok ? (
        <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950">Healthy</Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-destructive border-destructive/30 bg-destructive/10">Degraded</Badge>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { data: activity = [], isLoading: loadingActivity } = useQuery<ActivityItem[]>({
    queryKey: ["dashboard:activity"],
    queryFn: fetchActivity as () => Promise<ActivityItem[]>,
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  const { data: health, isLoading: loadingHealth } = useQuery({
    queryKey: ["dashboard:health"],
    queryFn: fetchSystemHealth,
    refetchInterval: 30_000,
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col gap-6">
      <SectionCards />
      <ChartAreaInteractive />

      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 lg:grid-cols-3">
        {/* Activity feed — 2/3 */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <ActivityIcon className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {loadingActivity ? (
              <div className="space-y-3 px-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-4 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <ul className="divide-y">
                {activity.slice(0, 10).map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-6 py-3 hover:bg-muted/30 transition-colors">
                    <div className="mt-0.5">
                      <ActivityIcon2 type={item.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{item.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.user && <span className="font-medium">{item.user} · </span>}
                        {timeAgo(item.created_at)}
                      </p>
                    </div>
                    <time className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                      {formatDateTime(item.created_at).split(" ").slice(0, 2).join(" ")}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* System health — 1/3 */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <CpuIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingHealth ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <div className="divide-y">
                  <HealthIndicator ok={health?.api_ok} label="API Server" />
                  <HealthIndicator ok={health?.db_ok} label="Database" />
                  <HealthIndicator ok={health?.otp_ok} label="OTP Engine" />
                  <HealthIndicator ok={health?.queue_ok} label="Queue Worker" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <DatabaseIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Queue</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingHealth ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold tabular-nums">
                    {health?.queue_depth ?? 0}
                  </span>
                  <span className="text-sm text-muted-foreground pb-0.5">jobs pending</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <RefreshCwIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <a
                href="/contributions"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <AlertCircleIcon className="size-4 text-primary" />
                Review contributions
              </a>
              <a
                href="/stops/new"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <ActivityIcon className="size-4 text-primary" />
                Add new stop
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
