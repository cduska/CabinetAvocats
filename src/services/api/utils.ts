import { getSessionHeaders } from '../session';
import { fetchJwtFromNeonSdk } from '../neonAuth';

const NEON_TOKEN_STORAGE_KEYS = [
  'cabinet.neon.jwt',
  'cabinet_neon_jwt',
  'neon.auth.token',
  'neon_auth_token',
  'auth_token',
];
const NEON_TOKEN_EVENT = 'cabinet:neon-token-changed';

let neonTokenFetchPromise: Promise<string> | null = null;
let neonTokenLastMissAt = 0;
const NEON_TOKEN_RETRY_MS = 15000;

// Decode the `exp` claim from a JWT without verifying the signature.
// Returns true when the token is expired or cannot be parsed.
function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    // base64url → base64
    const b64 = parts[1].replaceAll('-', '+').replaceAll('_', '/').padEnd(
      parts[1].length + ((4 - (parts[1].length % 4)) % 4), '=',
    );
    const payload = JSON.parse(atob(b64)) as Record<string, unknown>;
    if (typeof payload.exp !== 'number') return false; // no exp = never expires
    // Add a 30-second buffer to account for clock skew.
    return payload.exp < Math.floor(Date.now() / 1000) + 30;
  } catch {
    return true;
  }
}

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

function normalizeNeonAuthUrl(raw: string): string {
  const trimmed = String(raw ?? '').trim().replace(/\/$/, '');
  if (!trimmed) {
    return '';
  }

  const lowered = trimmed.toLowerCase();
  if (lowered.endsWith('/neondb/auth')) {
    return trimmed.slice(0, -('/neondb/auth'.length));
  }

  if (lowered.endsWith('/auth') && lowered.includes('.neonauth.')) {
    return trimmed.slice(0, -('/auth'.length));
  }

  return trimmed;
}

function notifyNeonTokenChanged(): void {
  if (globalThis.window === undefined) {
    return;
  }

  globalThis.window.dispatchEvent(new CustomEvent(NEON_TOKEN_EVENT));
}

export function onNeonAuthTokenChange(listener: () => void): () => void {
  if (globalThis.window === undefined) {
    return () => undefined;
  }

  const handler = () => listener();
  globalThis.window.addEventListener(NEON_TOKEN_EVENT, handler);
  globalThis.window.addEventListener('storage', handler);

  return () => {
    globalThis.window?.removeEventListener(NEON_TOKEN_EVENT, handler);
    globalThis.window?.removeEventListener('storage', handler);
  };
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

export function getNeonAuthBaseUrl(): string {
  return normalizeNeonAuthUrl(String(import.meta.env.VITE_NEON_AUTH_URL ?? ''));
}

export function getNeonAuthTokenSource(): 'localStorage' | 'sessionStorage' | 'env' | 'missing' {
  if (globalThis.window !== undefined) {
    for (const key of NEON_TOKEN_STORAGE_KEYS) {
      const localValue = (globalThis.window.localStorage.getItem(key) ?? '').trim();
      if (localValue) {
        return 'localStorage';
      }

      const sessionValue = (globalThis.window.sessionStorage.getItem(key) ?? '').trim();
      if (sessionValue) {
        return 'sessionStorage';
      }
    }
  }

  const envToken = String(import.meta.env.VITE_NEON_AUTH_BEARER ?? '').trim();
  return envToken ? 'env' : 'missing';
}

export function getNeonAuthToken(): string {
  // Always returns the stored token without checking expiry.
  // Expiry-aware refresh is handled in buildNeonHeaders().
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
  notifyNeonTokenChanged();
}

export function clearNeonAuthToken(): void {
  if (globalThis.window === undefined) {
    return;
  }

  for (const key of NEON_TOKEN_STORAGE_KEYS) {
    globalThis.window.localStorage.removeItem(key);
    globalThis.window.sessionStorage.removeItem(key);
  }

  notifyNeonTokenChanged();
}

export async function ensureNeonAuthToken(): Promise<string> {
  const existing = getNeonAuthToken();
  if (existing) {
    return existing;
  }

  if (!isNeonDataApiEnabled() || !isNeonAutoTokenEnabled()) {
    return '';
  }

  if (Date.now() - neonTokenLastMissAt < NEON_TOKEN_RETRY_MS) {
    return '';
  }

  neonTokenFetchPromise ??= fetchJwtFromNeonSdk()
    .then((token) => {
      const normalized = token.trim();
      if (normalized) {
        setNeonAuthToken(normalized);
        neonTokenLastMissAt = 0;
      } else {
        neonTokenLastMissAt = Date.now();
      }
      return normalized;
    })
    .catch(() => {
      // Do not block API calls when Neon Auth SDK cannot provide a token yet.
      neonTokenLastMissAt = Date.now();
      return '';
    })
    .finally(() => {
      neonTokenFetchPromise = null;
    });

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

async function buildNeonHeaders(existingHeaders?: HeadersInit): Promise<Headers> {
  const headers = new Headers(existingHeaders);
  let token = getNeonAuthToken();

  if (!token) {
    // No token at all: try the SDK.
    token = await ensureNeonAuthToken();
  } else if (isJwtExpired(token) && isNeonDataApiEnabled() && isNeonAutoTokenEnabled()) {
    // Token is expired: attempt a proactive refresh via the SDK.
    // Clear the stale value first so the SDK fetch is not skipped.
    const stale = token;
    clearNeonAuthToken();
    neonTokenLastMissAt = 0;
    const fresh = await fetchJwtFromNeonSdk().then((t) => t.trim()).catch(() => '');
    if (fresh) {
      setNeonAuthToken(fresh);
      token = fresh;
    } else {
      // SDK could not supply a fresh token (e.g. VITE_NEON_AUTH_URL not set).
      // Restore the stale token so the request still carries credentials;
      // the server will return a descriptive error rather than "missing credentials".
      setNeonAuthToken(stale);
      token = stale;
    }
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  return headers;
}

export async function requestNeonRest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await buildNeonHeaders(init?.headers);

  const response = await fetch(resolveNeonResourceUrl(path), { ...init, headers });

  // On 401, the stored token may be stale/expired — clear it, fetch a fresh one
  // and retry the request exactly once.
  if (response.status === 401) {
    clearNeonAuthToken();
    neonTokenLastMissAt = 0;
    const retryHeaders = await buildNeonHeaders(init?.headers);
    const retryResponse = await fetch(resolveNeonResourceUrl(path), { ...init, headers: retryHeaders });
    if (!retryResponse.ok) {
      const message = await retryResponse.text();
      throw new Error(message || `Neon Data API request failed after token refresh (${retryResponse.status})`);
    }
    if (retryResponse.status === 204) return undefined as T;
    return retryResponse.json() as Promise<T>;
  }

  if (!response.ok) {
    const message = await response.text();
    if (response.status === 403) {
      throw new Error(message || 'Acces Neon refuse (403). Verifiez la configuration Neon Auth/Data API et la session JWT.');
    }
    throw new Error(message || `Neon Data API request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function doNeonCount(path: string): Promise<Response> {
  const headers = await buildNeonHeaders();
  headers.set('Prefer', 'count=exact');
  return fetch(resolveNeonResourceUrl(path), { method: 'GET', headers });
}

export async function requestNeonCount(path: string): Promise<number> {
  let response = await doNeonCount(path);

  if (response.status === 401) {
    clearNeonAuthToken();
    neonTokenLastMissAt = 0;
    response = await doNeonCount(path);
  }

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
