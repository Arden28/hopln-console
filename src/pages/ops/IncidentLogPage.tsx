import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchIncidents, fetchIncidentStats, saveIncident, updateIncident, resolveIncident } from "@/api/incidents";
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
import { toast } from "sonner";
import { PlusIcon, CheckIcon, ShieldAlertIcon, AlertTriangleIcon, ClockIcon, CheckCircleIcon } from "lucide-react";
import type { Incident } from "@/types";

const SEVERITY_COLORS: Record<string, string> = {
  low:      "bg-blue-100 text-blue-700 border-blue-200",
  medium:   "bg-amber-100 text-amber-700 border-amber-200",
  high:     "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_COLORS: Record<string, string> = {
  open:          "bg-red-100 text-red-700 border-red-200",
  investigating: "bg-amber-100 text-amber-700 border-amber-200",
  resolved:      "bg-green-100 text-green-700 border-green-200",
};

type IncidentFormState = {
  type: Incident["type"];
  severity: Incident["severity"];
  route_id: string;
  stop_id: string;
  vehicle_id: string;
  description: string;
  response_taken: string;
  reported_by: string;
};

const EMPTY: IncidentFormState = {
  type: "other", severity: "low", route_id: "", stop_id: "",
  vehicle_id: "", description: "", response_taken: "", reported_by: "",
};

export function IncidentLogPage() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter]     = React.useState("all");
  const [severityFilter, setSeverityFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [editing, setEditing]   = React.useState<Incident | "new" | null>(null);
  const [form, setForm]         = React.useState<IncidentFormState>(EMPTY);
  const [resolveTarget, setResolveTarget] = React.useState<Incident | null>(null);
  const [resolveNote, setResolveNote]     = React.useState("");

  const { data: stats } = useQuery({
    queryKey: ["ops:incident-stats"],
    queryFn: fetchIncidentStats,
    staleTime: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["ops:incidents", typeFilter, severityFilter, statusFilter],
    queryFn: () => fetchIncidents({
      type:     typeFilter     === "all" ? undefined : typeFilter,
      severity: severityFilter === "all" ? undefined : severityFilter,
      status:   statusFilter   === "all" ? undefined : statusFilter,
    }),
    staleTime: 20_000,
  });

  const saveMutation = useMutation({
    mutationFn: (f: IncidentFormState) => {
      const payload = {
        ...f,
        route_id:   f.route_id   || null,
        stop_id:    f.stop_id    || null,
        vehicle_id: f.vehicle_id ? parseInt(f.vehicle_id) : null,
        response_taken: f.response_taken || null,
        reported_by:    f.reported_by    || null,
      };
      return editing === "new"
        ? saveIncident(payload)
        : updateIncident((editing as Incident).id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ops:incidents"] });
      qc.invalidateQueries({ queryKey: ["ops:incident-stats"] });
      setEditing(null);
      toast.success(editing === "new" ? "Incident reported" : "Incident updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolveMutation = useMutation({
    mutationFn: (inc: Incident) => resolveIncident(inc.id, { response_taken: resolveNote || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ops:incidents"] });
      qc.invalidateQueries({ queryKey: ["ops:incident-stats"] });
      setResolveTarget(null);
      setResolveNote("");
      toast.success("Incident resolved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(inc: Incident) {
    setForm({
      type:           inc.type,
      severity:       inc.severity,
      route_id:       inc.route_id    ?? "",
      stop_id:        inc.stop_id     ?? "",
      vehicle_id:     inc.vehicle_id  != null ? String(inc.vehicle_id) : "",
      description:    inc.description,
      response_taken: inc.response_taken ?? "",
      reported_by:    inc.reported_by    ?? "",
    });
    setEditing(inc);
  }

  const incidents = data?.data ?? [];

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      {/* KPI row */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
            <ShieldAlertIcon className="size-5 text-red-500" />
            <div>
              <p className="text-xs text-muted-foreground">Open</p>
              <p className="text-xl font-semibold">{stats.open_count}</p>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
            <AlertTriangleIcon className="size-5 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground">Critical active</p>
              <p className="text-xl font-semibold">{stats.critical_count}</p>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
            <CheckCircleIcon className="size-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Resolved this month</p>
              <p className="text-xl font-semibold">{stats.resolved_this_month}</p>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
            <ClockIcon className="size-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Avg resolution</p>
              <p className="text-xl font-semibold">
                {stats.avg_resolution_mins != null ? `${stats.avg_resolution_mins}m` : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters + action */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="accident">Accident</SelectItem>
              <SelectItem value="near_miss">Near miss</SelectItem>
              <SelectItem value="crime">Crime</SelectItem>
              <SelectItem value="infrastructure">Infrastructure</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setForm(EMPTY); setEditing("new"); }}>
          <PlusIcon className="size-4 mr-1" /> Report Incident
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Route / Stop</TableHead>
              <TableHead className="max-w-[200px]">Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reported</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {[1,2,3,4,5,6,7].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              : incidents.length === 0
              ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No incidents</TableCell></TableRow>
              : incidents.map((inc: Incident) => (
                  <TableRow key={inc.id}>
                    <TableCell className="capitalize text-sm">{inc.type.replace("_", " ")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={SEVERITY_COLORS[inc.severity]}>{inc.severity}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {inc.route_id && <span className="font-mono">{inc.route_id}</span>}
                      {inc.stop_id  && <span className="font-mono ml-1">{inc.stop_id}</span>}
                      {!inc.route_id && !inc.stop_id && <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="truncate text-sm">{inc.description}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[inc.status]}>{inc.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(inc.created_at).toLocaleDateString("en-KE")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {inc.status !== "resolved" && (
                          <Button variant="ghost" size="icon" title="Resolve" onClick={() => setResolveTarget(inc)}>
                            <CheckIcon className="size-4 text-green-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(inc)}>
                          <span className="sr-only">Edit</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                          </svg>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {/* Report / Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Report Incident" : "Edit Incident"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as Incident["type"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accident">Accident</SelectItem>
                    <SelectItem value="near_miss">Near miss</SelectItem>
                    <SelectItem value="crime">Crime</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v as Incident["severity"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Route ID</Label>
                <Input value={form.route_id} onChange={e => setForm(f => ({ ...f, route_id: e.target.value }))} placeholder="e.g. R23" />
              </div>
              <div className="space-y-1">
                <Label>Stop ID</Label>
                <Input value={form.stop_id} onChange={e => setForm(f => ({ ...f, stop_id: e.target.value }))} placeholder="e.g. S001" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description *</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Response Taken</Label>
              <Textarea value={form.response_taken} onChange={e => setForm(f => ({ ...f, response_taken: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Reported By</Label>
              <Input value={form.reported_by} onChange={e => setForm(f => ({ ...f, reported_by: e.target.value }))} placeholder="Name or ID" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.description.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={!!resolveTarget} onOpenChange={o => !o && setResolveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Resolve Incident</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Response taken (optional)</Label>
            <Textarea
              value={resolveNote}
              onChange={e => setResolveNote(e.target.value)}
              rows={3}
              placeholder="Describe the resolution…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>Cancel</Button>
            <Button
              onClick={() => resolveMutation.mutate(resolveTarget!)}
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending ? "Resolving…" : "Mark Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
