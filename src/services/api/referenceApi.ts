import type {
  Agence,
  RefItem,
  StatutDossier,
  StatutInstance,
  TypeDossier,
  TypeDocument,
  TypeInstance,
  TypeProcedure,
} from '../../types/domain';
import { getSessionAgency, isNeonDataApiEnabled, requestNeonRest, requestJson } from './utils';

async function getSimpleReferenceRows<T extends { id: number; libelle: string }>(table: string): Promise<T[]> {
  return requestNeonRest<T[]>(`/${table}?select=id,libelle&order=id.asc`);
}

export async function getStatutsDossier() {
  if (isNeonDataApiEnabled()) {
    return getSimpleReferenceRows<StatutDossier>('statut_dossier');
  }

  return requestJson<StatutDossier[]>('/api/statut_dossier');
}

export async function getStatutsProcedure() {
  if (isNeonDataApiEnabled()) {
    return getSimpleReferenceRows<StatutDossier>('statut_procedure');
  }

  return requestJson<StatutDossier[]>('/api/statut_procedure');
}

export async function getTypesProcedure() {
  if (isNeonDataApiEnabled()) {
    return getSimpleReferenceRows<TypeProcedure>('type_procedure');
  }

  return requestJson<TypeProcedure[]>('/api/type_procedure');
}

export async function getTypesDocument() {
  if (isNeonDataApiEnabled()) {
    return getSimpleReferenceRows<TypeDocument>('type_document');
  }

  return requestJson<TypeDocument[]>('/api/type_document');
}

export async function getTypesInstance() {
  if (isNeonDataApiEnabled()) {
    return getSimpleReferenceRows<TypeInstance>('type_instance');
  }

  return requestJson<TypeInstance[]>('/api/type_instance');
}

export async function getStatutsInstance() {
  if (isNeonDataApiEnabled()) {
    return getSimpleReferenceRows<StatutInstance>('statut_instance');
  }

  return requestJson<StatutInstance[]>('/api/statut_instance');
}

export async function getTypesDossier() {
  if (isNeonDataApiEnabled()) {
    return getSimpleReferenceRows<TypeDossier>('type_dossier');
  }

  return requestJson<TypeDossier[]>('/api/type_dossier');
}

export async function getAgences() {
  if (isNeonDataApiEnabled()) {
    type AgenceRow = { id: number; nom: string; ville?: string | null };
    const agency = String(getSessionAgency() ?? '').trim();
    if (!agency) {
      return requestNeonRest<Agence[]>('/agence?select=id,nom&order=id.asc');
    }

    const wildcard = `*${agency}*`;
    return requestNeonRest<AgenceRow[]>(`/agence?select=id,nom,ville&or=(nom.ilike.${wildcard},ville.ilike.${wildcard})&order=id.asc`)
      .then((rows) => rows.map((row) => ({ id: row.id, nom: row.nom })));
  }

  return requestJson<Agence[]>('/api/agence');
}

// =========================================================
// CRUD generique pour tables referentiel simples (id + libelle)
// =========================================================

const SIMPLE_REF_TABLES = new Set([
  'statut_dossier',
  'type_dossier',
  'statut_procedure',
  'type_procedure',
  'statut_instance',
  'type_instance',
  'type_document',
]);

export function isSimpleRefTable(table: string): boolean {
  return SIMPLE_REF_TABLES.has(table);
}

export async function createReferenceItem(table: string, libelle: string): Promise<RefItem> {
  return requestJson<RefItem>(`/api/${table}`, {
    method: 'POST',
    body: JSON.stringify({ libelle }),
  });
}

export async function updateReferenceItem(table: string, id: number, libelle: string): Promise<RefItem> {
  return requestJson<RefItem>(`/api/${table}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ libelle }),
  });
}

export async function deleteReferenceItem(table: string, id: number): Promise<void> {
  await requestJson<void>(`/api/${table}/${id}`, { method: 'DELETE' });
}

// =========================================================
// CRUD Agences
// =========================================================

export async function getAgenceById(id: number): Promise<Agence> {
  return requestJson<Agence>(`/api/agence/${id}`);
}

export async function createAgence(payload: { nom: string; adresse?: string; ville?: string; codePostal?: string }): Promise<Agence> {
  return requestJson<Agence>('/api/agence', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAgence(id: number, payload: { nom: string; adresse?: string; ville?: string; codePostal?: string }): Promise<Agence> {
  return requestJson<Agence>(`/api/agence/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteAgence(id: number): Promise<void> {
  await requestJson<void>(`/api/agence/${id}`, { method: 'DELETE' });
}
