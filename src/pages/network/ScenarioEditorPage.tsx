import * as React from "react";
import { useParams, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchScenario,
  removeScenarioOverride,
  publishScenario,
} from "@/api/scenarios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  ArrowLeftIcon,
  FlaskConicalIcon,
  Loader2Icon,
  TrashIcon,
  UploadCloudIcon,
} from "lucide-react";
import type { ScenarioOverride } from "@/types";

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  add:    "default",
  modify: "secondary",
  delete: "destructive",
};

function OverrideRow({
  override,
  onRemove,
}: {
  override: ScenarioOverride;
  onRemove: (id: number) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="border-b px-4 py-3">
      <div className="flex items-center gap-3">
        <Badge variant={ACTION_VARIANTS[override.action] ?? "outline"} className="text-[10px] shrink-0">
          {override.action}
        </Badge>
        <span className="text-sm font-medium capitalize">{override.entity_type}</span>
        {override.entity_id && (
          <span className="text-xs text-muted-foreground font-mono">{override.entity_id}</span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? "Hide" : "Show"} data
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onRemove(override.id)}
        >
          <TrashIcon size={12} />
        </Button>
      </div>
      {expanded && (
        <pre className="mt-2 text-xs bg-muted rounded p-3 overflow-auto whitespace-pre-wrap">
          {JSON.stringify(override.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function ScenarioEditorPage() {
  const { id } = useParams({ from: "/network/scenarios/$id" });
  const router  = useRouter();
  const qc      = useQueryClient();
  const [publishConfirm, setPublishConfirm] = React.useState(false);

  const { data: scenario, isLoading } = useQuery({
    queryKey: ["scenario", id],
    queryFn: () => fetchScenario(Number(id)),
    staleTime: 30_000,
  });

  const removeMutation = useMutation({
    mutationFn: (oid: number) => removeScenarioOverride(Number(id), oid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenario", id] });
      toast.success("Override removed.");
    },
    onError: () => toast.error("Failed to remove override."),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishScenario(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenarios"] });
      qc.invalidateQueries({ queryKey: ["scenario", id] });
      toast.success("Scenario published and applied to production.");
      setPublishConfirm(false);
    },
    onError: () => toast.error("Failed to publish scenario."),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!scenario) return null;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.history.back()}>
          <ArrowLeftIcon size={15} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <FlaskConicalIcon size={16} />
            <h1 className="text-lg font-semibold">{scenario.name}</h1>
            <Badge variant={scenario.status === "published" ? "default" : "outline"} className="text-[10px]">
              {scenario.status}
            </Badge>
          </div>
          {scenario.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{scenario.description}</p>
          )}
        </div>
        {scenario.status === "draft" && (
          <Button
            size="sm"
            onClick={() => setPublishConfirm(true)}
            disabled={publishMutation.isPending}
          >
            {publishMutation.isPending ? (
              <Loader2Icon size={13} className="mr-1.5 animate-spin" />
            ) : (
              <UploadCloudIcon size={13} className="mr-1.5" />
            )}
            Publish
          </Button>
        )}
      </div>

      {/* Overrides */}
      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <span className="text-sm font-medium">
            Overrides ({scenario.overrides?.length ?? 0})
          </span>
        </div>

        {!scenario.overrides?.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No overrides yet. Overrides define what changes this scenario applies to the network.
          </div>
        ) : (
          <div className="divide-y">
            {scenario.overrides.map((o) => (
              <OverrideRow
                key={o.id}
                override={o}
                onRemove={(oid) => removeMutation.mutate(oid)}
              />
            ))}
          </div>
        )}
      </div>

      {scenario.published_at && (
        <p className="text-xs text-muted-foreground">
          Published {new Date(scenario.published_at).toLocaleString()}
        </p>
      )}

      {/* Publish confirm */}
      <AlertDialog open={publishConfirm} onOpenChange={setPublishConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              All {scenario.overrides?.length ?? 0} override(s) will be applied to production data
              in a single database transaction. This cannot be undone automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => publishMutation.mutate()}>
              {publishMutation.isPending ? (
                <Loader2Icon size={13} className="animate-spin" />
              ) : (
                "Publish"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
