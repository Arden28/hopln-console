import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDrivers, saveDriver, updateDriver, deleteDriver } from "@/api/fleet";
import { fetchVehicles } from "@/api/fleet";
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
import type { Driver } from "@/types";

type FormState = {
  name: string;
  phone: string;
  license_no: string;
  vehicle_id: string;
  status: "active" | "inactive";
  notes: string;
};

const NONE = "__none__";
const EMPTY: FormState = {
  name: "", phone: "", license_no: "", vehicle_id: NONE, status: "active", notes: "",
};

export function DriversPage() {
  const qc = useQueryClient();
  const [search, setSearch]     = React.useState("");
  const [status, setStatus]     = React.useState("all");
  const [editing, setEditing]   = React.useState<Driver | null | "new">(null);
  const [form, setForm]         = React.useState<FormState>(EMPTY);
  const [deleteTarget, setDeleteTarget] = React.useState<Driver | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["drivers", search, status],
    queryFn: () => fetchDrivers({
      search: search || undefined,
      status: status === "all" ? undefined : status,
    }),
    staleTime: 30_000,
  });

  const { data: vehiclesRes } = useQuery({
    queryKey: ["vehicles-simple"],
    queryFn: () => fetchVehicles({ status: "active" }),
    staleTime: 120_000,
  });

  const saveMutation = useMutation({
    mutationFn: (f: FormState) => {
      const payload = {
        name:       f.name,
        phone:      f.phone      || null,
        license_no: f.license_no || null,
        vehicle_id: f.vehicle_id && f.vehicle_id !== NONE ? parseInt(f.vehicle_id) : null,
        status:     f.status,
        notes:      f.notes      || null,
      };
      return editing === "new"
        ? saveDriver(payload)
        : updateDriver((editing as Driver).id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      setEditing(null);
      toast.success(editing === "new" ? "Driver added" : "Driver updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (d: Driver) => deleteDriver(d.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Driver deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setForm(EMPTY);
    setEditing("new");
  }

  function openEdit(d: Driver) {
    setForm({
      name:       d.name,
      phone:      d.phone      ?? "",
      license_no: d.license_no ?? "",
      vehicle_id: d.vehicle_id != null ? String(d.vehicle_id) : NONE,
      status:     d.status,
      notes:      d.notes      ?? "",
    });
    setEditing(d);
  }

  const drivers  = data?.data ?? [];
  const vehicles = vehiclesRes?.data ?? [];

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-lg">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name or phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={openNew}>
          <PlusIcon className="size-4 mr-1" /> Add Driver
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>License No.</TableHead>
              <TableHead>Assigned Vehicle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : drivers.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No drivers found
                    </TableCell>
                  </TableRow>
                )
              : drivers.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="font-mono text-sm">{d.phone ?? "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{d.license_no ?? "—"}</TableCell>
                    <TableCell>
                      {d.vehicle
                        ? <span className="font-mono font-semibold">{d.vehicle.plate}</span>
                        : <span className="text-muted-foreground">Unassigned</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline"
                        className={d.status === "active"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"}
                      >
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(d)}>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add Driver" : "Edit Driver"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Mwangi" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254…" />
              </div>
              <div className="space-y-1">
                <Label>License No.</Label>
                <Input value={form.license_no} onChange={e => setForm(f => ({ ...f, license_no: e.target.value }))} placeholder="D123456" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Assigned Vehicle</Label>
              <Select value={form.vehicle_id} onValueChange={v => setForm(f => ({ ...f, vehicle_id: v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as FormState["status"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
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
              disabled={!form.name.trim() || saveMutation.isPending}
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
            <AlertDialogTitle>Delete driver {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the driver record. Their vehicle assignment will be cleared.
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
