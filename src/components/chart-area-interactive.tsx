import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fetchJourneyAnalytics } from "@/api/analytics";

interface JourneyPoint {
  date: string;
  total: number;
  standard: number;
  ai_planned: number;
}

const chartConfig = {
  journeys: { label: "Journeys" },
  total:      { label: "Total",    color: "var(--primary)" },
  standard:   { label: "Standard", color: "var(--chart-3)" },
  ai_planned: { label: "AI",       color: "var(--chart-2)" },
} satisfies ChartConfig;

const toArray = <T,>(r: { data: unknown }): T[] =>
  Array.isArray(r.data) ? (r.data as T[]) : ((r.data as { data?: T[] })?.data ?? []);

export function ChartAreaInteractive() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("30d");

  React.useEffect(() => {
    if (isMobile) setTimeRange("7d");
  }, [isMobile]);

  const { data: journeys = [] } = useQuery<JourneyPoint[]>({
    queryKey: ["analytics-journeys", timeRange],
    queryFn: () => fetchJourneyAnalytics(timeRange).then((r) => toArray<JourneyPoint>(r as { data: unknown })),
    staleTime: 60_000,
  });

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Journey Volume</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Route calculations over time
          </span>
          <span className="@[540px]/card:hidden">Journey trends</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">90 days</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-36 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select time range"
            >
              <SelectValue placeholder="30 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">Last 90 days</SelectItem>
              <SelectItem value="30d" className="rounded-lg">Last 30 days</SelectItem>
              <SelectItem value="7d"  className="rounded-lg">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-62.5 w-full">
          <AreaChart data={journeys}>
            <defs>
              <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillStandard" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--chart-3)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(v) =>
                new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={4} width={32} tick={{ fontSize: 11 }} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(v) =>
                    new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="total"
              type="monotone"
              fill="url(#fillTotal)"
              stroke="var(--primary)"
              strokeWidth={2}
            />
            <Area
              dataKey="standard"
              type="monotone"
              fill="url(#fillStandard)"
              stroke="var(--chart-3)"
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
