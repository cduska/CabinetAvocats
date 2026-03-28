import type { Client } from '../../types/domain';
import {
  getSessionAgency,
  isNeonDataApiEnabled,
  requestNeonRest,
  toQueryString,
  withSessionAgencyFilter,
  requestJson,
} from './utils';

type NeonClientRow = {
  id: number;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  agence?: { nom?: string | null; ville?: string | null } | null;
  collaborateur?: { nom?: string | null; prenom?: string | null } | null;
};

function mapNeonClient(row: NeonClientRow): Client {
  return {
    id: row.id,
    nom: row.nom ?? '',
    prenom: row.prenom ?? '',
    email: row.email ?? '',
    telephone: row.telephone ?? '',
    agence: row.agence?.nom ?? row.agence?.ville ?? 'Non renseignee',
    responsable: [row.collaborateur?.prenom ?? '', row.collaborateur?.nom ?? ''].join(' ').trim() || 'Non assigne',
  };
}

async function getClientsFromNeon(filters: { q?: string; agence?: string } = {}): Promise<Client[]> {
  const params = new URLSearchParams();
  params.set('select', 'id,nom,prenom,email,telephone,agence!inner(nom,ville),collaborateur(nom,prenom)');
  params.set('order', 'id.desc');

  const queryText = String(filters.q ?? '').trim();
  if (queryText) {
    const encoded = `*${queryText}*`;
    params.set('or', `nom.ilike.${encoded},prenom.ilike.${encoded},email.ilike.${encoded},telephone.ilike.${encoded}`);
  }

  const agenceFilter = String(filters.agence ?? getSessionAgency() ?? '').trim();
  if (agenceFilter) {
    const encodedAgence = `*${agenceFilter}*`;
    params.set('agence.or', `(nom.ilike.${encodedAgence},ville.ilike.${encodedAgence})`);
  }

  const rows = await requestNeonRest<NeonClientRow[]>(`/client?${params.toString()}`);
  return rows.map(mapNeonClient);
}

export async function getClients(filters: { q?: string; agence?: string } = {}) {
  if (isNeonDataApiEnabled()) {
    return getClientsFromNeon(filters);
  }

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
