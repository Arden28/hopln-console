import { apiService, buildQuery } from "./client";
import type { Stop, StopTime, PaginatedResponse } from "@/types";

export interface FetchStopsParams {
  page?: number;
  per_page?: number;
  search?: string;
  type?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export async function fetchStops(
  params: FetchStopsParams = {}
): Promise<PaginatedResponse<Stop>> {
  const res = await apiService.get<PaginatedResponse<Stop>>(
    `/v1/console/stops${buildQuery(params)}`
  );
  return res.data;
}

export async function fetchStop(id: string): Promise<Stop> {
  const res = await apiService.get<Stop>(`/v1/console/stops/${id}`);
  return res.data;
}

export async function createStop(data: Partial<Stop>): Promise<Stop> {
  const res = await apiService.post<Stop>("/v1/console/stops", data);
  return res.data;
}

export async function updateStop(id: string, data: Partial<Stop>): Promise<Stop> {
  const res = await apiService.patch<Stop>(`/v1/console/stops/${id}`, data);
  return res.data;
}

export async function deleteStop(id: string): Promise<void> {
  await apiService.delete(`/v1/console/stops/${id}`);
}

export interface CreateStopTimeParams {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_sequence: number;
}

export async function createStopTime(stopId: string, data: CreateStopTimeParams): Promise<StopTime> {
  const res = await apiService.post<StopTime>(`/v1/console/stops/${stopId}/stop-times`, data);
  return res.data;
}
