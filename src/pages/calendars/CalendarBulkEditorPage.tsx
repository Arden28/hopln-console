import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, eachWeekOfInterval, eachDayOfInterval, endOfWeek, startOfYear, endOfYear } from "date-fns";
import { fetchServiceCalendars, bulkExceptions } from "@/api/serviceCalendars";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceCalendar, ServiceException } from "@/types";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type DayName = typeof DAYS[number];

const DAY_TO_JS: Record<DayName, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
};

const KENYA_HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-06", name: "Easter Monday" },
  { date: "2026-05-01", name: "Labour Day" },
  { date: "2026-06-01", name: "Madaraka Day" },
  { date: "2026-10-10", name: "Huduma Day" },
  { date: "2026-10-20", name: "Mashujaa Day" },
  { date: "2026-12-12", name: "Jamhuri Day" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2026-12-26", name: "Boxing Day" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface PendingAdd {
  date: string;
  exception_type: 1 | 2;
}

function baseActive(calendar: ServiceCalendar, date: Date): boolean {
  const dayName = DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
  return !!calendar[dayName as keyof ServiceCalendar];
}

function resolveCell(
  calendar: ServiceCalendar,
  date: Date,
  pendingAdd: PendingAdd[],
  pendingRemove: number[]
): { active: boolean; exception: "added" | "removed" | null } {
  const dateStr = format(date, "yyyy-MM-dd");
  const base = baseActive(calendar, date);

  // Check pending removes (by exception id — we don't have it client-side, skip)
  const pendingEx = pendingAdd.find((p) => p.date === dateStr);
  if (pendingEx) {
    return { active: pendingEx.exception_type === 1, exception: pendingEx.exception_type === 1 ? "added" : "removed" };
  }

  const serverEx = calendar.exceptions?.find((e) => e.date === dateStr);
  if (serverEx && !pendingRemove.includes(serverEx.id)) {
    return {
      active: serverEx.exception_type === 1,
      exception: serverEx.exception_type === 1 ? "added" : "removed",
    };
  }

  return { active: base, exception: null };
}

export default function CalendarBulkEditorPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [year, setYear] = React.useState(new Date().getFullYear());
  const [pendingAdd, setPendingAdd] = React.useState<PendingAdd[]>([]);
  const [pendingRemove, setPendingRemove] = React.useState<number[]>([]);

  const { data: calendars, isLoading } = useQuery({
    queryKey: ["service-calendars"],
    queryFn: fetchServiceCalendars,
  });

  const { data: calendarDetail } = useQuery({
    queryKey: ["service-calendar", selectedId],
    queryFn: () => {
      const cal = calendars?.find((c) => c.service_id === selectedId);
      return cal ?? null;
    },
    enabled: !!selectedId && !!calendars,
  });

  const selectedCalendar = calendars?.find((c) => c.service_id === selectedId);

  const saveMutation = useMutation({
    mutationFn: () =>
      bulkExceptions(selectedId, { add: pendingAdd, remove: pendingRemove }),
    onSuccess: (res) => {
      toast.success(`Saved — ${res.added} added, ${res.removed} removed`);
      setPendingAdd([]);
      setPendingRemove([]);
      queryClient.invalidateQueries({ queryKey: ["service-calendars"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleCellClick(date: Date) {
    if (!selectedCalendar) return;
    const dateStr = format(date, "yyyy-MM-dd");
    const { active, exception } = resolveCell(selectedCalendar, date, pendingAdd, pendingRemove);

    // Remove pending for this date first
    setPendingAdd((p) => p.filter((x) => x.date !== dateStr));

    if (active && exception === null) {
      // Base active, no override → add remove exception
      setPendingAdd((p) => [...p, { date: dateStr, exception_type: 2 }]);
    } else if (active && exception === "added") {
      // Has add-exception → remove it (revert to base inactive)
      const servEx = selectedCalendar.exceptions?.find((e) => e.date === dateStr);
      if (servEx) setPendingRemove((r) => [...r, servEx.id]);
    } else if (!active && exception === null) {
      // Base inactive → add add-exception
      setPendingAdd((p) => [...p, { date: dateStr, exception_type: 1 }]);
    } else if (!active && exception === "removed") {
      // Has remove-exception → revert
      const servEx = selectedCalendar.exceptions?.find((e) => e.date === dateStr);
      if (servEx) setPendingRemove((r) => [...r, servEx.id]);
    }
  }

  function applyKenyaHolidays() {
    const adds: PendingAdd[] = KENYA_HOLIDAYS_2026.map((h) => ({
      date: h.date,
      exception_type: 2 as const,
    }));
    setPendingAdd((p) => {
      const existing = p.filter((x) => !adds.find((a) => a.date === x.date));
      return [...existing, ...adds];
    });
    toast.info(`${adds.length} Kenya public holidays marked as removed`);
  }

  // Build year grid
  const weeks = React.useMemo(() => {
    const start = startOfYear(new Date(year, 0, 1));
    const end = endOfYear(new Date(year, 0, 1));
    return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
  }, [year]);

  const hasPending = pendingAdd.length > 0 || pendingRemove.length > 0;

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Calendar Bulk Editor</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Click days to toggle service exceptions. Green = added, Red = removed.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={applyKenyaHolidays} disabled={!selectedId}>
            Apply Kenya holidays 2026
          </Button>
          <Button
            size="sm"
            disabled={!hasPending || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2Icon size={14} className="animate-spin" />
            ) : (
              <SaveIcon size={14} />
            )}
            Save{hasPending ? ` (${pendingAdd.length + pendingRemove.length})` : ""}
          </Button>
        </div>
      </div>

      {/* Calendar selector pills */}
      {isLoading ? (
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-24" />)}
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {(calendars ?? []).map((cal) => (
            <Button
              key={cal.service_id}
              size="sm"
              variant={selectedId === cal.service_id ? "default" : "outline"}
              onClick={() => {
                setSelectedId(cal.service_id);
                setPendingAdd([]);
                setPendingRemove([]);
              }}
            >
              {cal.name}
            </Button>
          ))}
        </div>
      )}

      {!selectedId && (
        <div className="text-center text-muted-foreground py-20 text-sm">
          Select a calendar above to edit its exceptions.
        </div>
      )}

      {selectedId && selectedCalendar && (
        <div className="flex gap-3 items-center flex-wrap">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm bg-background"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Active days: {DAYS.filter((d) => selectedCalendar[d as keyof ServiceCalendar]).map((d) => d.slice(0, 3)).join(", ")}
          </span>
        </div>
      )}

      {selectedId && selectedCalendar && (
        <div className="overflow-x-auto">
          {/* Month labels */}
          <div className="flex text-[10px] text-muted-foreground mb-1 gap-0.5 min-w-max">
            {weeks.map((week, i) => {
              const m = week.getMonth();
              const prev = i > 0 ? weeks[i - 1].getMonth() : -1;
              return (
                <div key={i} className="w-[14px] shrink-0">
                  {m !== prev ? MONTHS[m] : ""}
                </div>
              );
            })}
          </div>

          {/* Day rows */}
          {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => (
            <div key={dayOfWeek} className="flex gap-0.5 mb-0.5 min-w-max">
              {weeks.map((week, wi) => {
                const day = new Date(week);
                day.setDate(week.getDate() + dayOfWeek);

                if (day.getFullYear() !== year) {
                  return <div key={wi} className="w-[14px] h-[14px] shrink-0" />;
                }

                const { active, exception } = resolveCell(
                  selectedCalendar,
                  day,
                  pendingAdd,
                  pendingRemove
                );

                const holidayInfo = KENYA_HOLIDAYS_2026.find(
                  (h) => h.date === format(day, "yyyy-MM-dd")
                );

                return (
                  <div
                    key={wi}
                    title={`${format(day, "yyyy-MM-dd")}${holidayInfo ? ` — ${holidayInfo.name}` : ""}`}
                    onClick={() => handleCellClick(day)}
                    className={cn(
                      "w-[14px] h-[14px] rounded-[2px] shrink-0 cursor-pointer transition-colors",
                      active && exception === null && "bg-primary/20 hover:bg-primary/40",
                      active && exception === "added" && "bg-emerald-200 ring-1 ring-emerald-500 hover:bg-emerald-300",
                      !active && exception === null && "bg-muted/40 hover:bg-muted/70",
                      !active && exception === "removed" && "bg-rose-200 ring-1 ring-rose-400 hover:bg-rose-300"
                    )}
                  />
                );
              })}
            </div>
          ))}

          {/* Legend */}
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            {[
              { color: "bg-primary/20", label: "Active (base)" },
              { color: "bg-emerald-200 ring-1 ring-emerald-500", label: "Exception added" },
              { color: "bg-muted/40", label: "Inactive (base)" },
              { color: "bg-rose-200 ring-1 ring-rose-400", label: "Exception removed" },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={cn("inline-block w-3 h-3 rounded-[2px]", color)} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
