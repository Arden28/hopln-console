import { apiService, API_BASE_URL } from "./client";
import type {
  DataQualityScore,
  DuplicateStopPair,
  OfficialValidationResult,
  ShapeInspectorResult,
} from "@/types";

export async function fetchQualityScore(refresh = false): Promise<DataQualityScore> {
  const params = refresh ? "?refresh=true" : "";
  const res = await apiService.get<DataQualityScore>(`/v1/console/quality/score${params}`);
  return res.data;
}

export async function fetchDrillDown(metric: string): Promise<{ metric: string; data: unknown[] }> {
  const res = await apiService.get<{ metric: string; data: unknown[] }>(
    `/v1/console/quality/drill-down?metric=${encodeURIComponent(metric)}`
  );
  return res.data;
}

export async function fetchShapeInspector(tripId: string): Promise<ShapeInspectorResult> {
  const res = await apiService.get<ShapeInspectorResult>(
    `/v1/console/quality/shape-inspector?trip_id=${encodeURIComponent(tripId)}`
  );
  return res.data;
}

export async function fetchDuplicateStops(radiusM = 50): Promise<{ pairs: DuplicateStopPair[]; radius_m: number }> {
  const res = await apiService.get<{ pairs: DuplicateStopPair[]; radius_m: number }>(
    `/v1/console/quality/duplicate-stops?radius=${radiusM}`
  );
  return res.data;
}

export async function mergeStops(
  canonicalId: string,
  duplicateId: string
): Promise<{ message: string; stop_times_redirected: number; pattern_stops_redirected: number }> {
  const res = await apiService.post<{ message: string; stop_times_redirected: number; pattern_stops_redirected: number }>(
    "/v1/console/quality/merge-stops",
    { canonical_id: canonicalId, duplicate_id: duplicateId }
  );
  return res.data;
}

export async function snapStop(stopId: string): Promise<{
  snapped: boolean;
  original_lat: number;
  original_lng: number;
  snapped_lat: number;
  snapped_lng: number;
  road_name: string | null;
  distance_m: number;
}> {
  const res = await apiService.post(`/v1/console/stops/${stopId}/snap`, {});
  return res.data;
}

export async function fetchOfficialValidation(): Promise<OfficialValidationResult> {
  const res = await apiService.get<OfficialValidationResult>("/v1/console/gtfs/official-validate");
  return res.data;
}

export async function exportAs(format: "gtfs" | "gtfs-flex" | "excel" | "netex"): Promise<void> {
  const token = apiService.getToken();

  const res = await fetch(`${API_BASE_URL}/v1/console/gtfs/export-as`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/octet-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ format }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Export failed (${res.status}): ${text.slice(0, 120)}`);
  }

  const extMap: Record<string, string> = {
    "gtfs":      "gtfs.zip",
    "gtfs-flex": "gtfs-flex.zip",
    "excel":     "hopln_export.xlsx",
    "netex":     "hopln_netex.xml",
  };

  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = extMap[format] ?? "export";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
