import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSplitConfigs, saveSplitConfig } from "@/api/ledger";
import { fetchAgencies } from "@/api/agencies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PlusIcon, PencilIcon } from "lucide-react";
import type { SplitConfig } from "@/types";

type FormState = {
  agency_id: string;
  vehicle_pct: string;
  sacco_pct: string;
  platform_pct: string;
  notes: string;
};

const GLOBAL_SENTINEL = "__global__";
const EMPTY: FormState = { agency_id: GLOBAL_SENTINEL, vehicle_pct: "85", sacco_pct: "10", platform_pct: "5", notes: "" };

function sum(f: FormState) {
  return (parseFloat(f.vehicle_pct) || 0) + (parseFloat(f.sacco_pct) || 0) + (parseFloat(f.platform_pct) || 0);
}

export function SplitConfigPage() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [editingConfig, setEditingConfig] = React.useState<SplitConfig | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["split-configs"],
    queryFn: fetchSplitConfigs,
    staleTime: 60_000,
  });

  const { data: agenciesRes } = useQuery({
    queryKey: ["agencies"],
    queryFn: () => fetchAgencies(),
    staleTime: 300_000,
  });

  const agencies = (agenciesRes as { data?: unknown[] } | unknown[] | undefined);
  const agencyList = Array.isArray(agencies)
    ? agencies as Array<{ agency_id: string; agency_name: string }>
    : (agencies as { data?: Array<{ agency_id: string; agency_name: string }> })?.data ?? [];

  const saveMutation = useMutation({
    mutationFn: () => saveSplitConfig({
      agency_id:   form.agency_id === GLOBAL_SENTINEL ? null : form.agency_id || null,
      vehicle_pct: parseFloat(form.vehicle_pct),
      sacco_pct:   parseFloat(form.sacco_pct),
      platform_pct:parseFloat(form.platform_pct),
      notes:       form.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["split-configs"] });
      setOpen(false);
      setEditingConfig(null);
      toast.success(editingConfig ? "Split config updated" : "Split config saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(c: SplitConfig) {
    setForm({
      agency_id:    c.agency_id ?? GLOBAL_SENTINEL,
      vehicle_pct:  String(c.vehicle_pct),
      sacco_pct:    String(c.sacco_pct),
      platform_pct: String(c.platform_pct),
      notes:        c.notes ?? "",
    });
    setEditingConfig(c);
    setOpen(true);
  }

  function openNew() {
    setForm(EMPTY);
    setEditingConfig(null);
    setOpen(true);
  }

  const total = sum(form);
  const valid = Math.abs(total - 100) < 0.01;

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Define how payments are split between vehicle owner, SACCO, and platform.
            Agency-specific configs take priority over the global default.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <PlusIcon className="size-4 mr-1" /> New Config
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scope</TableHead>
              <TableHead className="text-right">Vehicle %</TableHead>
              <TableHead className="text-right">SACCO %</TableHead>
              <TableHead className="text-right">Platform %</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {[1,2,3,4,5,6,7].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              : configs.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      No split configs yet
                    </TableCell>
                  </TableRow>
                )
              : configs.map((c: SplitConfig) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      {c.agency_id
                        ? <span className="font-medium">{c.agency_id}</span>
                        : <Badge variant="secondary">Global default</Badge>}
                    </TableCell>
                    <TableCell className="text-right font-mono">{c.vehicle_pct}%</TableCell>
                    <TableCell className="text-right font-mono">{c.sacco_pct}%</TableCell>
                    <TableCell className="text-right font-mono">{c.platform_pct}%</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.notes ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={c.is_active
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"}
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <PencilIcon className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={o => { if (!o) { setOpen(false); setEditingConfig(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingConfig ? "Edit Split Config" : "New Split Config"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label>Agency (leave blank for global default)</Label>
              <Select value={form.agency_id} onValueChange={v => setForm(f => ({ ...f, agency_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Global default" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={GLOBAL_SENTINEL}>Global default</SelectItem>
                  {agencyList.map(a => (
                    <SelectItem key={a.agency_id} value={a.agency_id}>{a.agency_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Vehicle %</Label>
                <Input type="number" step="0.01" min={0} max={100}
                  value={form.vehicle_pct}
                  onChange={e => setForm(f => ({ ...f, vehicle_pct: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>SACCO %</Label>
                <Input type="number" step="0.01" min={0} max={100}
                  value={form.sacco_pct}
                  onChange={e => setForm(f => ({ ...f, sacco_pct: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Platform %</Label>
                <Input type="number" step="0.01" min={0} max={100}
                  value={form.platform_pct}
                  onChange={e => setForm(f => ({ ...f, platform_pct: e.target.value }))}
                />
              </div>
            </div>
            <p className={`text-sm font-medium ${valid ? "text-green-600" : "text-destructive"}`}>
              Total: {total.toFixed(2)}% {!valid && "(must equal 100%)"}
            </p>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditingConfig(null); }}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!valid || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
