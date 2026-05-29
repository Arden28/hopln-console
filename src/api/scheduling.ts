import { apiService, buildQuery } from "./client";
import type {
  HeadwayOptimizerInput,
  OptimizeHeadwayResult,
  LayoverAnalysis,
  BlocksData,
} from "@/types";

export async function optimizeHeadway(
  input: HeadwayOptimizerInput
): Promise<OptimizeHeadwayResult> {
  const res = await apiService.post<OptimizeHeadwayResult>(
    "/v1/console/scheduling/optimize-headway",
    input
  );
  return res.data;
}

export async function fetchLayoverAnalysis(
  routeId: string,
  directionId: 0 | 1 = 0
): Promise<LayoverAnalysis> {
  const res = await apiService.get<LayoverAnalysis>(
    `/v1/console/scheduling/layover-analysis${buildQuery({ route_id: routeId, direction_id: directionId })}`
  );
  return res.data;
}

export async function fetchBlocks(routeId: string): Promise<BlocksData> {
  const res = await apiService.get<BlocksData>(
    `/v1/console/scheduling/blocks${buildQuery({ route_id: routeId })}`
  );
  return res.data;
}
