import { apiService, buildQuery, API_BASE_URL } from './client';
import type { FareZone, FareAttribute, FareRule, FarePreview, FareModifier, RouteFare } from '@/types';

// Zones
export async function fetchFareZones(): Promise<FareZone[]> {
  const res = await apiService.get<FareZone[]>('/v1/console/fares/zones');
  return res.data;
}

export async function createFareZone(payload: {
  name: string; agency_id: string; color: string; geojson: object;
}): Promise<FareZone> {
  const res = await apiService.post<FareZone>('/v1/console/fares/zones', payload);
  return res.data;
}

export async function updateFareZone(
  id: number,
  payload: Partial<{ name: string; color: string; geojson: object }>,
): Promise<FareZone> {
  const res = await apiService.patch<FareZone>(`/v1/console/fares/zones/${id}`, payload);
  return res.data;
}

export async function deleteFareZone(id: number): Promise<void> {
  await apiService.delete(`/v1/console/fares/zones/${id}`);
}

// Attributes
export async function fetchFareAttributes(): Promise<FareAttribute[]> {
  const res = await apiService.get<FareAttribute[]>('/v1/console/fares/attributes');
  return res.data;
}

export async function saveFareAttribute(payload: {
  fare_id?: string;
  price: number;
  currency_type?: string;
  payment_method?: 0 | 1;
  transfers?: 0 | 1 | 2 | null;
  agency_id: string;
  transfer_duration?: number | null;
}): Promise<FareAttribute> {
  const res = await apiService.post<FareAttribute>('/v1/console/fares/attributes', payload);
  return res.data;
}

export async function deleteFareAttribute(id: number): Promise<void> {
  await apiService.delete(`/v1/console/fares/attributes/${id}`);
}

// Rules
export async function fetchFareRules(): Promise<FareRule[]> {
  const res = await apiService.get<FareRule[]>('/v1/console/fares/rules');
  return res.data;
}

export async function saveFareRule(payload: {
  fare_id: string;
  route_id?: string;
  origin_id?: string;
  destination_id?: string;
  contains_id?: string;
}): Promise<FareRule> {
  const res = await apiService.post<FareRule>('/v1/console/fares/rules', payload);
  return res.data;
}

export async function deleteFareRule(id: number): Promise<void> {
  await apiService.delete(`/v1/console/fares/rules/${id}`);
}

// Preview
export async function previewFare(params: {
  origin_zone_id?: string;
  destination_zone_id?: string;
  route_id?: string;
}): Promise<FarePreview> {
  const q = buildQuery(params as Record<string, string>);
  const res = await apiService.get<FarePreview>(`/v1/console/fares/preview${q}`);
  return res.data;
}

// Route-based fares
export async function fetchRouteFares(): Promise<RouteFare[]> {
  const res = await apiService.get<RouteFare[]>('/v1/console/fares/route-fares');
  return res.data;
}

export async function saveRouteFare(payload: {
  route_id: string;
  price: number;
  currency_type?: string;
  payment_method?: 0 | 1;
  agency_id?: string;
}): Promise<RouteFare> {
  const res = await apiService.post<RouteFare>('/v1/console/fares/route-fares', payload);
  return res.data;
}

export async function deleteRouteFare(id: number): Promise<void> {
  await apiService.delete(`/v1/console/fares/route-fares/${id}`);
}

// Fare modifiers
export async function fetchFareModifiers(): Promise<FareModifier[]> {
  const res = await apiService.get<FareModifier[]>('/v1/console/fares/modifiers');
  return res.data;
}

export async function saveFareModifier(payload: {
  name: string;
  type: string;
  applies_to?: string;
  applies_to_id?: string | null;
  multiplier?: number | null;
  fixed_surcharge?: number | null;
  condition_data?: Record<string, unknown> | null;
  start_at?: string | null;
  end_at?: string | null;
}): Promise<FareModifier> {
  const res = await apiService.post<FareModifier>('/v1/console/fares/modifiers', payload);
  return res.data;
}

export async function updateFareModifier(
  id: number,
  payload: Partial<Parameters<typeof saveFareModifier>[0]>,
): Promise<FareModifier> {
  const res = await apiService.patch<FareModifier>(`/v1/console/fares/modifiers/${id}`, payload);
  return res.data;
}

export async function deleteFareModifier(id: number): Promise<void> {
  await apiService.delete(`/v1/console/fares/modifiers/${id}`);
}

export async function toggleModifier(id: number): Promise<{ is_active: boolean }> {
  const res = await apiService.post<{ is_active: boolean }>(`/v1/console/fares/modifiers/${id}/toggle`, {});
  return res.data;
}

// Export (blob download — use raw fetch)
export async function exportFareFiles(): Promise<Blob> {
  const token = apiService.getToken();
  const res = await fetch(`${API_BASE_URL}/v1/console/fares/export`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'application/zip',
    },
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.blob();
}
