import * as React from "react";
import type { TimetableStop, TimetableTrip } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  stops: TimetableStop[];
  trips: TimetableTrip[];
  times: Record<string, Record<string, string>>; // [tripId][stopId] = "HH:MM:SS"
  onChange: (tripId: string, stopId: string, value: string) => void;
  isDirty: boolean;
}

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function TimetableGrid({ stops, trips, times, onChange }: Props) {
  // cellRefs[stopIdx][tripIdx]
  const cellRefs = React.useRef<(HTMLInputElement | null)[][]>([]);

  React.useEffect(() => {
    cellRefs.current = stops.map(() => trips.map(() => null));
  }, [stops.length, trips.length]);

  function setRef(stopIdx: number, tripIdx: number) {
    return (el: HTMLInputElement | null) => {
      if (!cellRefs.current[stopIdx]) cellRefs.current[stopIdx] = [];
      cellRefs.current[stopIdx][tripIdx] = el;
    };
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    stopIdx: number,
    tripIdx: number,
    tripId: string,
    stopId: string
  ) {
    const rows = stops.length;
    const cols = trips.length;

    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const nextTripIdx = tripIdx + 1 < cols ? tripIdx + 1 : 0;
      const nextStopIdx = tripIdx + 1 < cols ? stopIdx : stopIdx + 1;
      cellRefs.current[nextStopIdx]?.[nextTripIdx]?.focus();
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const prevTripIdx = tripIdx - 1 >= 0 ? tripIdx - 1 : cols - 1;
      const prevStopIdx = tripIdx - 1 >= 0 ? stopIdx : stopIdx - 1;
      cellRefs.current[prevStopIdx]?.[prevTripIdx]?.focus();
    } else if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      if (stopIdx + 1 < rows) cellRefs.current[stopIdx + 1]?.[tripIdx]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (stopIdx - 1 >= 0) cellRefs.current[stopIdx - 1]?.[tripIdx]?.focus();
    }
  }

  // Shift+change: fill headway down the column
  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>,
    stopIdx: number,
    tripIdx: number,
    tripId: string,
    stopId: string
  ) {
    const value = e.target.value;
    onChange(tripId, stopId, value);

    if (e.nativeEvent instanceof InputEvent && (e.nativeEvent as InputEvent & { shiftKey?: boolean }).shiftKey) {
      fillHeadwayDown(value, stopIdx, tripIdx, tripId);
    }
  }

  function fillHeadwayDown(
    newValue: string,
    stopIdx: number,
    tripIdx: number,
    tripId: string
  ) {
    // Detect headway from first two trips at this stop
    if (trips.length < 2 || stopIdx > 0) return;
    const t0 = times[trips[0].trip_id]?.[stops[stopIdx]?.stop_id];
    const t1 = times[trips[1].trip_id]?.[stops[stopIdx]?.stop_id];
    if (!t0 || !t1) return;
    const delta = timeToMins(t1) - timeToMins(t0);
    if (delta <= 0) return;

    const baseMins = timeToMins(newValue);
    for (let si = stopIdx + 1; si < stops.length; si++) {
      const prevValue = times[tripId]?.[stops[si - 1]?.stop_id];
      if (!prevValue) break;
      const offset = timeToMins(prevValue) - timeToMins(times[tripId]?.[stops[stopIdx]?.stop_id] ?? newValue);
      onChange(tripId, stops[si].stop_id, minsToTime(baseMins + offset));
    }
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="text-sm border-collapse min-w-max">
        <thead>
          <tr className="bg-muted/50">
            <th className="sticky left-0 z-10 bg-muted/80 px-3 py-2 text-left font-medium whitespace-nowrap min-w-[160px] border-b border-r">
              Stop
            </th>
            {trips.map((trip) => (
              <th
                key={trip.trip_id}
                className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[90px] border-b border-r text-xs text-muted-foreground"
              >
                {trip.trip_headsign ?? trip.trip_id.slice(-8)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stops.map((stop, stopIdx) => (
            <tr key={stop.stop_id} className="hover:bg-muted/20">
              <td className="sticky left-0 z-10 bg-background px-3 py-1 font-medium whitespace-nowrap border-b border-r text-sm">
                {stop.stop_name}
              </td>
              {trips.map((trip, tripIdx) => {
                const val = times[trip.trip_id]?.[stop.stop_id] ?? "";
                return (
                  <td key={trip.trip_id} className="px-1 py-0.5 border-b border-r">
                    <input
                      ref={setRef(stopIdx, tripIdx)}
                      type="text"
                      value={val}
                      placeholder="--:--:--"
                      onChange={(e) => handleChange(e, stopIdx, tripIdx, trip.trip_id, stop.stop_id)}
                      onKeyDown={(e) => handleKeyDown(e, stopIdx, tripIdx, trip.trip_id, stop.stop_id)}
                      className={cn(
                        "w-20 px-1.5 py-0.5 text-xs rounded border border-transparent",
                        "focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary",
                        "hover:border-input bg-transparent font-mono",
                        val && "text-foreground"
                      )}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
