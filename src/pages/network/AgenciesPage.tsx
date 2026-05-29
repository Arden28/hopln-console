import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchAgencies, createAgency, updateAgency, deleteAgency } from "@/api/agencies";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { toast } from "sonner";
import { SearchIcon, PlusIcon, PencilIcon, Trash2Icon, ChevronRightIcon } from "lucide-react";
import type { Agency } from "@/types";

type FormState = {
  agency_id: string;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;
  agency_lang: string;
  agency_phone: string;
  agency_email: string;
};

const EMPTY: FormState = {
  agency_id: "", agency_name: "", agency_url: "", agency_timezone: "Africa/Nairobi",
  agency_lang: "sw", agency_phone: "", agency_email: "",
};

export function AgenciesPage() {
  const qc = useQueryClient();
  const [search, setSearch]     = React.useState("");
  const [editing, setEditing]   = React.useState<Agency | null | "new">(null);
  const [form, setForm]         = React.useState<FormState>(EMPTY);
  const [deleteTarget, setDeleteTarget] = React.useState<Agency | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["agencies"],
    queryFn: fetchAgencies,
    staleTime: 120_000,
  });

  const agencies = (data ?? []).filter(a =>
    !search || a.agency_name.toLowerCase().includes(search.toLowerCase()) ||
    a.agency_id.toLowerCase().includes(search.toLowerCase())
  );

  const saveMutation = useMutation({
    mutationFn: (f: FormState) => {
      const payload = {
        agency_id:       f.agency_id,
        agency_name:     f.agency_name,
        agency_url:      f.agency_url      || "",
        agency_timezone: f.agency_timezone || "Africa/Nairobi",
        agency_lang:     f.agency_lang     || null,
        agency_phone:    f.agency_phone    || null,
        agency_email:    f.agency_email    || null,
      };
      return editing === "new"
        ? createAgency(payload as Agency)
        : updateAgency((editing as Agency).agency_id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agencies"] });
      setEditing(null);
      toast.success(editing === "new" ? "Agency created" : "Agency updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (a: Agency) => deleteAgency(a.agency_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agencies"] });
      toast.success("Agency deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setForm(EMPTY);
    setEditing("new");
  }

  function openEdit(a: Agency) {
    setForm({
      agency_id:       a.agency_id,
      agency_name:     a.agency_name,
      agency_url:      a.agency_url      ?? "",
      agency_timezone: a.agency_timezone ?? "Africa/Nairobi",
      agency_lang:     a.agency_lang     ?? "",
      agency_phone:    a.agency_phone    ?? "",
      agency_email:    a.agency_email    ?? "",
    });
    setEditing(a);
  }

  function field(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));
  }

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={openNew}>
          <PlusIcon className="size-4 mr-1" /> Add Agency
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Timezone</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Routes</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {[1,2,3,4,5,6].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              : agencies.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No agencies found
                    </TableCell>
                  </TableRow>
                )
              : agencies.map(a => (
                  <TableRow key={a.agency_id}>
                    <TableCell className="font-mono text-sm">{a.agency_id}</TableCell>
                    <TableCell className="font-medium">{a.agency_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.agency_timezone}</TableCell>
                    <TableCell className="text-sm">{a.agency_phone ?? "—"}</TableCell>
                    <TableCell>{a.routes_count ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end items-center">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(a)}>
                          <Trash2Icon className="size-4 text-destructive" />
                        </Button>
                        <Link to="/network/agencies/$agencyId" params={{ agencyId: a.agency_id }}>
                          <Button variant="ghost" size="icon">
                            <ChevronRightIcon className="size-4" />
                          </Button>
                        </Link>
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
            <DialogTitle>{editing === "new" ? "Add Agency" : "Edit Agency"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Agency ID *</Label>
                <Input
                  value={form.agency_id}
                  onChange={field("agency_id")}
                  placeholder="hopln"
                  disabled={editing !== "new"}
                />
              </div>
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={form.agency_name} onChange={field("agency_name")} placeholder="Hopln Transit" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>URL</Label>
              <Input value={form.agency_url} onChange={field("agency_url")} placeholder="https://hopln.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Timezone</Label>
                <Input value={form.agency_timezone} onChange={field("agency_timezone")} placeholder="Africa/Nairobi" />
              </div>
              <div className="space-y-1">
                <Label>Language</Label>
                <Input value={form.agency_lang} onChange={field("agency_lang")} placeholder="sw" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.agency_phone} onChange={field("agency_phone")} placeholder="+254…" />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.agency_email} onChange={field("agency_email")} placeholder="ops@…" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.agency_id.trim() || !form.agency_name.trim() || saveMutation.isPending}
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
            <AlertDialogTitle>Delete agency {deleteTarget?.agency_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the agency record. Routes and vehicles linked to it will be unaffected.
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
