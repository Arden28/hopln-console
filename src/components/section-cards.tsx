import { useQuery } from "@tanstack/react-query";
import { fetchOverview } from "@/api/dashboard";
import { formatNumber } from "@/lib/utils";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersIcon, CalendarDaysIcon, NavigationIcon, GitPullRequestIcon } from "lucide-react";

export function SectionCards() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ["dashboard:overview"],
    queryFn: fetchOverview,
    refetchInterval: 60_000,
  });

  const cards = [
    {
      label: "Active Users Today",
      value: overview?.dau ?? 0,
      icon: UsersIcon,
      description: "Daily active users on the platform",
    },
    {
      label: "Active Users This Month",
      value: overview?.mau ?? 0,
      icon: CalendarDaysIcon,
      description: "Monthly active users",
    },
    {
      label: "Journeys Today",
      value: overview?.journeys_today ?? 0,
      icon: NavigationIcon,
      description: "Route calculations today",
    },
    {
      label: "Pending Contributions",
      value: overview?.pending_contributions ?? 0,
      icon: GitPullRequestIcon,
      description: "Community submissions awaiting review",
      highlight: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Card key={card.label} className="@container/card">
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <span className={card.highlight && card.value > 0 ? "text-primary" : undefined}>
                  {formatNumber(card.value)}
                </span>
              )}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <card.icon className="size-3" />
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="text-muted-foreground">{card.description}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
