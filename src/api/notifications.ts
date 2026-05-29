import { apiService } from "./client";
import type { BroadcastNotification, PaginatedResponse } from "@/types";

export interface BroadcastPayload {
  title: string;
  body: string;
  type: "info" | "alert" | "promo" | "system";
  audience: string;
}

export async function fetchNotifications(): Promise<BroadcastNotification[]> {
  const res = await apiService.get<PaginatedResponse<BroadcastNotification> | BroadcastNotification[]>(
    "/v1/console/notifications"
  );
  return Array.isArray(res.data) ? res.data : (res.data.data ?? []);
}

export async function broadcastNotification(data: BroadcastPayload): Promise<{ message: string }> {
  const res = await apiService.post<{ message: string }>("/v1/console/notifications/broadcast", data);
  return res.data;
}
