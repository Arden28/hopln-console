import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchNotifications, broadcastNotification } from "@/api/notifications";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2Icon, SendIcon, BellIcon, SmartphoneIcon } from "lucide-react";
import { formatDateTime, formatNumber } from "@/lib/utils";

interface BroadcastForm {
  title: string;
  body: string;
  type: string;
  audience: string;
}

const TYPE_LABELS: Record<string, string> = {
  info: "Info",
  alert: "Alert",
  promo: "Promo",
  system: "System",
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: "All users",
  active: "Active users (30d)",
  contributors: "Contributors",
};

export function NotificationsPage() {
  const qc = useQueryClient();
  const [form, setForm] = React.useState<BroadcastForm>({
    title: "",
    body: "",
    type: "info",
    audience: "all",
  });

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    staleTime: 60_000,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      broadcastNotification({
        title: form.title,
        body: form.body,
        type: form.type as "info" | "alert" | "promo" | "system",
        audience: form.audience,
      }),
    onSuccess: () => {
      toast.success("Notification broadcast sent");
      setForm({ title: "", body: "", type: "info", audience: "all" });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: () => toast.error("Failed to send notification"),
  });

  function set(key: keyof BroadcastForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canSend = form.title.trim() && form.body.trim();

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Compose card */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellIcon className="size-4" />
                Broadcast notification
              </CardTitle>
              <CardDescription>
                Send a push notification to selected user segments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="New matatu routes available!"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  maxLength={65}
                />
                <p className="text-xs text-muted-foreground text-right">{form.title.length}/65</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="body">Message</Label>
                <Textarea
                  id="body"
                  placeholder="We've added 12 new routes in Westlands. Tap to explore."
                  value={form.body}
                  onChange={(e) => set("body", e.target.value)}
                  rows={4}
                  maxLength={240}
                />
                <p className="text-xs text-muted-foreground text-right">{form.body.length}/240</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => set("type", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Audience</Label>
                  <Select value={form.audience} onValueChange={(v) => set("audience", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AUDIENCE_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="w-full"
                disabled={!canSend || sendMutation.isPending}
                onClick={() => sendMutation.mutate()}
              >
                {sendMutation.isPending ? (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                ) : (
                  <SendIcon className="mr-2 size-4" />
                )}
                Send broadcast
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Phone preview */}
        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <SmartphoneIcon className="size-4" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              {/* Phone frame */}
              <div className="relative w-52 h-96 rounded-3xl border-4 border-foreground/20 bg-background shadow-xl overflow-hidden">
                {/* Status bar */}
                <div className="absolute top-0 left-0 right-0 h-7 bg-muted/50 flex items-center justify-center">
                  <div className="w-16 h-3 rounded-full bg-foreground/20" />
                </div>

                {/* Notification */}
                <div className="absolute top-9 left-2 right-2">
                  <div className="rounded-xl bg-white dark:bg-zinc-800 shadow-md border p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <div className="size-5 rounded-full bg-primary flex items-center justify-center">
                        <BellIcon className="size-3 text-primary-foreground" />
                      </div>
                      <span className="text-xs font-semibold">Hopln</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">now</span>
                    </div>
                    <p className="text-xs font-medium leading-tight">
                      {form.title || "Notification title"}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                      {form.body || "Your message will appear here."}
                    </p>
                  </div>
                </div>

                {/* Home indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-1 rounded-full bg-foreground/20" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Broadcast history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead className="text-right">Sent to</TableHead>
                <TableHead>Sent at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  </TableRow>
                ))
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                    No notifications sent yet
                  </TableCell>
                </TableRow>
              ) : (
                history.map((n: {
                  id: string; title: string; type: string; audience: string;
                  sent_to: number; created_at: string;
                }) => (
                  <TableRow key={n.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-sm">{n.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[n.type] ?? n.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {AUDIENCE_LABELS[n.audience] ?? n.audience}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatNumber(n.sent_to)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(n.created_at)}
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
