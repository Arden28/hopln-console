import { apiService } from "./client";
import type { Corridor, Route } from "@/types";

export async function fetchCorridors(): Promise<Corridor[]> {
  const res = await apiService.get<Corridor[]>("/v1/console/corridors");
  return res.data;
}

export async function fetchCorridor(id: string): Promise<Corridor> {
  const res = await apiService.get<Corridor>(`/v1/console/corridors/${id}`);
  return res.data;
}

export async function createCorridor(data: {
  name: string;
  agency_id?: string | null;
}): Promise<Corridor> {
  const res = await apiService.post<Corridor>("/v1/console/corridors", data);
  return res.data;
}

export async function updateCorridor(
  id: string,
  data: { name?: string; agency_id?: string | null }
): Promise<Corridor> {
  const res = await apiService.patch<Corridor>(`/v1/console/corridors/${id}`, data);
  return res.data;
}

export async function deleteCorridor(id: string): Promise<void> {
  await apiService.delete(`/v1/console/corridors/${id}`);
}

export async function saveCorridorShape(
  id: string,
  points: [number, number][]
): Promise<Corridor> {
  const res = await apiService.put<Corridor>(`/v1/console/corridors/${id}/shape`, { points });
  return res.data;
}

export async function fetchCorridorRoutes(id: string): Promise<Route[]> {
  const res = await apiService.get<Route[]>(`/v1/console/corridors/${id}/routes`);
  return res.data;
}

export async function attachRouteToCorridor(
  corridorId: string,
  routeId: string,
  directionId?: 0 | 1
): Promise<void> {
  await apiService.post(`/v1/console/corridors/${corridorId}/routes`, {
    route_id: routeId,
    direction_id: directionId,
  });
}

export async function detachRouteFromCorridor(
  corridorId: string,
  routeId: string
): Promise<void> {
  await apiService.delete(`/v1/console/corridors/${corridorId}/routes/${routeId}`);
}
