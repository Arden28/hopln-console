import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  fetchServiceCalendar,
  createServiceCalendar,
  updateServiceCalendar,
  addCalendarException,
  removeCalendarException,
} from "@/api/serviceCalendars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2Icon, PlusIcon, Loader2Icon, ArrowLeftIcon } from "lucide-react";
import type { ServiceCalendar } from "@/types";

const DAYS = [
  { key: "monday",    label: "Mon" },
  { key: "tuesday",   label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday",  label: "Thu" },
  { key: "friday",    label: "Fri" },
  { key: "saturday",  label: "Sat" },
  { key: "sunday",    label: "Sun" },
] as const;

type DayKey = (typeof DAYS)[number]["key"];

type CalendarForm = {
  service_id: string;
  name: string;
  start_date: string;
  end_date: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
};

const defaultForm: CalendarForm = {
  service_id: "",
  name: "",
  start_date: "2026-01-01",
  end_date: "2027-12-31",
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
};

export default function ServiceCalendarEditorPage() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = React.useState<CalendarForm>(defaultForm);
  const [newException, setNewException] = React.useState({
    date: "",
    exception_type: "1" as "1" | "2",
    note: "",
  });

  const { data: existing, isLoading } = useQuery({
    queryKey: ["service-calendar", id],
    queryFn: () => fetchServiceCalendar(id!),
    enabled: isEdit,
  });

  React.useEffect(() => {
    if (existing) {
      setForm({
        service_id: existing.service_id,
        name: existing.name,
        start_date: existing.start_date,
        end_date: existing.end_date,
        monday: existing.monday,
        tuesday: existing.tuesday,
        wednesday: existing.wednesday,
        thursday: existing.thursday,
        friday: existing.friday,
        saturday: existing.saturday,
        sunday: existing.sunday,
      });
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: isEdit
      ? () => updateServiceCalendar(id!, form)
      : () => createServiceCalendar(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-calendars"] });
      if (isEdit) qc.invalidateQueries({ queryKey: ["service-calendar", id] });
      toast.success(isEdit ? "Calendar updated." : "Calendar created.");
      navigate({ to: "/calendars" });
    },
    onError: () => toast.error("Failed to save calendar."),
  });

  const addExceptionMutation = useMutation({
    mutationFn: () =>
      addCalendarException(id!, {
        date: newException.date,
        exception_type: parseInt(newException.exception_type) as 1 | 2,
        note: newException.note || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-calendar", id] });
      setNewException({ date: "", exception_type: "1", note: "" });
      toast.success("Exception added.");
    },
    onError: () => toast.error("Failed to add exception."),
  });

  const removeExceptionMutation = useMutation({
    mutationFn: (eid: number) => removeCalendarException(id!, eid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-calendar", id] });
      toast.success("Exception removed.");
    },
    onError: () => toast.error("Failed to remove exception."),
  });

  if (isEdit && isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/calendars" })}>
          <ArrowLeftIcon size={16} />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">
            {isEdit ? "Edit Calendar" : "New Calendar"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Define operating days and date range for this service
          </p>
        </div>
      </div>

      <div className="rounded-md border p-4 space-y-4">
        {!isEdit && (
          <div className="space-y-1.5">
            <Label>Service ID</Label>
            <Input
              placeholder="e.g. weekdays"
              value={form.service_id}
              onChange={(e) => setForm((f) => ({ ...f, service_id: e.target.value }))}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input
            placeholder="e.g. Weekdays"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>End Date</Label>
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Operating Days</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setForm((f) => ({ ...f, [d.key]: !f[d.key as DayKey] }))}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors
                  ${form[d.key as DayKey]
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-foreground"
                  }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && <Loader2Icon size={14} className="mr-1.5 animate-spin" />}
          {isEdit ? "Save Changes" : "Create Calendar"}
        </Button>
      </div>

      {isEdit && (
        <div className="rounded-md border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-medium">Exceptions</h2>
            <span className="text-xs text-muted-foreground">
              Overrides for specific dates (calendar_dates.txt)
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {existing?.exceptions?.map((ex) => (
                <TableRow key={ex.id}>
                  <TableCell className="font-mono text-sm">{ex.date}</TableCell>
                  <TableCell>
                    <Badge variant={ex.exception_type === 1 ? "default" : "destructive"}>
                      {ex.exception_type === 1 ? "Added" : "Removed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ex.note ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeExceptionMutation.mutate(ex.id)}
                    >
                      <Trash2Icon size={13} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              <TableRow>
                <TableCell>
                  <Input
                    type="date"
                    value={newException.date}
                    onChange={(e) =>
                      setNewException((s) => ({ ...s, date: e.target.value }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={newException.exception_type}
                    onValueChange={(v) =>
                      setNewException((s) => ({ ...s, exception_type: v as "1" | "2" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Added</SelectItem>
                      <SelectItem value="2">Removed</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="e.g. Christmas Day"
                    value={newException.note}
                    onChange={(e) =>
                      setNewException((s) => ({ ...s, note: e.target.value }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={!newException.date || addExceptionMutation.isPending}
                    onClick={() => addExceptionMutation.mutate()}
                  >
                    <PlusIcon size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
