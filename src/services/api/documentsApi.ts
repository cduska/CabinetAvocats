import type { DocumentItem } from '../../types/domain';
import { toQueryString, withSessionAgencyFilter, requestJson } from './utils';

export async function getDocuments() {
  const query = toQueryString(withSessionAgencyFilter({ agence: undefined }));
  return requestJson<DocumentItem[]>(`/api/documents${query}`);
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
