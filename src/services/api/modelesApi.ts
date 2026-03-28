import type {
  DocumentItem,
  ModeleDocumentDetail,
  ModeleDocumentItem,
  ModeleDocumentVersion,
} from '../../types/domain';
import { requestJson, toQueryString } from './utils';

export async function getModeles(filters: {
  q?: string;
  typeDocumentId?: string;
  sousDomaineId?: string;
  publishedOnly?: boolean;
} = {}) {
  const query = toQueryString({
    q: filters.q,
    typeDocumentId: filters.typeDocumentId,
    sousDomaineId: filters.sousDomaineId,
    publishedOnly: filters.publishedOnly ? 'true' : undefined,
  });

  return requestJson<ModeleDocumentItem[]>(`/api/modeles${query}`);
}

export async function getModeleById(id: number) {
  return requestJson<ModeleDocumentDetail>(`/api/modeles/${id}`);
}

export async function createModele(payload: {
  typeDocumentId: number;
  nomModele: string;
  description?: string;
  contenuJson?: Record<string, unknown>;
  sousDomaines?: number[];
  paragraphes?: Array<{ ordre?: number; contenu: string }>;
}) {
  return requestJson<ModeleDocumentItem>('/api/modeles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateModele(id: number, payload: {
  typeDocumentId?: number;
  nomModele?: string;
  description?: string;
  contenuJson?: Record<string, unknown>;
  sousDomaines?: number[];
  paragraphes?: Array<{ ordre?: number; contenu: string }>;
}) {
  return requestJson<ModeleDocumentItem>(`/api/modeles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function publishModele(id: number, payload: { commentaire?: string } = {}) {
  return requestJson<ModeleDocumentVersion>(`/api/modeles/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getModeleVersions(id: number) {
  return requestJson<ModeleDocumentVersion[]>(`/api/modeles/${id}/versions`);
}

export async function getModeleVersion(id: number, version: number) {
  return requestJson<ModeleDocumentVersion>(`/api/modeles/${id}/versions/${version}`);
}

export async function generateDocument(payload: {
  modeleId: number;
  numeroVersion: number;
  scopeType: 'dossier' | 'procedure' | 'instance';
  scopeId: number;
  typeDocumentId?: number;
  variables?: Record<string, unknown>;
}) {
  return requestJson<DocumentItem>('/api/documents/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
