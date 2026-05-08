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
    informationsSecretesSet: false,
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

async function getClientId(name: string, agenceId: number | null): Promise<number> {
  const parts = name.trim().split(/\s+/);
  const prenom = parts[0] ?? '';
  const nom = parts.slice(1).join(' ') || prenom;

  const nameWildcard = encodeURIComponent(`*${name.trim()}*`);
  const agenceFilter = agenceId === null ? '' : `&id_agence=eq.${agenceId}`;
  const rows = await requestNeonRest<Array<{ id: number }>>(
    `/client?select=id&or=(nom.ilike.${nameWildcard},prenom.ilike.${nameWildcard})${agenceFilter}&order=id.asc&limit=1`,
  );
  if (rows[0]) {
    return rows[0].id;
  }

  // Create a new client
  const clientBody: Record<string, unknown> = { prenom, nom };
  if (agenceId === null) {
    clientBody.id_agence = null;
  } else {
    clientBody.id_agence = agenceId;
  }
  const created = await requestNeonRest<Array<{ id: number }>>('/client', {
    method: 'POST',
    body: JSON.stringify(clientBody),
    headers: { Prefer: 'return=representation,resolution=header-or-ignore' },
  });
  const newId = created[0]?.id;
  if (!Number.isFinite(newId)) {
    throw new TypeError(`Client introuvable ou non créé: ${name.trim()}`);
  }
  return newId;
}

async function getTypeDossierId(label: string): Promise<number> {
  const rows = await requestNeonRest<Array<{ id: number }>>(`/type_dossier?select=id&libelle=eq.${encodeURIComponent(label)}&limit=1`);
  const id = rows[0]?.id;
  if (!Number.isFinite(id)) {
    throw new TypeError(`Type de dossier introuvable: ${label}`);
  }
  return id;
}

async function getStatutDossierId(label: string): Promise<number> {
  const rows = await requestNeonRest<Array<{ id: number }>>(`/statut_dossier?select=id&libelle=eq.${encodeURIComponent(label)}&limit=1`);
  const id = rows[0]?.id;
  if (!Number.isFinite(id)) {
    throw new TypeError(`Statut de dossier introuvable: ${label}`);
  }
  return id;
}

async function getAgenceId(name: string): Promise<number | null> {
  if (!name.trim()) return null;
  const wildcard = encodeURIComponent(`*${name.trim()}*`);
  const rows = await requestNeonRest<Array<{ id: number }>>(`/agence?select=id&or=(nom.ilike.${wildcard},ville.ilike.${wildcard})&order=id.asc&limit=1`);
  return rows[0]?.id ?? null;
}

async function upsertFacture(dossierId: number, montant: number): Promise<void> {
  if (!Number.isFinite(montant)) return;
  const existing = await requestNeonRest<Array<{ id: number }>>(
    `/facture?select=id&id_dossier=eq.${dossierId}&order=date_emission.desc.nullslast,id.desc&limit=1`,
  );
  if (existing[0]) {
    await requestNeonRest(`/facture?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ montant }),
      headers: { Prefer: 'return=minimal' },
    });
  } else if (montant > 0) {
    await requestNeonRest('/facture', {
      method: 'POST',
      body: JSON.stringify({ id_dossier: dossierId, montant, statut: 'Brouillon' }),
      headers: { Prefer: 'return=minimal' },
    });
  }
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
  informationsSecretes?: string | null;
}) {
  if (isNeonDataApiEnabled()) {
    const agenceId = await getAgenceId(payload.agence);
    const [clientId, typeId, statutId] = await Promise.all([
      getClientId(payload.client, agenceId),
      getTypeDossierId(payload.type),
      getStatutDossierId(payload.statut),
    ]);

    await requestNeonRest(`/dossier?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        reference: payload.reference,
        id_client: clientId,
        id_type_dossier: typeId,
        id_statut_dossier: statutId,
        date_ouverture: payload.ouverture || null,
        date_cloture: payload.echeance || null,
      }),
      headers: { Prefer: 'return=minimal' },
    });

    await upsertFacture(id, payload.montant);
    return getDossierByIdFromNeon(id);
  }

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
  informationsSecretes?: string | null;
}) {
  if (isNeonDataApiEnabled()) {
    const agenceId = await getAgenceId(payload.agence);
    const [clientId, typeId, statutId] = await Promise.all([
      getClientId(payload.client, agenceId),
      getTypeDossierId(payload.type),
      getStatutDossierId(payload.statut),
    ]);

    const rows = await requestNeonRest<Array<{ id: number }>>('/dossier', {
      method: 'POST',
      body: JSON.stringify({
        reference: payload.reference,
        id_client: clientId,
        id_type_dossier: typeId,
        id_statut_dossier: statutId,
        ...(agenceId === null ? {} : { id_agence: agenceId }),
        date_ouverture: payload.ouverture || null,
        date_cloture: payload.echeance || null,
      }),
      headers: { Prefer: 'return=representation,resolution=header-or-ignore' },
    });

    const newId = rows[0]?.id;
    if (!Number.isFinite(newId)) {
      throw new TypeError('Erreur lors de la création du dossier.');
    }

    if (Number.isFinite(payload.montant) && payload.montant > 0) {
      await upsertFacture(newId, payload.montant);
    }

    return getDossierByIdFromNeon(newId);
  }

  return requestJson<Dossier>('/api/dossiers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function decryptInformationsSecretes(dossierId: number): Promise<string | null> {
  if (isNeonDataApiEnabled()) {
    throw new Error('Le déchiffrement des informations confidentielles nécessite le serveur backend — non disponible en mode Neon direct.');
  }

  const result = await requestJson<{ value: string | null }>(`/api/dossiers/${dossierId}/decrypt`, {
    method: 'POST',
  });
  return result.value;
}
