import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  fetchAnalyticsOverview,
  fetchJourneyAnalytics,
  fetchTopSearches,
  fetchContributionAnalytics,
  fetchUserGrowth,
} from "@/api/analytics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatNumber } from "@/lib/utils";
import { NavigationIcon, UsersIcon, GitPullRequestIcon } from "lucide-react";

function toArray<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[];
  const obj = r as { data?: T[] } | null | undefined;
  return obj?.data ?? [];
}

type Range = "7d" | "30d" | "90d";

interface JourneyPoint { date: string; total: number; standard: number; ai_planned: number }
interface UserGrowthPoint { date: string; new_users: number; total_users: number }
interface ContribPoint { date: string; submitted: number; approved: number; declined: number }
interface SearchPair { od_pair: string; count: number }

export function AnalyticsPage() {
  const [range, setRange] = React.useState<Range>("30d");

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["analytics:overview"],
    queryFn: fetchAnalyticsOverview,
    staleTime: 60_000,
  });

  const { data: journeys = [] } = useQuery<JourneyPoint[]>({
    queryKey: ["analytics:journeys", range],
    queryFn: () => fetchJourneyAnalytics(range).then((r: unknown) => toArray<JourneyPoint>(r)),
    staleTime: 60_000,
  });

  const { data: userGrowth = [] } = useQuery<UserGrowthPoint[]>({
    queryKey: ["analytics:user-growth", range],
    queryFn: () => fetchUserGrowth(range).then((r: unknown) => toArray<UserGrowthPoint>(r)),
    staleTime: 60_000,
  });

  const { data: contributions = [] } = useQuery<ContribPoint[]>({
    queryKey: ["analytics:contributions", range],
    queryFn: () => fetchContributionAnalytics(range).then((r: unknown) => toArray<ContribPoint>(r)),
    staleTime: 60_000,
  });

  const { data: topSearches = [] } = useQuery<SearchPair[]>({
    queryKey: ["analytics:top-searches"],
    queryFn: () =>
      fetchTopSearches().then((r: unknown) =>
        toArray<{ origin_name: string; destination_name: string; count: number }>(r).map(
          ({ origin_name, destination_name, count }) => ({
            od_pair: `${origin_name} → ${destination_name}`,
            count,
          })
        )
      ),
    staleTime: 60_000,
  });

  const dateFormatter = (v: unknown) =>
    new Date(String(v)).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const kpis = [
    { label: "Total Journeys", value: overview?.total_journeys, icon: NavigationIcon },
    { label: "Unique Users", value: overview?.unique_users, icon: UsersIcon },
    { label: "Accepted Contributions", value: overview?.accepted_contributions, icon: GitPullRequestIcon },
  ];

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingOverview ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-3xl font-bold tabular-nums">{formatNumber(kpi.value ?? 0)}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Range switcher */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Time range:</span>
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={(v) => v && setRange(v as Range)}
          variant="outline"
        >
          <ToggleGroupItem value="7d" className="px-4">7 days</ToggleGroupItem>
          <ToggleGroupItem value="30d" className="px-4">30 days</ToggleGroupItem>
          <ToggleGroupItem value="90d" className="px-4">90 days</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Journey volume — area chart */}
      <Card>
        <CardHeader>
          <CardTitle>Journey Volume</CardTitle>
          <CardDescription>Total, standard, and AI-planned routes over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={journeys}>
              <defs>
                <linearGradient id="aTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tickFormatter={dateFormatter} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={dateFormatter} />
              <Legend />
              <Area dataKey="total" name="Total" stroke="var(--primary)" fill="url(#aTotal)" strokeWidth={2} />
              <Area dataKey="standard" name="Standard" stroke="var(--chart-3)" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
              <Area dataKey="ai_planned" name="AI Planned" stroke="var(--chart-2)" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* User growth — line chart */}
        <Card>
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>New signups and cumulative users</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={userGrowth}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tickFormatter={dateFormatter} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={dateFormatter} />
                <Legend />
                <Line dataKey="new_users" name="New users" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                <Line dataKey="total_users" name="Total users" stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Community contributions — stacked bar */}
        <Card>
          <CardHeader>
            <CardTitle>Community Engagement</CardTitle>
            <CardDescription>Contribution submissions by outcome</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={contributions}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tickFormatter={dateFormatter} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={dateFormatter} />
                <Legend />
                <Bar dataKey="submitted" name="Submitted" stackId="a" fill="var(--chart-5)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="approved" name="Approved" stackId="a" fill="var(--chart-3)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="declined" name="Declined" stackId="a" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top OD pairs — horizontal bar */}
      <Card>
        <CardHeader>
          <CardTitle>Top Origin-Destination Pairs</CardTitle>
          <CardDescription>Most frequently searched routes</CardDescription>
        </CardHeader>
        <CardContent>
          {topSearches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data available</p>
          ) : (
            <div className="space-y-3">
              {topSearches.slice(0, 8).map((pair, i) => {
                const max = topSearches[0]?.count ?? 1;
                const pct = (pair.count / max) * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <span className="text-sm truncate flex-1">{pair.od_pair}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <Badge variant="outline" className="text-xs tabular-nums w-12 justify-center">
                        {formatNumber(pair.count)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
