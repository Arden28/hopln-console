import * as React from "react";
import { useParams, useRouter, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchUser, banUser, unbanUser, adjustPoints, revokeBadge } from "@/api/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatNumber, timeAgo } from "@/lib/utils";
import {
  ArrowLeftIcon,
  ShieldBanIcon,
  ShieldCheckIcon,
  StarIcon,
  TrophyIcon,
  XIcon,
} from "lucide-react";
import type { Role } from "@/types";

const ROLE_COLORS: Record<Role, string> = {
  user: "bg-slate-100 text-slate-700 border-slate-200",
  moderator: "bg-blue-100 text-blue-700 border-blue-200",
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  superadmin: "bg-primary/10 text-primary border-primary/20",
};

export function UserDetailPage() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const router = useRouter();
  const qc = useQueryClient();
  const [pointsDelta, setPointsDelta] = React.useState("");
  const [banReason, setBanReason] = React.useState("");
  const [showBanForm, setShowBanForm] = React.useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: () => fetchUser(id!),
    enabled: !!id,
  });

  const banMutation = useMutation({
    mutationFn: () => banUser(id!, banReason),
    onSuccess: () => {
      toast.success("User banned");
      setBanReason("");
      setShowBanForm(false);
      qc.invalidateQueries({ queryKey: ["user", id] });
    },
    onError: () => toast.error("Failed to ban user"),
  });

  const unbanMutation = useMutation({
    mutationFn: () => unbanUser(id!),
    onSuccess: () => {
      toast.success("User unbanned");
      qc.invalidateQueries({ queryKey: ["user", id] });
    },
    onError: () => toast.error("Failed to unban user"),
  });

  const pointsMutation = useMutation({
    mutationFn: () => adjustPoints(id!, Number(pointsDelta)),
    onSuccess: () => {
      toast.success(`Points adjusted by ${pointsDelta}`);
      setPointsDelta("");
      qc.invalidateQueries({ queryKey: ["user", id] });
    },
    onError: () => toast.error("Failed to adjust points"),
  });

  const revokeBadgeMutation = useMutation({
    mutationFn: (badgeId: string) => revokeBadge(id!, badgeId),
    onSuccess: () => {
      toast.success("Badge revoked");
      qc.invalidateQueries({ queryKey: ["user", id] });
    },
    onError: () => toast.error("Failed to revoke badge"),
  });

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => router.history.back()}>
        <ArrowLeftIcon className="mr-1.5 size-4" />
        Back to users
      </Button>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
            {isLoading ? (
              <>
                <Skeleton className="size-20 rounded-full" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-44" />
              </>
            ) : user ? (
              <>
                <Avatar className="size-20">
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h2 className="font-semibold text-lg">{user.name}</h2>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                  <Badge variant="outline" className={ROLE_COLORS[user.role]}>{user.role}</Badge>
                  {user.is_banned && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300">
                      Banned
                    </Badge>
                  )}
                </div>

                <Separator className="w-full" />

                <div className="w-full space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Points</span>
                    <span className="font-mono font-medium">{formatNumber(user.points)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Joined</span>
                    <span>{formatDate(user.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last active</span>
                    <span>{user.last_seen_at ? timeAgo(user.last_seen_at) : "—"}</span>
                  </div>
                </div>

                <Separator className="w-full" />

                {/* Ban / Unban */}
                {user.is_banned ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    disabled={unbanMutation.isPending}
                    onClick={() => unbanMutation.mutate()}
                  >
                    <ShieldCheckIcon className="mr-1.5 size-3.5" />
                    Unban user
                  </Button>
                ) : showBanForm ? (
                  <div className="w-full space-y-2">
                    <Input
                      placeholder="Ban reason…"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowBanForm(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        disabled={banMutation.isPending}
                        onClick={() => banMutation.mutate()}
                      >
                        Confirm ban
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setShowBanForm(true)}
                  >
                    <ShieldBanIcon className="mr-1.5 size-3.5" />
                    Ban user
                  </Button>
                )}

                {/* Points adjustment */}
                <div className="w-full space-y-2">
                  <Label className="text-xs text-muted-foreground">Adjust points</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="e.g. +50 or -10"
                      value={pointsDelta}
                      onChange={(e) => setPointsDelta(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!pointsDelta || pointsMutation.isPending}
                      onClick={() => pointsMutation.mutate()}
                    >
                      <StarIcon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">User not found</p>
            )}
          </CardContent>
        </Card>

        {/* Tabs — contributions & badges */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="contributions">
            <TabsList className="mb-4">
              <TabsTrigger value="contributions">Contributions</TabsTrigger>
              <TabsTrigger value="badges">Badges</TabsTrigger>
            </TabsList>

            <TabsContent value="contributions">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Contribution history</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : !user?.contributions?.length ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No contributions yet</p>
                  ) : (
                    <ul className="divide-y">
                      {user.contributions.map((c) => (
                        <li key={c.id} className="flex items-center justify-between py-2.5 gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.description || "—"}</p>
                            <p className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-xs">{c.type}</Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs ${c.status === "approved" ? "text-emerald-600" : c.status === "declined" ? "text-destructive" : "text-yellow-600"}`}
                            >
                              {c.status}
                            </Badge>
                            <Link to="/contributions/$id" params={{ id: c.id }} className="text-xs text-primary hover:underline">
                              View
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="badges">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Earned badges</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
                    </div>
                  ) : !user?.badges?.length ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No badges earned yet</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {user.badges.map((badge) => (
                        <div key={badge.id} className="relative flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center group">
                          <TrophyIcon className="size-6 text-primary" />
                          <p className="text-xs font-medium leading-tight">{badge.name}</p>
                          <p className="text-[10px] text-muted-foreground">{badge.description}</p>
                          <button
                            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => revokeBadgeMutation.mutate(badge.id)}
                            title="Revoke badge"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
