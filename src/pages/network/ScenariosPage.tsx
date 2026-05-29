import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchScenarios, createScenario, deleteScenario } from "@/api/scenarios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FlaskConicalIcon, PlusIcon, Loader2Icon, PencilIcon, TrashIcon } from "lucide-react";
import type { NetworkScenario } from "@/types";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  draft:     "outline",
  published: "default",
  archived:  "secondary",
};

export default function ScenariosPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");

  const { data: scenarios = [], isLoading } = useQuery({
    queryKey: ["scenarios"],
    queryFn: fetchScenarios,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: () => createScenario({ name, description: desc || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenarios"] });
      toast.success("Scenario created.");
      setCreateOpen(false);
      setName("");
      setDesc("");
    },
    onError: () => toast.error("Failed to create scenario."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteScenario(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenarios"] });
      toast.success("Scenario deleted.");
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete scenario."),
  });

  const toDelete = scenarios.find((s) => s.id === deleteId);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FlaskConicalIcon size={18} />
            Scenarios
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Draft what-if network changes without affecting production.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon size={14} className="mr-1.5" />
          New Scenario
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : scenarios.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No scenarios yet. Create one to start modeling network changes.
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {scenarios.map((s) => (
            <div key={s.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{s.name}</span>
                  <Badge variant={STATUS_VARIANTS[s.status] ?? "outline"} className="text-[10px]">
                    {s.status}
                  </Badge>
                  {s.overrides_count !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {s.overrides_count} override{s.overrides_count !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {s.description && (
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{s.description}</div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                  <Link to="/network/scenarios/$id" params={{ id: String(s.id) }}>
                    <PencilIcon size={13} />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(s.id)}
                >
                  <TrashIcon size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Scenario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. Route 46 Extension"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                placeholder="What does this scenario test?"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && <Loader2Icon size={13} className="mr-1.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.name}" and all its overrides will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? <Loader2Icon size={13} className="animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
