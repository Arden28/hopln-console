import { apiService, buildQuery } from './client';
import type { Vehicle, Driver, PaginatedResponse } from '@/types';

const BASE = '/v1/console';

export async function fetchVehicles(params?: {
  agency_id?: string;
  status?: string;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<Vehicle>> {
  const res = await apiService.get<PaginatedResponse<Vehicle>>(`${BASE}/vehicles${buildQuery(params)}`);
  return res.data;
}

export async function saveVehicle(payload: {
  plate: string;
  agency_id?: string | null;
  route_id?: string | null;
  model?: string | null;
  capacity?: number | null;
  status?: "active" | "inactive" | "suspended";
  notes?: string | null;
}): Promise<Vehicle> {
  const res = await apiService.post<Vehicle>(`${BASE}/vehicles`, payload);
  return res.data;
}

export async function updateVehicle(id: number, payload: Partial<{
  plate: string;
  agency_id: string | null;
  route_id: string | null;
  model: string | null;
  capacity: number | null;
  status: "active" | "inactive" | "suspended";
  notes: string | null;
}>): Promise<Vehicle> {
  const res = await apiService.patch<Vehicle>(`${BASE}/vehicles/${id}`, payload);
  return res.data;
}

export async function deleteVehicle(id: number): Promise<void> {
  await apiService.delete(`${BASE}/vehicles/${id}`);
}

export async function fetchDrivers(params?: {
  vehicle_id?: number;
  status?: string;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<Driver>> {
  const res = await apiService.get<PaginatedResponse<Driver>>(`${BASE}/drivers${buildQuery(params)}`);
  return res.data;
}

export async function saveDriver(payload: {
  name: string;
  phone?: string | null;
  license_no?: string | null;
  vehicle_id?: number | null;
  status?: "active" | "inactive";
  notes?: string | null;
}): Promise<Driver> {
  const res = await apiService.post<Driver>(`${BASE}/drivers`, payload);
  return res.data;
}

export async function updateDriver(id: number, payload: Partial<{
  name: string;
  phone: string | null;
  license_no: string | null;
  vehicle_id: number | null;
  status: "active" | "inactive";
  notes: string | null;
}>): Promise<Driver> {
  const res = await apiService.patch<Driver>(`${BASE}/drivers/${id}`, payload);
  return res.data;
}

export async function deleteDriver(id: number): Promise<void> {
  await apiService.delete(`${BASE}/drivers/${id}`);
}
