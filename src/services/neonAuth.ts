import { createAuthClient } from '@neondatabase/neon-js/auth';

let neonAuthClient: ReturnType<typeof createAuthClient> | null = null;

function getNeonAuthUrl(): string {
  return String(import.meta.env.VITE_NEON_AUTH_URL ?? '').trim().replace(/\/$/, '');
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

export async function fetchJwtFromNeonSdk(): Promise<string> {
  const authClient = getNeonAuthClient() as any;
  if (!authClient) {
    return '';
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

  // Fallback from Neon docs: read set-auth-jwt header returned by getSession().
  if (typeof authClient.getSession === 'function') {
    let headerToken = '';

    await authClient.getSession({
      fetchOptions: {
        onSuccess: (ctx: any) => {
          const token = ctx?.response?.headers?.get?.('set-auth-jwt');
          headerToken = String(token ?? '').trim();
        },
      },
    });

    return headerToken;
  }

  return '';
}
