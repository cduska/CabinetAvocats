import type { ProcedureItem } from '../../types/domain';
import { toQueryString, withSessionAgencyFilter, requestJson } from './utils';

export async function getProcedures() {
  const query = toQueryString(withSessionAgencyFilter({ agence: undefined }));
  return requestJson<ProcedureItem[]>(`/api/procedures${query}`);
}

export async function getProcedureById(id: number) {
  return requestJson<ProcedureItem>(`/api/procedures/${id}`);
}
