import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  fetchServiceCalendars,
  deleteServiceCalendar,
} from "@/api/serviceCalendars";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PlusIcon, PencilIcon, Trash2Icon, CalendarDaysIcon } from "lucide-react";
import type { ServiceCalendar } from "@/types";

const DAYS = [
  { key: "monday",    label: "M" },
  { key: "tuesday",   label: "T" },
  { key: "wednesday", label: "W" },
  { key: "thursday",  label: "T" },
  { key: "friday",    label: "F" },
  { key: "saturday",  label: "S" },
  { key: "sunday",    label: "S" },
] as const;

function DayChips({ calendar }: { calendar: ServiceCalendar }) {
  return (
    <div className="flex gap-0.5">
      {DAYS.map((d) => (
        <span
          key={d.key}
          className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-semibold
            ${calendar[d.key]
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
            }`}
        >
          {d.label}
        </span>
      ))}
    </div>
  );
}

export default function ServiceCalendarsPage() {
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = React.useState<ServiceCalendar | null>(null);

  const { data: calendars, isLoading } = useQuery({
    queryKey: ["service-calendars"],
    queryFn: fetchServiceCalendars,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteServiceCalendar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-calendars"] });
      toast.success("Calendar deleted.");
      setDeleteTarget(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? "Failed to delete calendar.");
      setDeleteTarget(null);
    },
  });

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Service Calendars</h1>
          <p className="text-sm text-muted-foreground">
            GTFS calendar.txt — define when services operate
          </p>
        </div>
        <Button asChild>
          <Link to="/calendars/new">
            <PlusIcon size={14} className="mr-1.5" />
            New Calendar
          </Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Date Range</TableHead>
              <TableHead className="text-right">Trips</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : calendars?.map((cal) => (
                  <TableRow key={cal.service_id}>
                    <TableCell className="font-mono text-sm">{cal.service_id}</TableCell>
                    <TableCell className="font-medium">{cal.name}</TableCell>
                    <TableCell>
                      <DayChips calendar={cal} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cal.start_date} — {cal.end_date}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{cal.trips_count ?? 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" asChild>
                              <Link to="/calendars/$id/edit" params={{ id: cal.service_id }}>
                                <PencilIcon size={14} />
                              </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              disabled={(cal.trips_count ?? 0) > 0}
                              onClick={() => setDeleteTarget(cal)}
                            >
                              <Trash2Icon size={14} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {(cal.trips_count ?? 0) > 0
                              ? "Cannot delete — has associated trips"
                              : "Delete"}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

            {!isLoading && (!calendars || calendars.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <CalendarDaysIcon size={32} className="mx-auto mb-2 opacity-30" />
                  No service calendars yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the service calendar. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.service_id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
