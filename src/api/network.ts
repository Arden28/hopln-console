import { apiService, buildQuery } from "./client";
import type {
  NetworkGraphData,
  NetworkSnapshot,
  PaginatedResponse,
  TransferGraph,
  DesireLine,
  WalkShedResult,
} from "@/types";

export async function fetchNetworkGraph(): Promise<NetworkGraphData> {
  const res = await apiService.get<NetworkGraphData>("/v1/console/network/graph");
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
