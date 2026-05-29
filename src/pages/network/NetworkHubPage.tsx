import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  NetworkIcon,
  MapIcon,
  TrendingUpIcon,
  RouteIcon,
  Share2Icon,
  HistoryIcon,
  FlaskConicalIcon,
  GitBranchIcon,
} from "lucide-react";
import { fetchNetworkGraph } from "@/api/network";
import { fetchCorridors } from "@/api/corridors";
import { fetchScenarios } from "@/api/scenarios";

const tools = [
  {
    title: "Graph View",
    desc: "Visualize all stops and routes as an interactive network map.",
    to: "/network/graph",
    icon: NetworkIcon,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/20",
  },
  {
    title: "Coverage & Walkshed",
    desc: "Heatmap of stop density, walk-shed polygons, and transit reachability.",
    to: "/network/coverage",
    icon: MapIcon,
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-950/20",
  },
  {
    title: "Desire Lines",
    desc: "Visualize origin–destination demand from journey logs.",
    to: "/network/desire-lines",
    icon: TrendingUpIcon,
    color: "text-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/20",
  },
  {
    title: "Corridors",
    desc: "Design and manage transit corridors with assigned routes.",
    to: "/network/corridors",
    icon: RouteIcon,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-950/20",
  },
  {
    title: "Transfer Graph",
    desc: "Analyze pedestrian transfer opportunities between nearby stops.",
    to: "/network/transfer-graph",
    icon: Share2Icon,
    color: "text-cyan-500",
    bg: "bg-cyan-50 dark:bg-cyan-950/20",
  },
  {
    title: "Snapshots",
    desc: "Browse the append-only history of every network entity change.",
    to: "/network/snapshots",
    icon: HistoryIcon,
    color: "text-slate-500",
    bg: "bg-slate-50 dark:bg-slate-950/20",
  },
  {
    title: "Scenarios",
    desc: "Draft and publish what-if network changes without touching production.",
    to: "/network/scenarios",
    icon: FlaskConicalIcon,
    color: "text-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
  },
  {
    title: "Route Variants",
    desc: "Compare route patterns and manage canonical trip shapes.",
    to: "/network/variants",
    icon: GitBranchIcon,
    color: "text-pink-500",
    bg: "bg-pink-50 dark:bg-pink-950/20",
  },
];

export default function NetworkHubPage() {
  const { data: graph } = useQuery({
    queryKey: ["network:graph"],
    queryFn: fetchNetworkGraph,
    staleTime: 60_000,
  });
  const { data: corridors } = useQuery({
    queryKey: ["corridors"],
    queryFn: fetchCorridors,
    staleTime: 60_000,
  });
  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: fetchScenarios,
    staleTime: 60_000,
  });

  const stats = [
    { label: "Stops", value: graph?.nodes.length ?? "—" },
    { label: "Routes", value: graph ? new Set(graph.edges.map((e) => e.route_id)).size : "—" },
    { label: "Corridors", value: corridors?.length ?? "—" },
    { label: "Scenarios", value: scenarios?.length ?? "—" },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Network Modeling</h1>
        <p className="text-sm text-muted-foreground">
          Design, analyze, and maintain your transit network.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border px-4 py-3">
            <div className="text-2xl font-bold tabular-nums">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.to}
              to={tool.to}
              className="group rounded-xl border p-5 hover:border-primary/50 hover:shadow-sm transition-all flex flex-col gap-3"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tool.bg}`}>
                <Icon size={18} className={tool.color} />
              </div>
              <div>
                <div className="font-medium text-sm group-hover:text-primary transition-colors">
                  {tool.title}
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {tool.desc}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
