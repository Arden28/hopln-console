import { apiService } from "./client";
import type { GtfsValidationResult } from "@/types";

export interface GtfsStatus {
  sync_status: "ok" | "running" | "failed" | "validation_failed" | "unknown";
  last_synced_at: string | null;
  validation_errors: GtfsValidationResult | null;
}

export async function fetchGtfsStatus(): Promise<GtfsStatus> {
  const res = await apiService.get<GtfsStatus>("/v1/console/gtfs/status");
  return res.data;
}

export async function validateGtfs(): Promise<GtfsValidationResult> {
  const res = await apiService.post<GtfsValidationResult>("/v1/console/gtfs/validate");
  return res.data;
}

export async function exportGtfs(): Promise<{ message: string }> {
  const res = await apiService.post<{ message: string }>("/v1/console/gtfs/export");
  return res.data;
}
