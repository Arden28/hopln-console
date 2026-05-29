import { apiService, buildQuery } from './client';
import type { ServiceAlert, PaginatedResponse } from '@/types';

const BASE = '/v1/console/ops/alerts';

export async function fetchAlerts(params?: {
  status?: "draft" | "active" | "expired";
  severity?: string;
  affected_type?: string;
  page?: number;
}): Promise<PaginatedResponse<ServiceAlert>> {
  const res = await apiService.get<PaginatedResponse<ServiceAlert>>(`${BASE}${buildQuery(params)}`);
  return res.data;
}

export async function saveAlert(payload: {
  title: string;
  description?: string | null;
  severity: "info" | "warning" | "critical";
  effect: "detour" | "reduced_service" | "cancellation" | "other";
  affected_type: "route" | "stop" | "all";
  affected_id?: string | null;
  starts_at: string;
  ends_at?: string | null;
}): Promise<ServiceAlert> {
  const res = await apiService.post<ServiceAlert>(BASE, payload);
  return res.data;
}

export async function updateAlert(id: number, payload: Partial<{
  title: string;
  description: string | null;
  severity: "info" | "warning" | "critical";
  effect: "detour" | "reduced_service" | "cancellation" | "other";
  affected_type: "route" | "stop" | "all";
  affected_id: string | null;
  starts_at: string;
  ends_at: string | null;
}>): Promise<ServiceAlert> {
  const res = await apiService.patch<ServiceAlert>(`${BASE}/${id}`, payload);
  return res.data;
}

export async function activateAlert(id: number): Promise<ServiceAlert> {
  const res = await apiService.post<ServiceAlert>(`${BASE}/${id}/activate`);
  return res.data;
}

export async function expireAlert(id: number): Promise<ServiceAlert> {
  const res = await apiService.post<ServiceAlert>(`${BASE}/${id}/expire`);
  return res.data;
}

export async function deleteAlert(id: number): Promise<void> {
  await apiService.delete(`${BASE}/${id}`);
}
