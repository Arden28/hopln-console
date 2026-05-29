import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchGtfsStatus, validateGtfs, exportGtfs } from "@/api/gtfs";
import { fetchOtpLog, cancelOtpJob, type OtpLogEntry } from "@/api/otp";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  Loader2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  UploadCloudIcon,
  DatabaseIcon,
  ActivityIcon,
  FileCheckIcon,
  ServerIcon,
  ZapIcon,
  StopCircleIcon,
} from "lucide-react";
import { formatDateTime, timeAgo } from "@/lib/utils";
import type { GtfsValidationResult } from "@/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function ValidationResultPanel({ result }: { result: GtfsValidationResult }) {
  const [open, setOpen] = React.useState(!result.valid);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        {result.valid ? (
          <CheckCircle2Icon size={14} className="text-emerald-500" />
        ) : (
          <XCircleIcon size={14} className="text-destructive" />
        )}
        <span className={result.valid ? "text-emerald-600" : "text-destructive font-medium"}>
          {result.valid ? "All checks passed" : `${result.errors.length} error(s)`}
        </span>
        {result.warnings.length > 0 && (
          <Badge variant="outline" className="text-yellow-600 border-yellow-400">
            <AlertTriangleIcon size={10} className="mr-1" />
            {result.warnings.length} warning{result.warnings.length !== 1 ? "s" : ""}
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(result.checked_at).toLocaleString()}
        </span>
      </div>

      {(result.errors.length > 0 || result.warnings.length > 0) && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronDownIcon
                size={12}
                className={`transition-transform ${open ? "rotate-180" : ""}`}
              />
              {open ? "Hide" : "Show"} details
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1">
            {result.errors.map((e, i) => (
              <div key={i} className="flex gap-2 rounded-sm bg-destructive/5 px-2 py-1 text-xs">
                <XCircleIcon size={12} className="mt-0.5 shrink-0 text-destructive" />
                <div>
                  <span className="font-mono text-destructive">{e.rule}</span>
                  {e.entity_id && (
                    <span className="ml-1 text-muted-foreground">({e.entity_id})</span>
                  )}
                  <div className="text-muted-foreground">{e.message}</div>
                </div>
              </div>
            ))}
            {result.warnings.map((w, i) => (
              <div
                key={i}
                className="flex gap-2 rounded-sm bg-yellow-50 px-2 py-1 text-xs dark:bg-yellow-950/20"
              >
                <AlertTriangleIcon size={12} className="mt-0.5 shrink-0 text-yellow-600" />
                <div>
                  <span className="font-mono text-yellow-700">{w.rule}</span>
                  {w.entity_id && (
                    <span className="ml-1 text-muted-foreground">({w.entity_id})</span>
                  )}
                  <div className="text-muted-foreground">{w.message}</div>
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  export:       UploadCloudIcon,
  validate:     FileCheckIcon,
  sync:         RefreshCwIcon,
  otp_sync:     RefreshCwIcon,
  otp_deliver:  UploadCloudIcon,
  otp_build:    ZapIcon,
  build:        ZapIcon,
  gtfs_export:  UploadCloudIcon,
  gtfs_build:   DatabaseIcon,
  cancel:       StopCircleIcon,
};

function eventIcon(event: string): React.ElementType {
  const lower = event.toLowerCase();
  for (const [key, Icon] of Object.entries(EVENT_ICONS)) {
    if (lower.includes(key)) return Icon;
  }
  return ActivityIcon;
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  if (lower === "success" || lower === "completed" || lower === "ok") {
    return (
      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950 gap-1">
        <CheckCircle2Icon className="size-3" />
        {status}
      </Badge>
    );
  }
  if (lower === "running" || lower === "pending" || lower === "processing") {
    return (
      <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950 gap-1">
        <Loader2Icon className="size-3 animate-spin" />
        {status}
      </Badge>
    );
  }
  if (lower === "failed" || lower === "error") {
    return (
      <Badge variant="outline" className="text-xs text-destructive border-destructive/30 bg-destructive/5 gap-1">
        <XCircleIcon className="size-3" />
        {status}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
      {status}
    </Badge>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GtfsPage() {
  const qc = useQueryClient();
  const [liveResult, setLiveResult] = React.useState<GtfsValidationResult | null>(null);
  const [page, setPage] = React.useState(1);
  const [eventFilter, setEventFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const { data: status, isLoading } = useQuery({
    queryKey: ["gtfs:status"],
    queryFn: fetchGtfsStatus,
    refetchInterval: 15_000,
    staleTime: 15_000,
  });

  const syncStatus = status?.sync_status ?? "unknown";
  const isRunning  = syncStatus === "running";

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ["otp:log", page, eventFilter, statusFilter],
    queryFn: () => fetchOtpLog({
      page,
      per_page: 20,
      event:   eventFilter  !== "all" ? eventFilter  : undefined,
      status:  statusFilter !== "all" ? statusFilter : undefined,
    }),
    refetchInterval: isRunning ? 3_000 : 30_000,
    staleTime: 5_000,
  });

  const activity = activityData?.data ?? [];
  const meta     = activityData?.meta;

  function setEventFilterAndReset(v: string) {
    setEventFilter(v);
    setPage(1);
  }

  function setStatusFilterAndReset(v: string) {
    setStatusFilter(v);
    setPage(1);
  }

  const validateMutation = useMutation({
    mutationFn: validateGtfs,
    onSuccess: (result) => {
      setLiveResult(result);
      qc.invalidateQueries({ queryKey: ["gtfs:status"] });
      qc.invalidateQueries({ queryKey: ["otp:log"] });
      if (result.valid) {
        toast.success("GTFS validation passed.");
      } else {
        toast.error(`Validation failed — ${result.errors.length} error(s).`);
      }
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Validation request failed.");
    },
  });

  const exportMutation = useMutation({
    mutationFn: exportGtfs,
    onSuccess: () => {
      toast.success("GTFS export queued. OTP will reload when complete.");
      qc.invalidateQueries({ queryKey: ["gtfs:status"] });
      qc.invalidateQueries({ queryKey: ["otp:log"] });
    },
    onError: () => toast.error("Failed to queue GTFS export."),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelOtpJob,
    onSuccess: () => {
      toast.info("Cancel requested. Job will stop at the next checkpoint.");
      qc.invalidateQueries({ queryKey: ["gtfs:status"] });
    },
    onError: () => toast.error("Failed to request cancellation."),
  });

  const statusColor =
    syncStatus === "ok"                ? "text-emerald-600" :
    syncStatus === "running"           ? "text-blue-600"    :
    syncStatus === "failed" ||
    syncStatus === "validation_failed" ? "text-destructive" :
    "text-muted-foreground";

  const displayResult = liveResult ?? status?.validation_errors ?? null;

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">GTFS Operations</h1>
        <p className="text-sm text-muted-foreground">
          Validate data integrity and export to OpenTripPlanner
        </p>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Validation card */}
        <div className="rounded-lg border p-5 space-y-3">
          <div className="flex items-center gap-2 font-medium text-sm">
            <DatabaseIcon size={16} />
            Validation
          </div>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Check data integrity before syncing to OTP.
              </p>
              {displayResult && <ValidationResultPanel result={displayResult} />}
              <Button
                variant="outline"
                onClick={() => validateMutation.mutate()}
                disabled={validateMutation.isPending}
              >
                {validateMutation.isPending
                  ? <Loader2Icon size={14} className="mr-1.5 animate-spin" />
                  : <RefreshCwIcon size={14} className="mr-1.5" />}
                Run Validation
              </Button>
            </>
          )}
        </div>

        {/* Export / sync card */}
        <div className="rounded-lg border p-5 space-y-3">
          <div className="flex items-center gap-2 font-medium text-sm">
            <UploadCloudIcon size={16} />
            OTP Sync
          </div>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className={`font-medium ${statusColor} flex items-center gap-1`}>
                  {isRunning && <Loader2Icon className="size-3.5 animate-spin" />}
                  {syncStatus}
                </span>
              </div>
              {status?.last_synced_at && (
                <div className="text-xs text-muted-foreground">
                  Last synced:{" "}
                  <span className="text-foreground">{formatDateTime(status.last_synced_at)}</span>
                  <span className="ml-1 text-muted-foreground/60">
                    ({timeAgo(status.last_synced_at)})
                  </span>
                </div>
              )}
              {syncStatus === "validation_failed" && displayResult && (
                <p className="text-xs text-destructive">
                  Sync blocked — fix {displayResult.errors.length} validation error(s) first.
                </p>
              )}
              <div className="flex items-center gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={exportMutation.isPending || isRunning}>
                      {exportMutation.isPending || isRunning
                        ? <Loader2Icon size={14} className="mr-1.5 animate-spin" />
                        : <UploadCloudIcon size={14} className="mr-1.5" />}
                      Export &amp; Sync
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Export &amp; sync to OTP?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will regenerate the GTFS files from the current database and reload the
                        OpenTripPlanner routing engine. Live route planning will be briefly
                        unavailable during the reload.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => exportMutation.mutate()}>
                        Export &amp; Sync
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {isRunning && (
                  <Button
                    variant="destructive"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending
                      ? <Loader2Icon size={14} className="mr-1.5 animate-spin" />
                      : <StopCircleIcon size={14} className="mr-1.5" />}
                    Cancel
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Activity log */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ServerIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Activity log</h2>
            {isRunning && (
              <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950 gap-1">
                <Loader2Icon className="size-3 animate-spin" />
                Job running
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground"
            onClick={() => qc.invalidateQueries({ queryKey: ["otp:log"] })}
            disabled={activityLoading}
          >
            <RefreshCwIcon className={`size-3 ${activityLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Select value={eventFilter} onValueChange={setEventFilterAndReset}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="validate">Validate</SelectItem>
              <SelectItem value="gtfs_export">GTFS export</SelectItem>
              <SelectItem value="gtfs_build">GTFS build</SelectItem>
              <SelectItem value="otp_deliver">OTP deliver</SelectItem>
              <SelectItem value="otp_build">OTP build</SelectItem>
              <SelectItem value="otp_sync">OTP sync</SelectItem>
              <SelectItem value="cancel">Cancel</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilterAndReset}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          {(eventFilter !== "all" || statusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setEventFilter("all"); setStatusFilter("all"); setPage(1); }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-44">Event</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-44 text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activityLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="flex items-center gap-2"><Skeleton className="size-4 rounded" /><Skeleton className="h-4 w-24" /></div></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : activity.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-28 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ActivityIcon className="size-8 opacity-30" />
                      <p className="text-sm">No activity yet</p>
                      <p className="text-xs">Events will appear here after you run a validation or export.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                activity.map((entry: OtpLogEntry) => {
                  const Icon = eventIcon(entry.event);
                  const isEntryRunning = entry.status.toLowerCase() === "running";
                  return (
                    <TableRow key={entry.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Icon className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="capitalize">{entry.event.replace(/_/g, " ")}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={entry.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-sm">
                        <span className="line-clamp-2 leading-snug">{entry.message ?? "—"}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isEntryRunning && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => cancelMutation.mutate()}
                              disabled={cancelMutation.isPending}
                            >
                              {cancelMutation.isPending
                                ? <Loader2Icon className="size-3 animate-spin" />
                                : <StopCircleIcon className="size-3" />}
                            </Button>
                          )}
                          <div className="text-xs text-muted-foreground">
                            <p className="font-medium text-foreground">{timeAgo(entry.created_at)}</p>
                            <p>{formatDateTime(entry.created_at)}</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {meta.total} total entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={page <= 1 || activityLoading}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeftIcon className="size-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {page} / {meta.last_page}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={page >= meta.last_page || activityLoading}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRightIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
