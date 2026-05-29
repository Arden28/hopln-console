import { apiService, buildQuery } from "./client";
import type { Contribution, ContributionStatus, PaginatedResponse } from "@/types";

export interface ContributionFilters {
  status?: ContributionStatus;
  type?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export async function fetchContributions(filters: ContributionFilters = {}): Promise<Contribution[]> {
  const res = await apiService.get<PaginatedResponse<Contribution> | Contribution[]>(
    `/v1/console/contributions${buildQuery(filters as Record<string, unknown>)}`
  );
  return Array.isArray(res.data) ? res.data : (res.data.data ?? []);
}

export async function fetchContribution(id: string): Promise<Contribution> {
  const res = await apiService.get<Contribution>(`/v1/console/contributions/${id}`);
  return res.data;
}

export async function approveContribution(id: string): Promise<void> {
  await apiService.post(`/v1/console/contributions/${id}/approve`);
}

export async function declineContribution(id: string, reason: string): Promise<void> {
  await apiService.post(`/v1/console/contributions/${id}/decline`, { reason });
}

export async function updateContribution(id: string, data: Partial<Contribution>): Promise<Contribution> {
  const res = await apiService.patch<Contribution>(`/v1/console/contributions/${id}`, data);
  return res.data;
}

export async function bulkApprove(ids: string[]): Promise<{ approved: number }> {
  const res = await apiService.post<{ approved: number }>("/v1/console/contributions/bulk-approve", { ids });
  return res.data;
}

export async function bulkDecline(ids: string[], reason: string): Promise<{ declined: number }> {
  const res = await apiService.post<{ declined: number }>("/v1/console/contributions/bulk-decline", { ids, reason });
  return res.data;
}
