import { apiService } from "./client";
import type { DashboardOverview, SystemHealth } from "@/types";

export async function fetchOverview(): Promise<DashboardOverview> {
  const res = await apiService.get<DashboardOverview>("/v1/console/dashboard");
  return res.data;
}

export async function fetchActivity(): Promise<unknown[]> {
  const res = await apiService.get<{ data: unknown[] } | unknown[]>("/v1/console/activity");
  return Array.isArray(res.data) ? res.data : (res.data as { data: unknown[] }).data ?? [];
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const res = await apiService.get<SystemHealth>("/v1/console/system-health");
  return res.data;
}
