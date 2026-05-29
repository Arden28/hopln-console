import { apiService, buildQuery } from './client';
import type {
  SplitConfig, Wallet, WalletTransaction,
  FleetRevenueSummary, RouteRevenueSummary, PaginatedResponse,
} from '@/types';

const BASE = '/v1/console/ledger';

export async function fetchSplitConfigs(): Promise<SplitConfig[]> {
  const res = await apiService.get<SplitConfig[]>(`${BASE}/split-configs`);
  return res.data;
}

export async function saveSplitConfig(payload: {
  agency_id?: string | null;
  vehicle_pct: number;
  sacco_pct: number;
  platform_pct: number;
  notes?: string | null;
}): Promise<SplitConfig> {
  const res = await apiService.post<SplitConfig>(`${BASE}/split-configs`, payload);
  return res.data;
}

export async function fetchWallets(params?: {
  entity_type?: "vehicle" | "agency" | "platform";
  search?: string;
}): Promise<Wallet[]> {
  const res = await apiService.get<Wallet[]>(`${BASE}/wallets${buildQuery(params)}`);
  return res.data;
}

export async function fetchWalletTransactions(
  walletId: number,
  params?: { type?: string; date_from?: string; date_to?: string; page?: number },
): Promise<{ wallet: Wallet; transactions: PaginatedResponse<WalletTransaction> }> {
  const res = await apiService.get<{ wallet: Wallet; transactions: PaginatedResponse<WalletTransaction> }>(
    `${BASE}/wallets/${walletId}/transactions${buildQuery(params)}`,
  );
  return res.data;
}

export async function fetchFleetRevenue(params?: {
  agency_id?: string;
  period?: "7d" | "30d" | "90d";
}): Promise<FleetRevenueSummary[]> {
  const res = await apiService.get<FleetRevenueSummary[]>(`${BASE}/fleet-revenue${buildQuery(params)}`);
  return res.data;
}

export async function fetchVehicleRevenue(
  vehicleId: number,
  params?: { period?: "7d" | "30d" | "90d" },
): Promise<{ wallet: Wallet; revenue: number; split_count: number }> {
  const res = await apiService.get<{ wallet: Wallet; revenue: number; split_count: number }>(
    `/v1/console/ledger/vehicles/${vehicleId}/revenue${buildQuery(params)}`,
  );
  return res.data;
}

export async function fetchRouteRevenue(params?: {
  period?: "7d" | "30d" | "90d";
}): Promise<RouteRevenueSummary[]> {
  const res = await apiService.get<RouteRevenueSummary[]>(`${BASE}/route-revenue${buildQuery(params)}`);
  return res.data;
}

export async function postTestSplit(payload: {
  amount: number;
  vehicle_id: number;
  route_id?: string | null;
}): Promise<{
  vehicle_amount: number;
  sacco_amount: number;
  platform_amount: number;
  split_config_id: number;
}> {
  const res = await apiService.post(`${BASE}/test-split`, payload);
  return res.data as ReturnType<typeof postTestSplit> extends Promise<infer T> ? T : never;
}
