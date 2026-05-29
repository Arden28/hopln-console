import { apiService, buildQuery } from "./client";
import type {
  NetworkGraphData,
  NetworkSnapshot,
  PaginatedResponse,
  TransferGraph,
  DesireLine,
  WalkShedResult,
} from "@/types";

export async function fetchNetworkGraph(agencyId?: string): Promise<NetworkGraphData> {
  const q = agencyId ? buildQuery({ agency_id: agencyId }) : '';
  const res = await apiService.get<NetworkGraphData>(`/v1/console/network/graph${q}`);
  return res.data;
}

export async function fetchNetworkAgencies(): Promise<
  Array<{ agency_id: string; agency_name: string; route_count: number; stop_count: number; trip_count: number }>
> {
  const res = await apiService.get('/v1/console/network/agencies');
  return res.data as Array<{ agency_id: string; agency_name: string; route_count: number; stop_count: number; trip_count: number }>;
}

export async function fetchCrossAgencyTransfers(): Promise<
  Array<{ stop_id: string; stop_name: string; lat: number; lng: number; agencies: string[]; transfer_quality_score: number; min_transfer_gap_min: number }>
> {
  const res = await apiService.get('/v1/console/network/cross-agency-transfers');
  return res.data as Array<{ stop_id: string; stop_name: string; lat: number; lng: number; agencies: string[]; transfer_quality_score: number; min_transfer_gap_min: number }>;
}

export async function fetchModalLayers(): Promise<{ layers: Record<string, unknown>; osm_refreshed_at?: string }> {
  const res = await apiService.get('/v1/console/network/modal-layers');
  return res.data as { layers: Record<string, unknown>; osm_refreshed_at?: string };
}

export async function refreshOsmLayer(layer: 'cycling' | 'pedestrian'): Promise<{ message: string; count: number }> {
  const res = await apiService.post<{ message: string; count: number }>('/v1/console/network/modal-layers/refresh-osm', { layer });
  return res.data;
}

export async function fetchNetworkCoverage(): Promise<
  Array<{ lat: number; lng: number; name: string; trip_count: number }>
> {
  const res = await apiService.get("/v1/console/network/coverage");
  return res.data;
}

export async function fetchIsochrone(params: {
  lat: number;
  lng: number;
  mode: "walk" | "transit";
  date?: string;
  time?: string;
  cutoffs?: number[];
}): Promise<WalkShedResult> {
  const res = await apiService.post<WalkShedResult>("/v1/console/network/isochrone", params);
  return res.data;
}

export async function fetchDesireLines(): Promise<DesireLine[]> {
  const res = await apiService.get<DesireLine[]>("/v1/console/network/desire-lines");
  return res.data;
}

export async function fetchTransferGraph(radiusMeters = 400): Promise<TransferGraph> {
  const res = await apiService.get<TransferGraph>(
    `/v1/console/network/transfer-graph?radius=${radiusMeters}`
  );
  return res.data;
}

export async function fetchSnapshots(params?: {
  entity_type?: string;
  entity_id?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedResponse<NetworkSnapshot>> {
  const res = await apiService.get<PaginatedResponse<NetworkSnapshot>>(
    `/v1/console/network/snapshots${buildQuery(params as Record<string, unknown>)}`
  );
  return res.data;
}

export async function fetchSnapshot(id: number): Promise<NetworkSnapshot> {
  const res = await apiService.get<NetworkSnapshot>(`/v1/console/network/snapshots/${id}`);
  return res.data;
}

export async function createSnapshot(data: {
  entity_type: string;
  entity_id: string;
  action: string;
  label?: string;
}): Promise<{ message: string }> {
  const res = await apiService.post<{ message: string }>("/v1/console/network/snapshots", data);
  return res.data;
}
