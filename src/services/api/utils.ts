import { getSessionHeaders } from '../session';
import { fetchJwtFromNeonSdk } from '../neonAuth';

const NEON_TOKEN_STORAGE_KEYS = [
  'cabinet.neon.jwt',
  'cabinet_neon_jwt',
  'neon.auth.token',
  'neon_auth_token',
  'auth_token',
];

let neonTokenFetchPromise: Promise<string> | null = null;

function getApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!raw) {
    return '';
  }
  return raw.replace(/\/$/, '');
}

function resolveRequestUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

function readBrowserStorageToken(keys: string[]): string {
  if (globalThis.window === undefined) {
    return '';
  }

  for (const key of keys) {
    const value = globalThis.window.localStorage.getItem(key) ?? globalThis.window.sessionStorage.getItem(key) ?? '';
    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

export function isNeonDataApiEnabled(): boolean {
  return String(import.meta.env.VITE_USE_NEON_DATA_API ?? '').toLowerCase() === 'true';
}

export function getNeonDataApiBaseUrl(): string {
  const direct = String(import.meta.env.VITE_NEON_DATA_API_URL ?? '').trim();
  if (direct) {
    return direct.replace(/\/$/, '');
  }

  const fallback = String(import.meta.env.VITE_API_BASE_URL ?? '').trim();
  return fallback.replace(/\/$/, '');
}

export function getNeonAuthToken(): string {
  const storageToken = readBrowserStorageToken(NEON_TOKEN_STORAGE_KEYS);
  if (storageToken) {
    return storageToken;
  }

  return String(import.meta.env.VITE_NEON_AUTH_BEARER ?? '').trim();
}

function isNeonAutoTokenEnabled(): boolean {
  const override = String(import.meta.env.VITE_NEON_AUTO_JWT ?? '').trim().toLowerCase();
  if (override === 'false' || override === '0' || override === 'no') {
    return false;
  }

  if (override === 'true' || override === '1' || override === 'yes') {
    return true;
  }

  return import.meta.env.PROD;
}

export function setNeonAuthToken(token: string): void {
  const normalized = token.trim();
  if (!normalized || globalThis.window === undefined) {
    return;
  }

  globalThis.window.localStorage.setItem(NEON_TOKEN_STORAGE_KEYS[0], normalized);
}

export function clearNeonAuthToken(): void {
  if (globalThis.window === undefined) {
    return;
  }

  for (const key of NEON_TOKEN_STORAGE_KEYS) {
    globalThis.window.localStorage.removeItem(key);
    globalThis.window.sessionStorage.removeItem(key);
  }
}

export async function ensureNeonAuthToken(): Promise<string> {
  const existing = getNeonAuthToken();
  if (existing) {
    return existing;
  }

  if (!isNeonDataApiEnabled() || !isNeonAutoTokenEnabled()) {
    return '';
  }

  if (!neonTokenFetchPromise) {
    neonTokenFetchPromise = fetchJwtFromNeonSdk()
      .then((token) => {
        const normalized = token.trim();
        if (normalized) {
          setNeonAuthToken(normalized);
        }
        return normalized;
      })
      .finally(() => {
        neonTokenFetchPromise = null;
      });
  }

  return neonTokenFetchPromise;
}

export async function bootstrapNeonAuthToken(): Promise<void> {
  if (!isNeonDataApiEnabled() || !isNeonAutoTokenEnabled()) {
    return;
  }

  try {
    await ensureNeonAuthToken();
  } catch {
    // Keep startup resilient; requests will still surface explicit auth errors if token is missing.
  }
}

function resolveNeonResourceUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const baseUrl = getNeonDataApiBaseUrl();
  if (!baseUrl) {
    throw new Error('VITE_NEON_DATA_API_URL est requis quand VITE_USE_NEON_DATA_API=true.');
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export async function requestNeonRest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  const token = (await ensureNeonAuthToken()) || getNeonAuthToken();
  if (!token) {
    throw new Error('JWT Neon Auth introuvable. Connectez-vous via Neon Auth ou configurez VITE_NEON_AUTH_BEARER.');
  }

  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const response = await fetch(resolveNeonResourceUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Neon Data API request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function requestNeonCount(path: string): Promise<number> {
  const headers = new Headers();
  const token = (await ensureNeonAuthToken()) || getNeonAuthToken();
  if (!token) {
    throw new Error('JWT Neon Auth introuvable. Connectez-vous via Neon Auth ou configurez VITE_NEON_AUTH_BEARER.');
  }

  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Prefer', 'count=exact');

  const response = await fetch(resolveNeonResourceUrl(path), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Neon Data API count request failed (${response.status})`);
  }

  const contentRange = response.headers.get('content-range') ?? '';
  const [, totalRaw] = contentRange.split('/');
  const total = Number(totalRaw);
  return Number.isFinite(total) ? total : 0;
}

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
  const response = await fetch(resolveRequestUrl(path), {
    ...init,
    headers,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
