import { createInternalNeonAuth } from '@neondatabase/neon-js/auth';

// Full NeonAuth instance: exposes both the Better Auth adapter and getJWTToken().
// allowAnonymous: true → if no authenticated session exists, falls back to a
// Neon-issued anonymous JWT (GET /token/anonymous) so the Data API still works
// without requiring the user to click a login button.
type NeonAuthInstance = ReturnType<typeof createInternalNeonAuth>;
let neonAuth: NeonAuthInstance | null = null;

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

function getNeonAuthUrl(): string {
  return normalizeNeonAuthUrl(String(import.meta.env.VITE_NEON_AUTH_URL ?? ''));
}

function canUseNeonAuthSdk(): boolean {
  return globalThis.window !== undefined && getNeonAuthUrl().length > 0;
}

function getNeonAuthInstance(): NeonAuthInstance | null {
  if (!canUseNeonAuthSdk()) {
    return null;
  }

  if (neonAuth) {
    return neonAuth;
  }

  neonAuth = createInternalNeonAuth(getNeonAuthUrl(), { allowAnonymous: true });
  return neonAuth;
}

export function getNeonAuthClient(): NeonAuthInstance['adapter'] | null {
  return getNeonAuthInstance()?.adapter ?? null;
}

export async function getNeonAuthSessionState(): Promise<'active' | 'inactive' | 'unavailable'> {
  const authClient = getNeonAuthClient() as any;
  if (!authClient || typeof authClient.getSession !== 'function') {
    return 'unavailable';
  }

  try {
    const sessionResponse = await authClient.getSession();
    const hasSession = Boolean(sessionResponse?.data?.session ?? sessionResponse?.data);
    return hasSession ? 'active' : 'inactive';
  } catch {
    return 'inactive';
  }
}

export async function fetchJwtFromNeonSdk(): Promise<string> {
  const instance = getNeonAuthInstance();
  if (!instance) {
    return '';
  }

  try {
    // getJWTToken() tries the authenticated session first, then falls back to
    // the anonymous token endpoint (GET /token/anonymous) when allowAnonymous=true.
    const token = await instance.getJWTToken();
    return String(token ?? '').trim();
  } catch {
    return '';
  }
}
