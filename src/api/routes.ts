import { apiService, buildQuery } from "./client";
import type { Route, Stop, PaginatedResponse } from "@/types";

export interface FetchRoutesParams {
  page?: number;
  per_page?: number;
  search?: string;
  route_type?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export async function fetchRoutes(
  params: FetchRoutesParams = {}
): Promise<PaginatedResponse<Route>> {
  const res = await apiService.get<PaginatedResponse<Route>>(
    `/v1/console/routes${buildQuery(params as Record<string, unknown>)}`
  );
  return res.data;
}

export async function fetchRoute(id: string): Promise<Route> {
  const res = await apiService.get<Route>(`/v1/console/routes/${id}`);
  return res.data;
}

export async function createRoute(data: Partial<Route>): Promise<Route> {
  const res = await apiService.post<Route>("/v1/console/routes", data);
  return res.data;
}

export async function updateRoute(id: string, data: Partial<Route>): Promise<Route> {
  const res = await apiService.patch<Route>(`/v1/console/routes/${id}`, data);
  return res.data;
}

export async function deleteRoute(id: string): Promise<void> {
  await apiService.delete(`/v1/console/routes/${id}`);
}

export async function saveRouteShape(
  routeId: string,
  points: [number, number][]
): Promise<{ shape_id: string }> {
  const res = await apiService.put<{ shape_id: string }>(
    `/v1/console/routes/${routeId}/shape`,
    { points }
  );
  return res.data;
}

export interface TripStop {
  stop_id: string;
  arrival_time: string;
  departure_time: string;
}

export async function saveRouteTripStops(
  routeId: string,
  stops: TripStop[],
  shapeId?: string | null,
  headsign?: string
): Promise<void> {
  await apiService.put(`/v1/console/routes/${routeId}/trip-stops`, {
    stops,
    shape_id: shapeId ?? null,
    headsign,
  });
}

export async function stopsNearLine(
  points: [number, number][],
  radius = 200
): Promise<Stop[]> {
  const res = await apiService.post<Stop[]>("/v1/console/routes/stops-near-line", {
    points,
    radius,
  });
  return res.data;
}
