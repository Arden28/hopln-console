import { apiService } from "./client";
import type { TimetableData } from "@/types";

export async function fetchTimetable(
  routeId: string,
  directionId: 0 | 1 = 0
): Promise<TimetableData> {
  const res = await apiService.get<TimetableData>(
    `/v1/console/routes/${routeId}/timetable?direction_id=${directionId}`
  );
  return res.data;
}

export async function saveTimetable(
  routeId: string,
  trips: Array<{ trip_id: string; times: Record<string, string> }>
): Promise<{ message: string; trip_count: number; stop_time_count: number }> {
  const res = await apiService.put<{ message: string; trip_count: number; stop_time_count: number }>(
    `/v1/console/routes/${routeId}/timetable`,
    { trips }
  );
  return res.data;
}
