import { createAuthClient } from '@neondatabase/neon-js/auth';

let neonAuthClient: ReturnType<typeof createAuthClient> | null = null;

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

export function getNeonAuthClient(): ReturnType<typeof createAuthClient> | null {
  if (!canUseNeonAuthSdk()) {
    return null;
  }

  if (neonAuthClient) {
    return neonAuthClient;
  }

  neonAuthClient = createAuthClient(getNeonAuthUrl());
  return neonAuthClient;
}

export async function startNeonAuthSocialSignIn(provider: 'google' | 'github'): Promise<void> {
  const authClient = getNeonAuthClient() as any;
  if (!authClient) {
    throw new Error('Neon Auth indisponible. Verifiez VITE_NEON_AUTH_URL.');
  }

  const callbackUrl = globalThis.window?.location?.href ?? undefined;

  if (typeof authClient.signInSocial === 'function') {
    await authClient.signInSocial({ provider, callbackURL: callbackUrl });
    return;
  }

  if (typeof authClient.signIn?.social === 'function') {
    await authClient.signIn.social({ provider, callbackURL: callbackUrl });
    return;
  }

  throw new Error('Le SDK Neon Auth ne fournit pas de methode signIn social dans cette version.');
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
  const authClient = getNeonAuthClient() as any;
  if (!authClient) {
    return '';
  }

  // First, inspect session state. Without an authenticated session, /auth/token is expected to return 401.
  if (typeof authClient.getSession === 'function') {
    let headerToken = '';

    const sessionResponse = await authClient.getSession({
      fetchOptions: {
        onSuccess: (ctx: any) => {
          const token = ctx?.response?.headers?.get?.('set-auth-jwt');
          headerToken = String(token ?? '').trim();
        },
      },
    });

    if (headerToken) {
      return headerToken;
    }

    const hasSession = Boolean(sessionResponse?.data?.session ?? sessionResponse?.data);
    if (!hasSession) {
      return '';
    }
  }

  // Preferred flow from Neon docs: use authClient.token() to retrieve a raw JWT.
  if (typeof authClient.token === 'function') {
    const tokenResponse = await authClient.token();
    const token = String(tokenResponse?.data?.token ?? '').trim();
    if (token) {
      return token;
    }

    if (tokenResponse?.error) {
      throw tokenResponse.error;
    }
  }

  return '';
}
