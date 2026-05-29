import { apiService, buildQuery } from "./client";

export interface AnalyticsOverview {
  total_journeys: number;
  unique_users: number;
  accepted_contributions: number;
  [key: string]: unknown;
}

export async function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  const res = await apiService.get<AnalyticsOverview>("/v1/console/analytics/overview");
  return res.data;
}

export async function fetchJourneyAnalytics(range = "30d") {
  const res = await apiService.get(`/v1/console/analytics/journeys${buildQuery({ range })}`);
  return res.data;
}

export async function fetchTopSearches() {
  const res = await apiService.get("/v1/console/analytics/searches");
  return res.data;
}

export async function fetchContributionAnalytics(range = "30d") {
  const res = await apiService.get(`/v1/console/analytics/contributions${buildQuery({ range })}`);
  return res.data;
}

export async function fetchUserGrowth(range = "30d") {
  const res = await apiService.get(`/v1/console/analytics/user-growth${buildQuery({ range })}`);
  return res.data;
}
