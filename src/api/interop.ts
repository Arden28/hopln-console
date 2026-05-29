import { apiService, buildQuery, API_BASE_URL } from './client';
import type { InteropEntry, InteropEntryType, Level, Pathway, PathwayMode } from '@/types';

// Interop Entries
export async function fetchInteropEntries(params?: {
  bounds?: string; type?: InteropEntryType;
}): Promise<InteropEntry[]> {
  const res = await apiService.get<InteropEntry[]>(
    `/v1/console/network/interop${buildQuery(params as Record<string, unknown>)}`,
  );
  return res.data;
}

export async function createEntry(payload: {
  name: string; type: InteropEntryType; lat: number; lng: number;
  description?: string; gtfs_stop_id?: string; connections?: Record<string, unknown>;
}): Promise<InteropEntry> {
  const res = await apiService.post<InteropEntry>('/v1/console/network/interop', payload);
  return res.data;
}

export async function updateEntry(
  id: number,
  payload: Partial<{
    name: string; type: InteropEntryType; lat: number; lng: number;
    description: string | null; gtfs_stop_id: string | null;
    connections: Record<string, unknown> | null;
  }>,
): Promise<InteropEntry> {
  const res = await apiService.patch<InteropEntry>(`/v1/console/network/interop/${id}`, payload);
  return res.data;
}

export async function deleteEntry(id: number): Promise<void> {
  await apiService.delete(`/v1/console/network/interop/${id}`);
}

// Levels
export async function fetchLevels(stopId?: string): Promise<Level[]> {
  const q = stopId ? buildQuery({ stop_id: stopId }) : '';
  const res = await apiService.get<Level[]>(`/v1/console/network/levels${q}`);
  return res.data;
}

export async function saveLevel(payload: {
  level_id?: string; level_index: number; level_name: string; stop_id: string;
}): Promise<Level> {
  const res = await apiService.post<Level>('/v1/console/network/levels', payload);
  return res.data;
}

export async function updateLevel(
  id: number,
  payload: Partial<{ level_index: number; level_name: string }>,
): Promise<Level> {
  const res = await apiService.patch<Level>(`/v1/console/network/levels/${id}`, payload);
  return res.data;
}

export async function deleteLevel(id: number): Promise<void> {
  await apiService.delete(`/v1/console/network/levels/${id}`);
}

// Pathways
export async function fetchPathways(stopId?: string): Promise<Pathway[]> {
  const q = stopId ? buildQuery({ stop_id: stopId }) : '';
  const res = await apiService.get<Pathway[]>(`/v1/console/network/pathways${q}`);
  return res.data;
}

export async function savePathway(payload: {
  pathway_id?: string;
  from_stop_id: string; to_stop_id: string;
  pathway_mode: PathwayMode; is_bidirectional?: boolean;
  length?: number; traversal_time?: number; stair_count?: number;
  max_slope?: number; min_width?: number;
  signposted_as?: string; reversed_signposted_as?: string;
}): Promise<Pathway> {
  const res = await apiService.post<Pathway>('/v1/console/network/pathways', payload);
  return res.data;
}

export async function updatePathway(
  id: number,
  payload: Partial<{
    pathway_mode: PathwayMode; is_bidirectional: boolean;
    length: number | null; traversal_time: number | null; stair_count: number | null;
    max_slope: number | null; min_width: number | null;
    signposted_as: string | null; reversed_signposted_as: string | null;
  }>,
): Promise<Pathway> {
  const res = await apiService.patch<Pathway>(`/v1/console/network/pathways/${id}`, payload);
  return res.data;
}

export async function deletePathway(id: number): Promise<void> {
  await apiService.delete(`/v1/console/network/pathways/${id}`);
}

// Export (blob download — use raw fetch)
export async function exportPathwayFiles(): Promise<Blob> {
  const token = apiService.getToken();
  const res = await fetch(`${API_BASE_URL}/v1/console/network/pathways/export`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'application/zip',
    },
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.blob();
}
