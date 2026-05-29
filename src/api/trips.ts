import { apiService, buildQuery } from "./client";
import type { Trip, Stop, PaginatedResponse } from "@/types";

export interface FetchTripsParams {
  page?: number;
  per_page?: number;
  search?: string;
  route_id?: string;
  service_id?: string;
  direction_id?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export async function fetchTrips(
  params: FetchTripsParams = {}
): Promise<PaginatedResponse<Trip>> {
  const res = await apiService.get<PaginatedResponse<Trip>>(
    `/v1/console/trips${buildQuery(params as Record<string, unknown>)}`
  );
  return res.data;
}

export async function fetchTrip(id: string): Promise<Trip> {
  const res = await apiService.get<Trip>(`/v1/console/trips/${id}`);
  return res.data;
}

export async function createTrip(data: Partial<Trip>): Promise<Trip> {
  const res = await apiService.post<Trip>("/v1/console/trips", data);
  return res.data;
}

export async function updateTrip(id: string, data: Partial<Trip>): Promise<Trip> {
  const res = await apiService.patch<Trip>(`/v1/console/trips/${id}`, data);
  return res.data;
}

export async function deleteTrip(id: string): Promise<void> {
  await apiService.delete(`/v1/console/trips/${id}`);
}

export async function saveTripShape(
  tripId: string,
  points: [number, number][]
): Promise<{ shape_id: string }> {
  const res = await apiService.put<{ shape_id: string }>(
    `/v1/console/trips/${tripId}/shape`,
    { points }
  );
  return res.data;
}

export interface TripStopInput {
  stop_id: string;
  arrival_time: string;
  departure_time: string;
}

export async function saveTripStopTimes(
  tripId: string,
  stops: TripStopInput[]
): Promise<void> {
  await apiService.put(`/v1/console/trips/${tripId}/stop-times`, { stops });
}

export async function stopsNearTripLine(
  points: [number, number][],
  radius = 200
): Promise<Stop[]> {
  const res = await apiService.post<Stop[]>("/v1/console/trips/stops-near-line", {
    points,
    radius,
  });
  return res.data;
}
