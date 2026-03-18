import type { ProcedureItem, ProcedureInstance } from '../../types/domain';
import { toQueryString, withSessionAgencyFilter, requestJson } from './utils';

export async function getProcedures() {
  const query = toQueryString(withSessionAgencyFilter({ agence: undefined }));
  return requestJson<ProcedureItem[]>(`/api/procedures${query}`);
}

export async function getProcedureById(id: number) {
  return requestJson<ProcedureItem>(`/api/procedures/${id}`);
}

export async function getProcedureInstances(id: number) {
  return requestJson<ProcedureInstance[]>(`/api/procedures/${id}/instances`);
}

export async function updateProcedure(id: number, payload: {
  type: string;
  statut: string;
  debut: string;
  fin: string;
}) {
  return requestJson<ProcedureItem>(`/api/procedures/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
