import type {
  Client,
  DashboardMetric,
  DocumentItem,
  Dossier,
  ProcedureItem,
} from '../types/domain';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
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

function toQueryString(filters: Record<string, string | null | undefined>): string {
  const entries = Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) {
    return '';
  }

  const params = new URLSearchParams(entries.map(([key, value]) => [key, String(value)]));
  return `?${params.toString()}`;
}

export async function getApiHealth() {
  return requestJson<{ ok: boolean; database: string }>('/api/health');
}

export async function getDashboardMetrics() {
  return requestJson<DashboardMetric[]>('/api/dashboard');
}

export async function getClients(filters: { q?: string; agence?: string } = {}) {
  const query = toQueryString(filters);
  return requestJson<Client[]>(`/api/clients${query}`);
}

export async function createClient(payload: {
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  agence?: string;
  responsable?: string;
}) {
  return requestJson<Client>('/api/clients', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getDossiers(filters: { q?: string; statut?: string; agence?: string } = {}) {
  const query = toQueryString(filters);
  return requestJson<Dossier[]>(`/api/dossiers${query}`);
}

export async function createDossier(payload: {
  reference: string;
  client: string;
  type: string;
  statut: string;
  agence: string;
  ouverture: string;
  echeance: string;
  montant: number;
}) {
  return requestJson<Dossier>('/api/dossiers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getProcedures() {
  return requestJson<ProcedureItem[]>('/api/procedures');
}

export async function getDocuments() {
  return requestJson<DocumentItem[]>('/api/documents');
}

export async function createDocument(payload: {
  type: string;
  dossierReference?: string;
  auteur: string;
  statut?: string;
}) {
  return requestJson<DocumentItem>('/api/documents', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
