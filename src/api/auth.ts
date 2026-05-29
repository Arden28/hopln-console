import { apiService } from "./client";
import type { ConsoleUser } from "@/types";

export interface LoginResponse {
  token: string;
  user: ConsoleUser;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await apiService.post<LoginResponse>("/v1/auth/login", { email, password });
  return res.data;
}

export async function logout(): Promise<void> {
  await apiService.post("/v1/auth/logout");
}
