// Thin fetch wrapper that unwraps the { data, error, status } API envelope
export interface ApiResponse<T> {
  data: T;
  error: { message?: string } | string | null;
  status: number;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  let json: ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    // Non-JSON response (dead proxy, unknown route) — surface the HTTP status instead
    throw new Error(`Request failed with status ${res.status}`);
  }

  if (json.error !== null && json.error !== undefined) {
    const message = typeof json.error === 'string'
      ? json.error
      : json.error.message ?? 'Request failed';
    throw new Error(message);
  }

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  return json.data;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE' });
}
