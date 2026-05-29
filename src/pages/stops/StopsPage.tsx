import * as React from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { fetchStops, deleteStop } from "@/api/stops";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  SearchIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  MapPinIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
} from "lucide-react";
import type { Stop } from "@/types";

const LOCATION_TYPE: Record<number, { label: string; variant: "outline" | "secondary" }> = {
  0: { label: "Stop", variant: "outline" },
  1: { label: "Station", variant: "secondary" },
};

export function StopsPage() {
  const qc = useQueryClient();

  const [page, setPage]     = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [type, setType]     = React.useState("");
  const [sort, setSort]     = React.useState("updated_at");
  const [deleteTarget, setDeleteTarget] = React.useState<Stop | null>(null);

  // Reset to page 1 when filters change
  React.useEffect(() => { setPage(1); }, [search, type, sort]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["stops", page, 30, search, type, sort],
    queryFn: () =>
      fetchStops({
        page,
        per_page: 30,
        search: search || undefined,
        type: type || undefined,
        sort,
      }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const stops    = data?.data ?? [];
  const lastPage = data?.last_page ?? 1;
  const total    = data?.total ?? 0;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStop(id),
    onSuccess: () => {
      toast.success("Stop deleted");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["stops"] });
    },
    onError: () => toast.error("Failed to delete stop"),
  });

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-45 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={type === "" ? "all" : type} onValueChange={(v) => setType(v === "all" ? "" : v)}>
          <SelectTrigger className="w-32.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="0">Stops</SelectItem>
            <SelectItem value="1">Stations</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-37.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_at">Last updated</SelectItem>
            <SelectItem value="popularity_score">Popularity</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="trip_count">Trip count</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground sm:ml-auto">
          {!isLoading && <>{total.toLocaleString()} stops</>}
        </span>

        <Button asChild>
          <Link to="/stops/new">
            <PlusIcon className="mr-1.5 size-4" />
            New stop
          </Link>
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Stop ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Coordinates</TableHead>
              <TableHead>Routes</TableHead>
              <TableHead>Popularity</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full max-w-30" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : stops.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                  No stops found
                </TableCell>
              </TableRow>
            ) : (
              stops.map((stop) => {
                const locType = stop.location_t != null ? LOCATION_TYPE[stop.location_t] : null;
                const routeNames = stop.route_nams
                  ? stop.route_nams.split(",").filter(Boolean)
                  : [];
                const visibleRoutes = routeNames.slice(0, 3);
                const extraRoutes   = routeNames.length - visibleRoutes.length;

                return (
                  <TableRow key={stop.id} className="hover:bg-muted/30 group">
                    <TableCell className="font-mono text-xs text-muted-foreground">{stop.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <MapPinIcon className="size-3.5 text-primary shrink-0" />
                        <span className="text-sm font-medium">{stop.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {locType ? (
                        <Badge variant={locType.variant} className="text-xs">{locType.label}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {stop.lat?.toFixed(5) ?? '—'}, {stop.lng?.toFixed(5) ?? '—'}
                    </TableCell>
                    <TableCell>
                      {visibleRoutes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {visibleRoutes.map((r) => (
                            <Badge key={r} variant="outline" className="text-xs px-1.5 py-0">{r}</Badge>
                          ))}
                          {extraRoutes > 0 && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">+{extraRoutes}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {stop.popularity_score != null ? `Score ${stop.popularity_score}` : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button asChild variant="ghost" size="icon" className="size-7">
                          <Link to="/stops/$id/edit" params={{ id: stop.id }}>
                            <PencilIcon className="size-3.5" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(stop)}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && lastPage > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeftIcon className="size-4" />
            Prev
          </Button>

          <span className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-22.5 justify-center">
            {isFetching && <Loader2Icon className="size-3.5 animate-spin" />}
            Page {page} of {lastPage}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page === lastPage}
          >
            Next
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stop?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.id}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
