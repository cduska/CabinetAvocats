import type { DocumentItem } from '../../types/domain';
import {
  getSessionAgency,
  isNeonDataApiEnabled,
  requestNeonRest,
  toQueryString,
  withSessionAgencyFilter,
  requestJson,
} from './utils';

type DocumentNeonRow = {
  id: number;
  id_procedure?: number | null;
  id_instance?: number | null;
  id_modele?: number | null;
  numero_version_modele?: number | null;
  statut_document?: string | null;
  date_creation?: string | null;
  type_document?: { libelle?: string | null } | null;
  collaborateur?: { prenom?: string | null; nom?: string | null } | null;
  dossier?: { reference?: string | null; agence?: { nom?: string | null; ville?: string | null } | null } | null;
  procedure?: {
    dossier?: { reference?: string | null; agence?: { nom?: string | null; ville?: string | null } | null } | null;
  } | null;
  instance_juridique?: {
    procedure?: {
      dossier?: { reference?: string | null; agence?: { nom?: string | null; ville?: string | null } | null } | null;
    } | null;
  } | null;
};

function getDocumentAgency(row: DocumentNeonRow): string {
  return (
    row.dossier?.agence?.nom
    || row.dossier?.agence?.ville
    || row.procedure?.dossier?.agence?.nom
    || row.procedure?.dossier?.agence?.ville
    || row.instance_juridique?.procedure?.dossier?.agence?.nom
    || row.instance_juridique?.procedure?.dossier?.agence?.ville
    || ''
  );
}

function getDocumentReference(row: DocumentNeonRow): string {
  return (
    row.dossier?.reference
    || row.procedure?.dossier?.reference
    || row.instance_juridique?.procedure?.dossier?.reference
    || ''
  );
}

function mapDocument(row: DocumentNeonRow): DocumentItem {
  const auteur = [row.collaborateur?.prenom ?? '', row.collaborateur?.nom ?? '']
    .join(' ')
    .trim() || 'Non assigne';

  return {
    id: row.id,
    type: row.type_document?.libelle ?? 'Document',
    dossierReference: getDocumentReference(row),
    procedureId: row.id_procedure ?? undefined,
    instanceId: row.id_instance ?? undefined,
    auteur,
    dateCreation: String(row.date_creation ?? '').slice(0, 10),
    statut: row.statut_document ?? 'brouillon',
    modeleId: row.id_modele ?? undefined,
    modeleVersion: row.numero_version_modele ?? undefined,
  };
}

async function findTypeDocumentId(typeLabel: string): Promise<number> {
  const normalized = typeLabel.trim();
  if (!normalized) {
    throw new Error('Type document invalide.');
  }

  const existing = await requestNeonRest<Array<{ id: number }>>(
    `/type_document?select=id&libelle=eq.${encodeURIComponent(normalized)}&limit=1`,
  );
  const existingId = existing[0]?.id;
  if (Number.isFinite(existingId)) {
    return existingId;
  }

  const inserted = await requestNeonRest<Array<{ id: number }>>('/type_document', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ libelle: normalized }),
  });

  const insertedId = inserted[0]?.id;
  if (!Number.isFinite(insertedId)) {
    throw new Error('Impossible de creer le type document.');
  }

  return insertedId;
}

async function findDossierId(identifier?: string): Promise<number | null> {
  const normalized = String(identifier ?? '').trim();
  if (!normalized) {
    return null;
  }

  const byId = Number(normalized);
  if (Number.isFinite(byId) && byId > 0) {
    const byIdRows = await requestNeonRest<Array<{ id: number }>>(`/dossier?select=id&id=eq.${byId}&limit=1`);
    if (byIdRows[0]?.id) {
      return byIdRows[0].id;
    }
  }

  const byReference = await requestNeonRest<Array<{ id: number }>>(
    `/dossier?select=id&reference=eq.${encodeURIComponent(normalized)}&order=id.desc&limit=1`,
  );
  return byReference[0]?.id ?? null;
}

async function findAuteurId(auteur: string): Promise<number | null> {
  const normalized = auteur.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const rows = await requestNeonRest<Array<{ id: number; nom?: string | null; prenom?: string | null }>>(
    '/collaborateur?select=id,nom,prenom&limit=1000',
  );

  const match = rows.find((row) => `${row.prenom ?? ''} ${row.nom ?? ''}`.trim().toLowerCase() === normalized);
  return match?.id ?? null;
}

async function getDocumentsFromNeon(): Promise<DocumentItem[]> {
  const rows = await requestNeonRest<DocumentNeonRow[]>(
    '/document?select=id,id_procedure,id_instance,id_modele,numero_version_modele,statut_document,date_creation,type_document(libelle),collaborateur(prenom,nom),dossier(reference,agence(nom,ville)),procedure(dossier(reference,agence(nom,ville))),instance_juridique(procedure(dossier(reference,agence(nom,ville))))&order=id.desc',
  );

  const agency = String(getSessionAgency() ?? '').trim().toLowerCase();
  const filtered = agency
    ? rows.filter((row) => getDocumentAgency(row).toLowerCase().includes(agency))
    : rows;

  return filtered.map(mapDocument);
}

async function getDocumentByIdFromNeon(id: number): Promise<DocumentItem> {
  const rows = await requestNeonRest<DocumentNeonRow[]>(
    `/document?select=id,id_procedure,id_instance,id_modele,numero_version_modele,statut_document,date_creation,type_document(libelle),collaborateur(prenom,nom),dossier(reference,agence(nom,ville)),procedure(dossier(reference,agence(nom,ville))),instance_juridique(procedure(dossier(reference,agence(nom,ville))))&id=eq.${id}&limit=1`,
  );

  const row = rows[0];
  if (!row) {
    throw new Error('Document introuvable.');
  }

  return mapDocument(row);
}

export async function getDocuments() {
  if (isNeonDataApiEnabled()) {
    return getDocumentsFromNeon();
  }

  const query = toQueryString(withSessionAgencyFilter({ agence: undefined }));
  return requestJson<DocumentItem[]>(`/api/documents${query}`);
}

export async function createDocument(payload: {
  type: string;
  dossierReference?: string;
  auteur: string;
  statut?: string;
}) {
  if (isNeonDataApiEnabled()) {
    const [typeId, dossierId, auteurId] = await Promise.all([
      findTypeDocumentId(payload.type),
      findDossierId(payload.dossierReference),
      findAuteurId(payload.auteur),
    ]);

    const inserted = await requestNeonRest<Array<{ id: number }>>('/document', {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        id_type_document: typeId,
        id_dossier: dossierId,
        auteur: auteurId,
        chemin_fichier: '/documents/local',
        date_creation: new Date().toISOString(),
        statut_document: payload.statut ?? 'brouillon',
      }),
    });

    const id = inserted[0]?.id;
    if (!Number.isFinite(id)) {
      throw new Error('Creation du document impossible.');
    }

    return getDocumentByIdFromNeon(id);
  }

  return requestJson<DocumentItem>('/api/documents', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDocumentStatus(id: number, payload: { statut: string; commentaire?: string }) {
  if (isNeonDataApiEnabled()) {
    await requestNeonRest(`/document?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        statut_document: payload.statut,
      }),
    });

    return getDocumentByIdFromNeon(id);
  }

  return requestJson<DocumentItem>(`/api/documents/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
