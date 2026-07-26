// Use /api proxy (Next.js rewrite) so only port 3000 needs forwarding in remote dev.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  body?: unknown;
  signal?: AbortSignal;
  /** Bypass HTTP cache — useful for large/debug fetches visible in DevTools. */
  cache?: RequestCache;
};

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, signal, cache } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // sends httpOnly cookie
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    cache,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = text;
    try {
      const json = JSON.parse(text) as { message?: string };
      message = json.message ?? text;
    } catch {}
    // 401: token expired → redirect to login
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
      return undefined as T;
    }
    throw new ApiError(res.status, message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function requestText(path: string): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = text;
    try {
      const json = JSON.parse(text) as { message?: string };
      message = json.message ?? text;
    } catch {}
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
      return '';
    }
    throw new ApiError(res.status, message || `HTTP ${res.status}`);
  }

  return res.text();
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>('GET', path, opts),
  getText: (path: string) => requestText(path),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>('PUT', path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>('PATCH', path, { ...opts, body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>('DELETE', path, opts),
};

export { API_BASE };
