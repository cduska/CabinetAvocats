import { createRemoteJWKSet, jwtVerify } from 'jose';

let cachedJwks = null;

function getNeonAuthBaseUrl() {
  return String(process.env.NEON_AUTH_BASE_URL || '').trim().replace(/\/$/, '');
}

function getNeonIssuer() {
  const baseUrl = getNeonAuthBaseUrl();
  if (!baseUrl) {
    return '';
  }

  return new URL(baseUrl).origin;
}

function getJwks() {
  if (cachedJwks) {
    return cachedJwks;
  }

  const baseUrl = getNeonAuthBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const jwksUrl = `${baseUrl}/.well-known/jwks.json`;
  cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
  return cachedJwks;
}

export function extractBearerToken(authorizationHeader) {
  const header = String(authorizationHeader || '').trim();
  if (!header.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return header.slice(7).trim();
}

export async function validateNeonToken(token) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    return null;
  }

  const issuer = getNeonIssuer();
  const jwks = getJwks();
  if (!issuer || !jwks) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(normalizedToken, jwks, {
      issuer,
      audience: issuer,
    });

    return payload;
  } catch (error) {
    console.error('Token validation failed:', error);
    return null;
  }
}
