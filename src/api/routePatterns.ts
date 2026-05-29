import { apiService, buildQuery } from "./client";
import type { RoutePattern, RoutePatternStop } from "@/types";

export interface FetchRoutePatternsParams {
  route_id?: string;
}

export async function fetchRoutePatterns(
  params: FetchRoutePatternsParams = {}
): Promise<RoutePattern[]> {
  const res = await apiService.get<RoutePattern[]>(
    `/v1/console/route-patterns${buildQuery(params as Record<string, unknown>)}`
  );
  return res.data;
}

export async function createRoutePattern(
  data: Omit<RoutePattern, "pattern_stops" | "trips_count">
): Promise<RoutePattern> {
  const res = await apiService.post<RoutePattern>("/v1/console/route-patterns", data);
  return res.data;
}

export async function updateRoutePattern(
  id: string,
  data: Partial<RoutePattern>
): Promise<RoutePattern> {
  const res = await apiService.patch<RoutePattern>(`/v1/console/route-patterns/${id}`, data);
  return res.data;
}

export async function deleteRoutePattern(id: string): Promise<void> {
  await apiService.delete(`/v1/console/route-patterns/${id}`);
}

export type PatternStopInput = Pick<
  RoutePatternStop,
  "stop_id" | "timepoint" | "pickup_type" | "drop_off_type" | "distance_traveled"
>;

export async function savePatternStops(
  id: string,
  stops: PatternStopInput[]
): Promise<void> {
  await apiService.put(`/v1/console/route-patterns/${id}/stops`, { stops });
}
