import { apiService, buildQuery } from './client';
import type { Incident, IncidentStats, PaginatedResponse } from '@/types';

const BASE = '/v1/console/ops/incidents';

export async function fetchIncidents(params?: {
  type?: string;
  severity?: string;
  status?: string;
  route_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
}): Promise<PaginatedResponse<Incident>> {
  const res = await apiService.get<PaginatedResponse<Incident>>(`${BASE}${buildQuery(params)}`);
  return res.data;
}

export async function fetchIncidentStats(): Promise<IncidentStats> {
  const res = await apiService.get<IncidentStats>(`${BASE}/stats`);
  return res.data;
}

export async function saveIncident(payload: {
  type: Incident["type"];
  severity: Incident["severity"];
  description: string;
  route_id?: string | null;
  stop_id?: string | null;
  vehicle_id?: number | null;
  response_taken?: string | null;
  reported_by?: string | null;
}): Promise<Incident> {
  const res = await apiService.post<Incident>(BASE, payload);
  return res.data;
}

export async function updateIncident(id: number, payload: Partial<{
  type: Incident["type"];
  severity: Incident["severity"];
  status: Incident["status"];
  description: string;
  route_id: string | null;
  stop_id: string | null;
  vehicle_id: number | null;
  response_taken: string | null;
}>): Promise<Incident> {
  const res = await apiService.patch<Incident>(`${BASE}/${id}`, payload);
  return res.data;
}

export async function resolveIncident(id: number, payload?: {
  response_taken?: string;
}): Promise<Incident> {
  const res = await apiService.post<Incident>(`${BASE}/${id}/resolve`, payload ?? {});
  return res.data;
}
