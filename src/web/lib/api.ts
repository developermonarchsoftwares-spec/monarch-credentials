export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly data?: any) {
    super(message);
  }
}

let csrfToken = "";
export const setCsrf = (t: string) => { csrfToken = t; };

export const api = async <T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> => {
  const method = opts.method ?? "GET";
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" && csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new ApiError(data?.error ?? "Request failed", res.status, data);
  return data as T;
};

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};
