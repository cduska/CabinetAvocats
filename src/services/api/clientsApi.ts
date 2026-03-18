import type { Client } from '../../types/domain';
import { toQueryString, withSessionAgencyFilter, requestJson } from './utils';

export async function getClients(filters: { q?: string; agence?: string } = {}) {
  const query = toQueryString(withSessionAgencyFilter(filters));
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
