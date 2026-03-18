import { getSessionHeaders } from '../session';

export function getSessionAgency(): string | undefined {
  const agency = getSessionHeaders()['X-Session-Agency'];
  return agency || undefined;
}

export function withSessionAgencyFilter<T extends Record<string, string | null | undefined>>(filters: T): T {
  const sessionAgency = getSessionAgency();
  if (!sessionAgency || filters.agence) {
    return filters;
  }
  return {
    ...filters,
    agence: sessionAgency,
  } as T;
}

export function toQueryString(filters: Record<string, string | null | undefined>): string {
  const entries = Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) {
    return '';
  }
  const params = new URLSearchParams(entries.map(([key, value]) => [key, String(value)]));
  return `?${params.toString()}`;
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const sessionHeaders = getSessionHeaders();
  for (const [name, value] of Object.entries(sessionHeaders)) {
    if (value && !headers.has(name)) {
      headers.set(name, value);
    }
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(path, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
