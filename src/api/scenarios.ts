import { apiService } from "./client";
import type { NetworkScenario, ScenarioOverride } from "@/types";

export async function fetchScenarios(): Promise<NetworkScenario[]> {
  const res = await apiService.get<NetworkScenario[]>("/v1/console/scenarios");
  return res.data;
}

export async function fetchScenario(id: number): Promise<NetworkScenario> {
  const res = await apiService.get<NetworkScenario>(`/v1/console/scenarios/${id}`);
  return res.data;
}

export async function createScenario(data: {
  name: string;
  description?: string | null;
}): Promise<NetworkScenario> {
  const res = await apiService.post<NetworkScenario>("/v1/console/scenarios", data);
  return res.data;
}

export async function updateScenario(
  id: number,
  data: { name?: string; description?: string | null; status?: "draft" | "archived" }
): Promise<NetworkScenario> {
  const res = await apiService.patch<NetworkScenario>(`/v1/console/scenarios/${id}`, data);
  return res.data;
}

export async function deleteScenario(id: number): Promise<void> {
  await apiService.delete(`/v1/console/scenarios/${id}`);
}

export async function addScenarioOverride(
  scenarioId: number,
  override: {
    entity_type: string;
    entity_id: string | null;
    action: "add" | "modify" | "delete";
    data: Record<string, unknown>;
  }
): Promise<ScenarioOverride> {
  const res = await apiService.post<ScenarioOverride>(
    `/v1/console/scenarios/${scenarioId}/overrides`,
    override
  );
  return res.data;
}

export async function removeScenarioOverride(
  scenarioId: number,
  overrideId: number
): Promise<void> {
  await apiService.delete(`/v1/console/scenarios/${scenarioId}/overrides/${overrideId}`);
}

export async function compareScenario(id: number): Promise<{
  production: { routes: unknown[]; stops: unknown[] };
  scenario: { routes: unknown[]; stops: unknown[] };
}> {
  const res = await apiService.get(`/v1/console/scenarios/${id}/compare`);
  return res.data;
}

export async function publishScenario(id: number): Promise<{ message: string }> {
  const res = await apiService.post<{ message: string }>(`/v1/console/scenarios/${id}/publish`);
  return res.data;
}
