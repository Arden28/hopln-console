import { apiService, buildQuery } from "./client";
import type { ConsoleUser, PaginatedResponse } from "@/types";

export interface UserFilters {
  search?: string;
  role?: string;
  banned?: boolean;
  page?: number;
  per_page?: number;
}

export async function fetchUsers(filters: UserFilters = {}): Promise<ConsoleUser[]> {
  const params: Record<string, unknown> = {
    ...filters,
    banned: filters.banned === undefined ? undefined : String(filters.banned),
  };
  const res = await apiService.get<PaginatedResponse<ConsoleUser> | ConsoleUser[]>(
    `/v1/console/users${buildQuery(params)}`
  );
  return Array.isArray(res.data) ? res.data : res.data.data;
}

export async function fetchUser(id: string): Promise<ConsoleUser> {
  const res = await apiService.get<ConsoleUser>(`/v1/console/users/${id}`);
  return res.data;
}

export async function updateUser(id: string, data: Partial<ConsoleUser>): Promise<ConsoleUser> {
  const res = await apiService.patch<ConsoleUser>(`/v1/console/users/${id}`, data);
  return res.data;
}

export async function banUser(id: string, reason: string): Promise<void> {
  await apiService.post(`/v1/console/users/${id}/ban`, { reason });
}

export async function unbanUser(id: string): Promise<void> {
  await apiService.post(`/v1/console/users/${id}/unban`);
}

export async function adjustPoints(id: string, points: number): Promise<{ points: number }> {
  const res = await apiService.patch<{ points: number }>(`/v1/console/users/${id}/points`, { points });
  return res.data;
}

export async function awardBadge(userId: string, badgeId: string): Promise<void> {
  await apiService.post(`/v1/console/users/${userId}/badges`, { badge_id: badgeId });
}

export async function revokeBadge(userId: string, badgeId: string): Promise<void> {
  await apiService.delete(`/v1/console/users/${userId}/badges/${badgeId}`);
}
