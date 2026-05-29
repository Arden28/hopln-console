import { apiService } from "./client";
import type { ServiceCalendar, ServiceException } from "@/types";

export async function fetchServiceCalendars(): Promise<ServiceCalendar[]> {
  const res = await apiService.get<ServiceCalendar[]>("/v1/console/service-calendars");
  return res.data;
}

export async function fetchServiceCalendar(id: string): Promise<ServiceCalendar> {
  const res = await apiService.get<ServiceCalendar>(`/v1/console/service-calendars/${id}`);
  return res.data;
}

export async function createServiceCalendar(
  data: Omit<ServiceCalendar, "exceptions" | "trips_count">
): Promise<ServiceCalendar> {
  const res = await apiService.post<ServiceCalendar>("/v1/console/service-calendars", data);
  return res.data;
}

export async function updateServiceCalendar(
  id: string,
  data: Partial<ServiceCalendar>
): Promise<ServiceCalendar> {
  const res = await apiService.patch<ServiceCalendar>(
    `/v1/console/service-calendars/${id}`,
    data
  );
  return res.data;
}

export async function deleteServiceCalendar(id: string): Promise<void> {
  await apiService.delete(`/v1/console/service-calendars/${id}`);
}

export async function addCalendarException(
  serviceId: string,
  data: { date: string; exception_type: 1 | 2; note?: string }
): Promise<ServiceException> {
  const res = await apiService.post<ServiceException>(
    `/v1/console/service-calendars/${serviceId}/exceptions`,
    data
  );
  return res.data;
}

export async function removeCalendarException(
  serviceId: string,
  exceptionId: number
): Promise<void> {
  await apiService.delete(
    `/v1/console/service-calendars/${serviceId}/exceptions/${exceptionId}`
  );
}
