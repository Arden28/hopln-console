import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScanSearchIcon, Loader2Icon, MergeIcon } from "lucide-react";
import { fetchDuplicateStops, mergeStops } from "@/api/quality";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { DuplicateStopPair } from "@/types";

interface MergeState {
  pair: DuplicateStopPair;
  keepId: string;
}

export default function DuplicateDetectorPage() {
  const queryClient = useQueryClient();
  const [radius, setRadius]       = React.useState<number>(50);
  const [scanning, setScanning]   = React.useState(false);
  const [mergeState, setMergeState] = React.useState<MergeState | null>(null);

  const { data, isLoading, refetch } = useQuery<{ pairs: DuplicateStopPair[]; radius_m: number }>({
    queryKey: ["quality:duplicate-stops", radius],
    queryFn:  () => fetchDuplicateStops(radius),
    enabled:  scanning,
  });

  const mergeMutation = useMutation({
    mutationFn: () => {
      if (!mergeState) throw new Error("No merge state");
      const duplicateId = mergeState.keepId === mergeState.pair.stop_a.id
        ? mergeState.pair.stop_b.id
        : mergeState.pair.stop_a.id;
      return mergeStops(mergeState.keepId, duplicateId);
    },
    onSuccess: (res) => {
      toast.success(`Merged. ${res.stop_times_redirected} stop times redirected.`);
      setMergeState(null);
      queryClient.invalidateQueries({ queryKey: ["quality:duplicate-stops"] });
      refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function runScan() {
    setScanning(true);
    refetch();
  }

  const pairs = data?.pairs ?? [];

  return (
    <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold">Duplicate Stop Detector</h1>

      {/* Controls */}
      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">Proximity radius (meters)</Label>
          <Input
            type="number"
            min={10}
            max={500}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="h-8 w-28 text-sm"
          />
        </div>
        <Button onClick={runScan} disabled={isLoading}>
          {isLoading
            ? <Loader2Icon size={14} className="animate-spin" />
            : <ScanSearchIcon size={14} />}
          Scan for duplicates
        </Button>
        {data && (
          <span className="text-sm text-muted-foreground self-end">
            {pairs.length} pair{pairs.length !== 1 ? "s" : ""} found within {data.radius_m}m
          </span>
        )}
      </div>

      {!scanning && (
        <div className="text-center text-muted-foreground py-20 text-sm">
          Click "Scan for duplicates" to find stop pairs within the proximity radius.
        </div>
      )}

      {scanning && isLoading && <Skeleton className="h-64 w-full" />}

      {scanning && !isLoading && pairs.length === 0 && (
        <div className="text-center text-muted-foreground py-20 text-sm">
          No duplicate stops found within {radius}m.
        </div>
      )}

      {pairs.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground">
                <th className="text-left p-3 font-medium">Stop A</th>
                <th className="text-left p-3 font-medium">Stop B</th>
                <th className="text-left p-3 font-medium">Distance</th>
                <th className="text-left p-3 font-medium">Name similarity</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {pairs.map((pair, i) => (
                <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <div className="font-medium">{pair.stop_a.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{pair.stop_a.id}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{pair.stop_b.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{pair.stop_b.id}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant={pair.distance_m < 20 ? "destructive" : "secondary"} className="text-xs">
                      {pair.distance_m}m
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full bg-muted flex-1 max-w-[80px]">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${pair.name_similarity * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(pair.name_similarity * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setMergeState({ pair, keepId: pair.stop_a.id })}
                    >
                      <MergeIcon size={12} />
                      Merge
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Merge dialog */}
      {mergeState && (
        <Dialog open onOpenChange={() => setMergeState(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Merge duplicate stops</DialogTitle>
            </DialogHeader>

            <p className="text-sm text-muted-foreground">
              Choose which stop to keep. The other stop will be deleted and all its stop times
              and route patterns will be reassigned.
            </p>

            <div className="space-y-2 mt-2">
              {[mergeState.pair.stop_a, mergeState.pair.stop_b].map((stop) => (
                <label
                  key={stop.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    mergeState.keepId === stop.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="keep"
                    value={stop.id}
                    checked={mergeState.keepId === stop.id}
                    onChange={() => setMergeState((s) => s ? { ...s, keepId: stop.id } : s)}
                    className="accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium">{stop.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{stop.id}</div>
                    <div className="text-xs text-muted-foreground">
                      {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
                    </div>
                  </div>
                  {mergeState.keepId === stop.id && (
                    <Badge className="ml-auto text-[10px]">Keep</Badge>
                  )}
                </label>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setMergeState(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => mergeMutation.mutate()}
                disabled={mergeMutation.isPending}
              >
                {mergeMutation.isPending && <Loader2Icon size={14} className="animate-spin" />}
                Merge — keep {mergeState.keepId === mergeState.pair.stop_a.id
                  ? mergeState.pair.stop_a.name
                  : mergeState.pair.stop_b.name}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
