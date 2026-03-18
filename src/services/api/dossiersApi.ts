import type { Dossier } from '../../types/domain';
import { toQueryString, withSessionAgencyFilter, requestJson } from './utils';

export async function getDossiers(filters: { q?: string; statut?: string; agence?: string } = {}) {
  const query = toQueryString(withSessionAgencyFilter(filters));
  return requestJson<Dossier[]>(`/api/dossiers${query}`);
}

export async function getDossierById(id: number) {
  return requestJson<Dossier>(`/api/dossiers/${id}`);
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
