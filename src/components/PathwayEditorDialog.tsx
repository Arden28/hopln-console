import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  fetchLevels, saveLevel, updateLevel, deleteLevel,
  fetchPathways, savePathway, updatePathway, deletePathway,
  exportPathwayFiles,
} from "@/api/interop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PlusIcon, Trash2Icon, DownloadIcon } from "lucide-react";
import type { Level, Pathway, PathwayMode } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  stopId: string;
  stopName?: string;
}

const PATHWAY_MODE_LABELS: Record<number, string> = {
  1: "Walkway",
  2: "Stairs",
  3: "Moving Sidewalk",
  4: "Escalator",
  5: "Elevator",
  6: "Fare Gate",
  7: "Exit Gate",
};

const levelSchema = z.object({
  level_index: z.coerce.number(),
  level_name: z.string().min(1),
});

const pathwaySchema = z.object({
  from_stop_id: z.string().min(1),
  to_stop_id: z.string().min(1),
  pathway_mode: z.coerce.number().int().min(1).max(7),
  is_bidirectional: z.boolean().default(true),
  traversal_time: z.coerce.number().int().min(0).nullable().optional(),
  length: z.coerce.number().min(0).nullable().optional(),
  stair_count: z.coerce.number().int().nullable().optional(),
});

type LevelForm = z.infer<typeof levelSchema>;
type PathwayForm = z.infer<typeof pathwaySchema>;

export function PathwayEditorDialog({ open, onClose, stopId, stopName }: Props) {
  const qc = useQueryClient();
  const [editingLevel, setEditingLevel] = React.useState<Level | null>(null);
  const [addingLevel, setAddingLevel] = React.useState(false);
  const [addingPathway, setAddingPathway] = React.useState(false);

  const { data: levels = [] } = useQuery({
    queryKey: ["network:levels", stopId],
    queryFn: () => fetchLevels(stopId),
    enabled: open,
    staleTime: 30_000,
  });

  const { data: pathways = [] } = useQuery({
    queryKey: ["network:pathways", stopId],
    queryFn: () => fetchPathways(stopId),
    enabled: open,
    staleTime: 30_000,
  });

  const levelForm = useForm<LevelForm>({ resolver: zodResolver(levelSchema) });
  const pathwayForm = useForm<PathwayForm>({ resolver: zodResolver(pathwaySchema), defaultValues: { is_bidirectional: true } });

  const saveLevelMutation = useMutation({
    mutationFn: (d: LevelForm) => editingLevel
      ? updateLevel(editingLevel.id, d)
      : saveLevel({ ...d, stop_id: stopId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["network:levels", stopId] });
      setAddingLevel(false);
      setEditingLevel(null);
      levelForm.reset();
    },
  });

  const deleteLevelMutation = useMutation({
    mutationFn: (id: number) => deleteLevel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["network:levels", stopId] }),
  });

  const savePathwayMutation = useMutation({
    mutationFn: (d: PathwayForm) => savePathway({ ...d, pathway_mode: d.pathway_mode as PathwayMode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["network:pathways", stopId] });
      setAddingPathway(false);
      pathwayForm.reset();
    },
  });

  const deletePathwayMutation = useMutation({
    mutationFn: (id: number) => deletePathway(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["network:pathways", stopId] }),
  });

  const handleExport = async () => {
    const blob = await exportPathwayFiles();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "pathways_gtfs.zip"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Station Anatomy — {stopName ?? stopId}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="levels" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="shrink-0">
            <TabsTrigger value="levels">Levels ({levels.length})</TabsTrigger>
            <TabsTrigger value="pathways">Pathways ({pathways.length})</TabsTrigger>
          </TabsList>

          {/* Levels Tab */}
          <TabsContent value="levels" className="flex-1 overflow-y-auto space-y-3 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Floor levels for this station</span>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => { setAddingLevel(true); setEditingLevel(null); levelForm.reset(); }}>
                <PlusIcon size={12} /> Add Level
              </Button>
            </div>

            {(addingLevel || editingLevel) && (
              <form onSubmit={levelForm.handleSubmit((d) => saveLevelMutation.mutate(d))}
                className="border rounded p-3 space-y-3 bg-muted/30">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Index</Label>
                    <Input className="h-8 text-xs" type="number" step="0.1"
                      {...levelForm.register("level_index")} placeholder="-1.0 / 0.0 / 1.0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input className="h-8 text-xs" {...levelForm.register("level_name")} placeholder="Ground floor" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" type="submit" className="h-7 text-xs" disabled={saveLevelMutation.isPending}>Save</Button>
                  <Button size="sm" variant="outline" type="button" className="h-7 text-xs"
                    onClick={() => { setAddingLevel(false); setEditingLevel(null); }}>Cancel</Button>
                </div>
              </form>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Index</TableHead>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map((l: Level) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs py-2">
                      <Badge variant="outline">{l.level_index}</Badge>
                    </TableCell>
                    <TableCell className="text-xs py-2">{l.level_name}</TableCell>
                    <TableCell className="py-2 text-right">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteLevelMutation.mutate(l.id)}>
                        <Trash2Icon size={12} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Pathways Tab */}
          <TabsContent value="pathways" className="flex-1 overflow-y-auto space-y-3 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Physical connections within this station</span>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => { setAddingPathway(true); pathwayForm.reset({ is_bidirectional: true }); }}>
                <PlusIcon size={12} /> Add Pathway
              </Button>
            </div>

            {addingPathway && (
              <form onSubmit={pathwayForm.handleSubmit((d) => savePathwayMutation.mutate(d))}
                className="border rounded p-3 space-y-3 bg-muted/30">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">From Stop ID</Label>
                    <Input className="h-8 text-xs" {...pathwayForm.register("from_stop_id")} placeholder="Stop ID" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To Stop ID</Label>
                    <Input className="h-8 text-xs" {...pathwayForm.register("to_stop_id")} placeholder="Stop ID" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Mode</Label>
                    <Select onValueChange={(v) => pathwayForm.setValue("pathway_mode", Number(v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select mode" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PATHWAY_MODE_LABELS).map(([v, label]) => (
                          <SelectItem key={v} value={v}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Traversal Time (s)</Label>
                    <Input className="h-8 text-xs" type="number" {...pathwayForm.register("traversal_time")} placeholder="120" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Length (m)</Label>
                    <Input className="h-8 text-xs" type="number" step="0.1" {...pathwayForm.register("length")} placeholder="50" />
                  </div>
                  <div className="flex items-end gap-2 pb-0.5">
                    <Switch
                      checked={pathwayForm.watch("is_bidirectional")}
                      onCheckedChange={(v) => pathwayForm.setValue("is_bidirectional", v)}
                    />
                    <Label className="text-xs">Bidirectional</Label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" type="submit" className="h-7 text-xs" disabled={savePathwayMutation.isPending}>Save</Button>
                  <Button size="sm" variant="outline" type="button" className="h-7 text-xs"
                    onClick={() => setAddingPathway(false)}>Cancel</Button>
                </div>
              </form>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">From → To</TableHead>
                  <TableHead className="text-xs">Mode</TableHead>
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pathways.map((p: Pathway) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs py-2">
                      <span className="font-mono">{p.from_stop_id}</span>
                      <span className="text-muted-foreground mx-1">→</span>
                      <span className="font-mono">{p.to_stop_id}</span>
                      {!p.is_bidirectional && <Badge variant="outline" className="ml-1 text-xs py-0">one-way</Badge>}
                    </TableCell>
                    <TableCell className="text-xs py-2">{PATHWAY_MODE_LABELS[p.pathway_mode] ?? p.pathway_mode}</TableCell>
                    <TableCell className="text-xs py-2">{p.traversal_time != null ? `${p.traversal_time}s` : "—"}</TableCell>
                    <TableCell className="py-2 text-right">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => deletePathwayMutation.mutate(p.id)}>
                        <Trash2Icon size={12} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>

        <div className="border-t pt-3 flex justify-end">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleExport}>
            <DownloadIcon size={12} /> Export pathways.txt + levels.txt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
