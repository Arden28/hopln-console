import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchVehicles, saveVehicle, updateVehicle, deleteVehicle } from "@/api/fleet";
import { fetchAgencies } from "@/api/agencies";
import { fetchRoutes } from "@/api/routes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SearchIcon, PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { Vehicle } from "@/types";

const STATUS_COLORS = {
  active:    "bg-green-100 text-green-700 border-green-200",
  inactive:  "bg-slate-100 text-slate-700 border-slate-200",
  suspended: "bg-red-100 text-red-700 border-red-200",
};

type FormState = {
  plate: string;
  agency_id: string;
  route_id: string;
  model: string;
  capacity: string;
  status: "active" | "inactive" | "suspended";
  notes: string;
};

const NONE = "__none__";
const EMPTY: FormState = {
  plate: "", agency_id: NONE, route_id: NONE, model: "",
  capacity: "", status: "active", notes: "",
};

export function VehiclesPage() {
  const qc = useQueryClient();
  const [search, setSearch]     = React.useState("");
  const [status, setStatus]     = React.useState<string>("all");
  const [editing, setEditing]   = React.useState<Vehicle | null | "new">(null);
  const [form, setForm]         = React.useState<FormState>(EMPTY);
  const [deleteTarget, setDeleteTarget] = React.useState<Vehicle | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vehicles", search, status],
    queryFn: () => fetchVehicles({
      search: search || undefined,
      status: status === "all" ? undefined : status,
    }),
    staleTime: 30_000,
  });

  const { data: agenciesRes } = useQuery({
    queryKey: ["agencies"],
    queryFn: () => fetchAgencies(),
    staleTime: 300_000,
  });

  const { data: routesRes } = useQuery({
    queryKey: ["routes-simple"],
    queryFn: () => fetchRoutes({ per_page: 200 }),
    staleTime: 300_000,
  });

  const saveMutation = useMutation({
    mutationFn: (f: FormState) => {
      const payload = {
        plate:     f.plate,
        agency_id: f.agency_id === NONE ? null : f.agency_id || null,
        route_id:  f.route_id  === NONE ? null : f.route_id  || null,
        model:     f.model     || null,
        capacity:  f.capacity  ? parseInt(f.capacity) : null,
        status:    f.status,
        notes:     f.notes     || null,
      };
      return editing === "new"
        ? saveVehicle(payload)
        : updateVehicle((editing as Vehicle).id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setEditing(null);
      toast.success(editing === "new" ? "Vehicle added" : "Vehicle updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (v: Vehicle) => deleteVehicle(v.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setForm(EMPTY);
    setEditing("new");
  }

  function openEdit(v: Vehicle) {
    setForm({
      plate:     v.plate,
      agency_id: v.agency_id ?? NONE,
      route_id:  v.route_id  ?? NONE,
      model:     v.model     ?? "",
      capacity:  v.capacity  != null ? String(v.capacity) : "",
      status:    v.status,
      notes:     v.notes     ?? "",
    });
    setEditing(v);
  }

  const vehicles = data?.data ?? [];
  const agencies = (agenciesRes as { data?: unknown[] } | undefined)?.data
    ?? (Array.isArray(agenciesRes) ? agenciesRes : []);
  const routes = (routesRes as { data?: unknown[] } | undefined)?.data
    ?? (Array.isArray(routesRes) ? routesRes : []);

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-lg">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search plate or model…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={openNew}>
          <PlusIcon className="size-4 mr-1" /> Add Vehicle
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plate</TableHead>
              <TableHead>Agency (SACCO)</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : vehicles.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      No vehicles found
                    </TableCell>
                  </TableRow>
                )
              : vehicles.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono font-semibold">{v.plate}</TableCell>
                    <TableCell>{v.agency?.agency_name ?? v.agency_id ?? "—"}</TableCell>
                    <TableCell>{v.route?.route_short_name ?? v.route_id ?? "—"}</TableCell>
                    <TableCell>{v.model ?? "—"}</TableCell>
                    <TableCell>{v.capacity ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[v.status]}>
                        {v.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(v)}>
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
            <DialogTitle>{editing === "new" ? "Add Vehicle" : "Edit Vehicle"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Plate *</Label>
                <Input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} placeholder="KCA 123A" />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as FormState["status"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Agency (SACCO)</Label>
              <Select value={form.agency_id} onValueChange={v => setForm(f => ({ ...f, agency_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select agency…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {(agencies as Array<{ agency_id: string; agency_name: string }>).map(a => (
                    <SelectItem key={a.agency_id} value={a.agency_id}>{a.agency_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Default Route</Label>
              <Select value={form.route_id} onValueChange={v => setForm(f => ({ ...f, route_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select route…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {(routes as Array<{ route_id: string; route_short_name: string }>).map(r => (
                    <SelectItem key={r.route_id} value={r.route_id}>{r.route_short_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Model</Label>
                <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Isuzu NQR" />
              </div>
              <div className="space-y-1">
                <Label>Capacity (seats)</Label>
                <Input type="number" min={1} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="33" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.plate.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vehicle {deleteTarget?.plate}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the vehicle record. Position history and ledger entries will be unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteMutation.mutate(deleteTarget!); setDeleteTarget(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
