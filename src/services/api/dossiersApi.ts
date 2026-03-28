import type { Dossier } from '../../types/domain';
import {
  getSessionAgency,
  isNeonDataApiEnabled,
  requestNeonRest,
  toQueryString,
  withSessionAgencyFilter,
  requestJson,
} from './utils';

type NeonFactureRow = { montant?: number | string | null; date_emission?: string | null };
type NeonDossierRow = {
  id: number;
  reference?: string | null;
  id_client?: number | null;
  id_type_dossier?: number | null;
  id_statut_dossier?: number | null;
  id_agence?: number | null;
  date_ouverture?: string | null;
  date_cloture?: string | null;
  client?: { nom?: string | null; prenom?: string | null } | null;
  type_dossier?: { libelle?: string | null } | null;
  statut_dossier?: { libelle?: string | null } | null;
  agence?: { nom?: string | null; ville?: string | null } | null;
  facture?: NeonFactureRow[] | null;
};

function pickLatestFactureMontant(rows: NeonFactureRow[] | null | undefined): number {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }

  const sorted = [...rows].sort((a, b) => String(b.date_emission ?? '').localeCompare(String(a.date_emission ?? '')));
  const value = Number(sorted[0]?.montant ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function mapNeonDossier(row: NeonDossierRow): Dossier {
  return {
    id: row.id,
    reference: row.reference ?? '',
    clientId: row.id_client ?? null,
    client: [row.client?.prenom ?? '', row.client?.nom ?? ''].join(' ').trim() || 'Non renseigne',
    typeId: row.id_type_dossier ?? null,
    type: row.type_dossier?.libelle ?? 'Non renseigne',
    statutId: row.id_statut_dossier ?? null,
    statut: row.statut_dossier?.libelle ?? 'Non renseigne',
    agenceId: row.id_agence ?? null,
    agence: row.agence?.nom ?? row.agence?.ville ?? 'Non renseignee',
    ouverture: row.date_ouverture ?? '',
    echeance: row.date_cloture ?? '',
    montant: pickLatestFactureMontant(row.facture),
  };
}

async function getDossiersFromNeon(filters: { q?: string; statut?: string; agence?: string } = {}): Promise<Dossier[]> {
  const params = new URLSearchParams();
  params.set('select', 'id,reference,id_client,id_type_dossier,id_statut_dossier,id_agence,date_ouverture,date_cloture,client(nom,prenom),type_dossier(libelle),statut_dossier(libelle),agence!inner(nom,ville),facture(montant,date_emission)');
  params.set('order', 'id.desc');

  const q = String(filters.q ?? '').trim();
  if (q) {
    const wildcard = `*${q}*`;
    params.set('or', `reference.ilike.${wildcard}`);
  }

  if (filters.statut) {
    params.set('statut_dossier.libelle', `eq.${filters.statut}`);
  }

  const agency = String(filters.agence ?? getSessionAgency() ?? '').trim();
  if (agency) {
    const wildcardAgency = `*${agency}*`;
    params.set('agence.or', `(nom.ilike.${wildcardAgency},ville.ilike.${wildcardAgency})`);
  }

  const rows = await requestNeonRest<NeonDossierRow[]>(`/dossier?${params.toString()}`);
  return rows.map(mapNeonDossier);
}

async function getDossierByIdFromNeon(id: number): Promise<Dossier> {
  const params = new URLSearchParams();
  params.set('select', 'id,reference,id_client,id_type_dossier,id_statut_dossier,id_agence,date_ouverture,date_cloture,client(nom,prenom),type_dossier(libelle),statut_dossier(libelle),agence(nom,ville),facture(montant,date_emission)');
  params.set('id', `eq.${id}`);
  params.set('limit', '1');

  const rows = await requestNeonRest<NeonDossierRow[]>(`/dossier?${params.toString()}`);
  const row = rows[0];
  if (!row) {
    throw new Error('Dossier introuvable.');
  }

  return mapNeonDossier(row);
}

export async function getDossiers(filters: { q?: string; statut?: string; agence?: string } = {}) {
  if (isNeonDataApiEnabled()) {
    return getDossiersFromNeon(filters);
  }

  const query = toQueryString(withSessionAgencyFilter(filters));
  return requestJson<Dossier[]>(`/api/dossiers${query}`);
}

export async function getDossierById(id: number) {
  if (isNeonDataApiEnabled()) {
    return getDossierByIdFromNeon(id);
  }

  return requestJson<Dossier>(`/api/dossiers/${id}`);
}

export async function updateDossier(id: number, payload: {
  reference: string;
  client: string;
  type: string;
  statut: string;
  agence: string;
  ouverture: string;
  echeance: string;
  montant: number;
}) {
  const query = toQueryString({ agence: payload.agence });
  return requestJson<Dossier>(`/api/dossiers/${id}${query}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
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
