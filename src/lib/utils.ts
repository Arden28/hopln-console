import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), "MMM d, yyyy")
}

export function formatDateTime(dateStr: string): string {
  return format(new Date(dateStr), "MMM d, yyyy HH:mm")
}

export function timeAgo(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n)
}

// Resolve storage URLs that may be stored with a different host (e.g. http://localhost/storage/...)
// by rebuilding them against the current API base, so images always load correctly.
export function resolveStorageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/")) {
    const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/api$/, "");
    return `${base}${url}`;
  }
  try {
    const stored = new URL(url);
    const apiBase = new URL(
      (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api").replace(/\/api$/, "")
    );
    if (stored.host !== apiBase.host) {
      stored.host = apiBase.host;
      return stored.toString();
    }
  } catch {
    // malformed URL — return as-is
  }
  return url;
}
