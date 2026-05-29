import { apiService } from "./client";
import type { Agency } from "@/types";

export async function fetchAgencies(): Promise<Agency[]> {
  const res = await apiService.get<Agency[]>("/v1/console/agencies");
  return res.data;
}

export async function createAgency(data: Omit<Agency, "routes_count">): Promise<Agency> {
  const res = await apiService.post<Agency>("/v1/console/agencies", data);
  return res.data;
}

export async function updateAgency(id: string, data: Partial<Agency>): Promise<Agency> {
  const res = await apiService.patch<Agency>(`/v1/console/agencies/${id}`, data);
  return res.data;
}

export async function deleteAgency(id: string): Promise<void> {
  await apiService.delete(`/v1/console/agencies/${id}`);
}
