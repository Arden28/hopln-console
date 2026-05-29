import { apiService, buildQuery } from "./client";
import type { OtpStatus } from "@/types";

export async function fetchOtpStatus(): Promise<OtpStatus> {
  const res = await apiService.get<OtpStatus>("/v1/console/otp/status");
  return res.data;
}

export interface OtpLogEntry {
  id: string;
  event: string;
  status: string;
  message?: string;
  created_at: string;
}

export interface OtpLogMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface OtpLogPage {
  data: OtpLogEntry[];
  meta: OtpLogMeta;
}

export interface OtpLogParams {
  page?: number;
  per_page?: number;
  event?: string;
  status?: string;
}

export async function fetchOtpLog(params?: OtpLogParams): Promise<OtpLogPage> {
  const res = await apiService.get<{
    data: OtpLogEntry[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  }>(`/v1/console/otp/log${buildQuery(params as Record<string, unknown>)}`);
  const raw = res.data;
  return {
    data: raw.data,
    meta: {
      current_page: raw.current_page,
      last_page:    raw.last_page,
      per_page:     raw.per_page,
      total:        raw.total,
    },
  };
}

export async function triggerOtpSync(): Promise<{ message: string }> {
  const res = await apiService.post<{ message: string }>("/v1/console/otp/sync");
  return res.data;
}

export async function cancelOtpJob(): Promise<{ message: string }> {
  const res = await apiService.post<{ message: string }>("/v1/console/otp/cancel");
  return res.data;
}
