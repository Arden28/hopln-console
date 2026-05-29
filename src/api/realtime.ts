import { apiService, buildQuery } from './client';
import type {
  LivePositionResponse, LiveStats,
  DelayDashboard, DelayHeatmapCell, VehiclePosition,
} from '@/types';

const BASE = '/v1/console/ops';

export async function fetchLivePositions(params?: {
  route_id?: string;
}): Promise<LivePositionResponse> {
  const res = await apiService.get<LivePositionResponse>(`${BASE}/live/positions${buildQuery(params)}`);
  return res.data;
}

export async function fetchLiveStats(): Promise<LiveStats> {
  const res = await apiService.get<LiveStats>(`${BASE}/live/stats`);
  return res.data;
}

export async function fetchDelayDashboard(params?: {
  period?: "7d" | "30d" | "90d";
}): Promise<DelayDashboard> {
  const res = await apiService.get<DelayDashboard>(`${BASE}/performance${buildQuery(params)}`);
  return res.data;
}

export async function fetchDelayHeatmap(): Promise<DelayHeatmapCell[]> {
  const res = await apiService.get<DelayHeatmapCell[]>(`${BASE}/performance/heatmap`);
  return res.data;
}

export async function fetchPositionHistory(params: {
  vehicle_id: number;
  date: string;
}): Promise<VehiclePosition[]> {
  const res = await apiService.get<VehiclePosition[]>(`${BASE}/positions/history${buildQuery(params)}`);
  return res.data;
}

export async function fetchAvailableDates(vehicleId: number): Promise<string[]> {
  const res = await apiService.get<string[]>(`${BASE}/positions/dates/${vehicleId}`);
  return res.data;
}
