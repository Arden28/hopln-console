import { apiService } from "./client";
import type { TripFrequency } from "@/types";

export async function fetchTripFrequencies(tripId: string): Promise<TripFrequency[]> {
  const res = await apiService.get<TripFrequency[]>(
    `/v1/console/trips/${tripId}/frequencies`
  );
  return res.data;
}

export async function createTripFrequency(
  tripId: string,
  data: Omit<TripFrequency, "id" | "trip_id">
): Promise<TripFrequency> {
  const res = await apiService.post<TripFrequency>(
    `/v1/console/trips/${tripId}/frequencies`,
    data
  );
  return res.data;
}

export async function updateTripFrequency(
  tripId: string,
  id: number,
  data: Partial<TripFrequency>
): Promise<TripFrequency> {
  const res = await apiService.patch<TripFrequency>(
    `/v1/console/trips/${tripId}/frequencies/${id}`,
    data
  );
  return res.data;
}

export async function deleteTripFrequency(tripId: string, id: number): Promise<void> {
  await apiService.delete(`/v1/console/trips/${tripId}/frequencies/${id}`);
}
