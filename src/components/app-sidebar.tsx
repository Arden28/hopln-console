import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboardIcon, GitPullRequestIcon, MapPinIcon,
  RouteIcon, UsersIcon, BarChart2Icon, BellIcon, ZapIcon, CalendarClockIcon,
  CalendarDaysIcon, DatabaseIcon, NetworkIcon, MapIcon, TrendingUpIcon,
  Share2Icon, HistoryIcon, FlaskConicalIcon, GitBranchIcon,
  TableIcon, ClockIcon, CalendarRangeIcon,
  ShieldCheckIcon, ScanSearchIcon, RouteOffIcon,
} from "lucide-react";
import { fetchOverview } from "@/api/dashboard";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const useSections = (pendingCount?: number) => [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", to: "/", icon: LayoutDashboardIcon },
    ],
  },
  {
    title: "Data",
    items: [
      { title: "Contributions", to: "/contributions", icon: GitPullRequestIcon, badge: pendingCount },
      { title: "Stops",         to: "/stops",          icon: MapPinIcon },
      { title: "Routes",        to: "/routes",         icon: RouteIcon },
      { title: "Trips",         to: "/trips",          icon: CalendarClockIcon },
      { title: "Calendars",     to: "/calendars",      icon: CalendarDaysIcon },
    ],
  },
  {
    title: "People",
    items: [
      { title: "Users", to: "/users", icon: UsersIcon },
    ],
  },
  {
    title: "Network",
    items: [
      { title: "Graph View",     to: "/network/graph",          icon: NetworkIcon },
      { title: "Coverage",       to: "/network/coverage",       icon: MapIcon },
      { title: "Desire Lines",   to: "/network/desire-lines",   icon: TrendingUpIcon },
      { title: "Corridors",      to: "/network/corridors",      icon: RouteIcon },
      { title: "Transfer Graph", to: "/network/transfer-graph", icon: Share2Icon },
      { title: "Snapshots",      to: "/network/snapshots",      icon: HistoryIcon },
      { title: "Scenarios",      to: "/network/scenarios",      icon: FlaskConicalIcon },
      { title: "Variants",       to: "/network/variants",       icon: GitBranchIcon },
    ],
  },
  {
    title: "Scheduling",
    items: [
      { title: "Timetable Editor",  to: "/timetable",   icon: TableIcon },
      { title: "Scheduling Tools",  to: "/scheduling",  icon: ClockIcon },
      { title: "Calendar Bulk",     to: "/calendars/bulk", icon: CalendarRangeIcon },
    ],
  },
  {
    title: "Operations",
    items: [
      { title: "GTFS",             to: "/gtfs",             icon: DatabaseIcon },
      { title: "Data Quality",     to: "/quality",          icon: ShieldCheckIcon },
      { title: "Shape Inspector",  to: "/quality/shapes",   icon: RouteOffIcon },
      { title: "Duplicate Stops",  to: "/stops/duplicates", icon: ScanSearchIcon },
    ],
  },
  {
    title: "Reach",
    items: [
      { title: "Analytics",     to: "/analytics",     icon: BarChart2Icon },
      { title: "Notifications", to: "/notifications", icon: BellIcon },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: overview } = useQuery({
    queryKey: ["dashboard:overview"],
    queryFn: fetchOverview,
    refetchInterval: 30_000,
  });

  const sections = useSections(overview?.pending_contributions);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5! hover:bg-transparent active:bg-transparent cursor-default"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                  <ZapIcon size={16} className="fill-current" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="font-semibold text-sm tracking-tight">Hopln</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Console</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain sections={sections} />
        <NavSecondary className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
