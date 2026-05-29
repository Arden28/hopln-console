export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

/** Shape of a Laravel API error response. */
export interface ApiErrorPayload {
  message?: string;
  errors?: Record<string, string[] | string>;
}

/** Thrown by apiService on non-2xx responses. */
export class ApiError extends Error {
  status: number;
  payload?: ApiErrorPayload;
  constructor(status: number, message: string, payload?: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

/** Result returned by all apiService methods. */
export type ApiResult<T> = {
  success: true;
  data: T;
  status: number;
};

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const TOKEN_KEY = "hopln_console_token";

function safeLocalStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

const storage = {
  getToken(): string | null {
    return safeLocalStorage()?.getItem(TOKEN_KEY) ?? null;
  },
  setToken(token: string) {
    safeLocalStorage()?.setItem(TOKEN_KEY, token);
  },
  removeToken() {
    safeLocalStorage()?.removeItem(TOKEN_KEY);
  },
};

/**
 * Builds a URL query string from a params object.
 * Drops null / undefined / empty-string values.
 * e.g. buildQuery({ page: 1, q: "bus", x: null }) → "?page=1&q=bus"
 */
export function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== null && v !== undefined && String(v) !== ""
  );
  if (entries.length === 0) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of entries) sp.append(k, String(v));
  return `?${sp.toString()}`;
}

async function doFetch<TRes>(
  method: HttpMethod,
  path: string,
  body?: unknown
): Promise<ApiResult<TRes>> {
  const token = storage.getToken();

  const headers: HeadersInit = {
    Accept: "application/json",
  };

  const withBody = body !== undefined && body !== null;
  if (withBody) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: withBody ? JSON.stringify(body) : undefined,
  });

  // Handle 401: clear auth and redirect
  if (res.status === 401) {
    storage.removeToken();
    window.location.href = "/login";
    // Return a never-resolving promise so callers don't process stale data
    return new Promise(() => {});
  }

  // 204 No Content
  if (res.status === 204) {
    return { success: true, data: null as unknown as TRes, status: 204 };
  }

  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const json = (await res.json()) as unknown;

    if (!res.ok) {
      const payload = (json ?? {}) as ApiErrorPayload;
      const msg = payload.message ?? `API request failed (${res.status})`;
      throw new ApiError(res.status, msg, payload);
    }

    return { success: true, data: json as TRes, status: res.status };
  }

  // Non-JSON (HTML, plain text, etc.)
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(res.status, `Unexpected response (${res.status}): ${text.slice(0, 120)}`);
  }

  return { success: true, data: text as unknown as TRes, status: res.status };
}

/** Typed HTTP helpers */
export const apiService = {
  getToken: storage.getToken,
  setToken: storage.setToken,
  removeToken: storage.removeToken,

  get<TRes = unknown>(path: string): Promise<ApiResult<TRes>> {
    return doFetch<TRes>("GET", path);
  },
  post<TRes = unknown, TBody = unknown>(path: string, data?: TBody): Promise<ApiResult<TRes>> {
    return doFetch<TRes>("POST", path, data);
  },
  put<TRes = unknown, TBody = unknown>(path: string, data?: TBody): Promise<ApiResult<TRes>> {
    return doFetch<TRes>("PUT", path, data);
  },
  patch<TRes = unknown, TBody = unknown>(path: string, data?: TBody): Promise<ApiResult<TRes>> {
    return doFetch<TRes>("PATCH", path, data);
  },
  delete<TRes = unknown>(path: string): Promise<ApiResult<TRes>> {
    return doFetch<TRes>("DELETE", path);
  },
};

export default apiService;
