import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiService } from "@/api/client";
import { fetchOtpStatus, fetchOtpLog, triggerOtpSync, type OtpLogEntry } from "@/api/otp";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2Icon, RefreshCwIcon, TrophyIcon, UserIcon, ServerIcon } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type SettingsTab = "profile" | "otp" | "badges";

interface BadgeItem {
  id: string;
  name: string;
  description: string;
  points_required: number;
  icon?: string;
}


function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const [name, setName] = React.useState(user?.name ?? "");
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [currentPw, setCurrentPw] = React.useState("");
  const [newPw, setNewPw] = React.useState("");
  const [confirmPw, setConfirmPw] = React.useState("");

  const saveMutation = useMutation({
    mutationFn: () => apiService.put("/v1/console/profile", { name, email }),
    onSuccess: () => toast.success("Profile updated"),
    onError: () => toast.error("Failed to update profile"),
  });

  const pwMutation = useMutation({
    mutationFn: () =>
      apiService.put("/v1/console/profile/password", {
        current_password: currentPw,
        password: newPw,
        password_confirmation: confirmPw,
      }),
    onSuccess: () => {
      toast.success("Password changed");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    },
    onError: () => toast.error("Failed to change password"),
  });

  const canSaveProfile = name !== user?.name || email !== user?.email;
  const canSavePw = currentPw && newPw && newPw === confirmPw;

  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Profile information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground">Role</Label>
            <Badge variant="outline" className="text-xs capitalize">{user?.role}</Badge>
          </div>
          <Button
            disabled={!canSaveProfile || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Save profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Change password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-pw">Current password</Label>
            <Input id="current-pw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">New password</Label>
            <Input id="new-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pw">Confirm new password</Label>
            <Input id="confirm-pw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
          </div>
          {newPw && confirmPw && newPw !== confirmPw && (
            <p className="text-xs text-destructive">Passwords do not match</p>
          )}
          <Button
            disabled={!canSavePw || pwMutation.isPending}
            onClick={() => pwMutation.mutate()}
          >
            {pwMutation.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Change password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function OtpTab() {
  const qc = useQueryClient();

  const { data: status, isLoading: loadingStatus } = useQuery({
    queryKey: ["otp:status"],
    queryFn: fetchOtpStatus,
    refetchInterval: 30_000,
  });

  const { data: log = [], isLoading: loadingLog } = useQuery({
    queryKey: ["otp:log"],
    queryFn: async () => {
      const page = await fetchOtpLog({ per_page: 20 });
      return page.data;
    },
    staleTime: 60_000,
  });

  const syncMutation = useMutation({
    mutationFn: triggerOtpSync,
    onSuccess: (data) => {
      toast.success(data.message ?? "OTP sync triggered");
      qc.invalidateQueries({ queryKey: ["otp:status"] });
      qc.invalidateQueries({ queryKey: ["otp:log"] });
    },
    onError: () => toast.error("Failed to trigger OTP sync"),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">OTP Engine status</CardTitle>
          <CardDescription>OpenTripPlanner routing engine health and sync</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingStatus ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  className={status?.status === "healthy"
                    ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950"
                    : "text-destructive border-destructive/30 bg-destructive/10"
                  }
                >
                  {status?.status ?? "Unknown"}
                </Badge>
              </div>
              {status?.last_sync && (
                <div className="text-sm text-muted-foreground">
                  Last sync: <span className="text-foreground">{formatDateTime(status.last_sync)}</span>
                </div>
              )}
              {status?.gtfs_build_date && (
                <div className="text-sm text-muted-foreground">
                  GTFS build date: <span className="text-foreground">{status.gtfs_build_date}</span>
                </div>
              )}
            </>
          )}
          <Button
            variant="outline"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending
              ? <Loader2Icon className="mr-2 size-4 animate-spin" />
              : <RefreshCwIcon className="mr-2 size-4" />
            }
            Trigger sync
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sync log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingLog ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : log.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                    No sync log entries
                  </TableCell>
                </TableRow>
              ) : (
                log.slice(0, 20).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm font-medium">{entry.event}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${entry.status === "success"
                          ? "text-emerald-600 border-emerald-200"
                          : "text-destructive border-destructive/30"
                        }`}
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-64 truncate">
                      {entry.message ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(entry.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function BadgesTab() {
  const { data: badges = [], isLoading } = useQuery<BadgeItem[]>({
    queryKey: ["badges"],
    queryFn: async () => {
      const r = await apiService.get<BadgeItem[] | { data: BadgeItem[] }>("/v1/console/badges");
      return Array.isArray(r.data) ? r.data : (r.data as { data: BadgeItem[] }).data ?? [];
    },
    staleTime: 120_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Platform badges</CardTitle>
        <CardDescription>Achievement badges automatically awarded to contributors</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : badges.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No badges configured</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {badges.map((badge) => (
              <div key={badge.id} className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center hover:bg-muted/30 transition-colors">
                <TrophyIcon className="size-8 text-primary" />
                <div>
                  <p className="text-sm font-medium leading-tight">{badge.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{badge.description}</p>
                  {badge.points_required > 0 && (
                    <Badge variant="outline" className="text-xs mt-2">
                      {badge.points_required} pts
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const [tab, setTab] = React.useState<SettingsTab>("profile");

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: "Profile", icon: UserIcon },
    { id: "otp", label: "OTP Engine", icon: ServerIcon },
    { id: "badges", label: "Badges", icon: TrophyIcon },
  ];

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6 lg:flex-row lg:items-start">
      {/* Side nav */}
      <nav className="flex flex-row gap-1 lg:flex-col lg:w-44 lg:shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left w-full
              ${tab === t.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
          >
            <t.icon className="size-4 shrink-0" />
            {t.label}
          </button>
        ))}
      </nav>

      <Separator orientation="vertical" className="hidden lg:block h-auto self-stretch" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {tab === "profile" && <ProfileTab />}
        {tab === "otp" && <OtpTab />}
        {tab === "badges" && <BadgesTab />}
      </div>
    </div>
  );
}
