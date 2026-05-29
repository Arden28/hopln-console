import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAlerts, saveAlert, updateAlert, activateAlert, expireAlert, deleteAlert } from "@/api/alerts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { PlusIcon, CheckCircleIcon, XCircleIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { ServiceAlert } from "@/types";

const SEVERITY_COLORS = {
  info:     "bg-blue-100 text-blue-700 border-blue-200",
  warning:  "bg-amber-100 text-amber-700 border-amber-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_COLORS = {
  draft:   "bg-slate-100 text-slate-700 border-slate-200",
  active:  "bg-green-100 text-green-700 border-green-200",
  expired: "bg-muted text-muted-foreground border-muted",
};

type FormState = {
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  effect: "detour" | "reduced_service" | "cancellation" | "other";
  affected_type: "route" | "stop" | "all";
  affected_id: string;
  starts_at: string;
  ends_at: string;
};

const EMPTY: FormState = {
  title: "", description: "",
  severity: "info", effect: "other", affected_type: "all", affected_id: "",
  starts_at: "", ends_at: "",
};

export function ServiceAlertsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [editing, setEditing]   = React.useState<ServiceAlert | null | "new">(null);
  const [form, setForm]         = React.useState<FormState>(EMPTY);
  const [deleteTarget, setDeleteTarget] = React.useState<ServiceAlert | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ops:alerts", statusFilter],
    queryFn: () => fetchAlerts({ status: statusFilter === "all" ? undefined : statusFilter as ServiceAlert["status"] }),
    staleTime: 15_000,
  });

  const saveMutation = useMutation({
    mutationFn: (f: FormState) => {
      const payload = { ...f, affected_id: f.affected_id || null, ends_at: f.ends_at || null };
      return editing === "new"
        ? saveAlert(payload)
        : updateAlert((editing as ServiceAlert).id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ops:alerts"] });
      setEditing(null);
      toast.success(editing === "new" ? "Alert created" : "Alert updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activateMutation = useMutation({
    mutationFn: activateAlert,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ops:alerts"] }); toast.success("Alert activated"); },
  });

  const expireMutation = useMutation({
    mutationFn: expireAlert,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ops:alerts"] }); toast.success("Alert expired"); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ops:alerts"] }); toast.success("Alert deleted"); },
  });

  function openEdit(a: ServiceAlert) {
    setForm({
      title:         a.title,
      description:   a.description ?? "",
      severity:      a.severity,
      effect:        a.effect,
      affected_type: a.affected_type,
      affected_id:   a.affected_id ?? "",
      starts_at:     a.starts_at.slice(0, 16),
      ends_at:       a.ends_at?.slice(0, 16) ?? "",
    });
    setEditing(a);
  }

  const alerts = data?.data ?? [];

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { setForm(EMPTY); setEditing("new"); }}>
          <PlusIcon className="size-4 mr-1" /> New Alert
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Effect</TableHead>
              <TableHead>Affected</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {[1,2,3,4,5,6,7].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              : alerts.length === 0
              ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No alerts</TableCell></TableRow>
              : alerts.map((a: ServiceAlert) => (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-[200px]">
                      <p className="font-medium truncate">{a.title}</p>
                      {a.auto_generated && <Badge variant="secondary" className="text-xs mt-0.5">auto</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={SEVERITY_COLORS[a.severity]}>{a.severity}</Badge>
                    </TableCell>
                    <TableCell className="capitalize text-sm">{a.effect.replace("_", " ")}</TableCell>
                    <TableCell className="text-sm">
                      <span className="text-muted-foreground capitalize">{a.affected_type}</span>
                      {a.affected_id && <span className="font-mono ml-1">{a.affected_id}</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(a.starts_at).toLocaleDateString("en-KE")}
                      {a.ends_at && <> → {new Date(a.ends_at).toLocaleDateString("en-KE")}</>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[a.status]}>{a.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {a.status === "draft" && (
                          <Button variant="ghost" size="icon" title="Activate" onClick={() => activateMutation.mutate(a.id)}>
                            <CheckCircleIcon className="size-4 text-green-600" />
                          </Button>
                        )}
                        {a.status === "active" && (
                          <Button variant="ghost" size="icon" title="Expire" onClick={() => expireMutation.mutate(a.id)}>
                            <XCircleIcon className="size-4 text-amber-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(a)}>
                          <Trash2Icon className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit / New Dialog */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New Alert" : "Edit Alert"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v as FormState["severity"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Effect</Label>
                <Select value={form.effect} onValueChange={v => setForm(f => ({ ...f, effect: v as FormState["effect"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="detour">Detour</SelectItem>
                    <SelectItem value="reduced_service">Reduced service</SelectItem>
                    <SelectItem value="cancellation">Cancellation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Affected</Label>
                <Select value={form.affected_type} onValueChange={v => setForm(f => ({ ...f, affected_type: v as FormState["affected_type"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="route">Route</SelectItem>
                    <SelectItem value="stop">Stop</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.affected_type !== "all" && (
                <div className="space-y-1">
                  <Label>{form.affected_type === "route" ? "Route ID" : "Stop ID"}</Label>
                  <Input value={form.affected_id} onChange={e => setForm(f => ({ ...f, affected_id: e.target.value }))} placeholder="e.g. R23" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Starts At *</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Ends At</Label>
                <Input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.title.trim() || !form.starts_at || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete alert?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteTarget?.title}" will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteMutation.mutate(deleteTarget!.id); setDeleteTarget(null); }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
