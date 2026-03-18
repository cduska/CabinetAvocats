import type { AudienceItem } from '../../types/domain';
import { toQueryString, withSessionAgencyFilter, requestJson } from './utils';

export async function getAudiences(preset?: 'upcoming7d') {
  const query = toQueryString(withSessionAgencyFilter({
    agence: undefined,
    preset,
  }));

  return requestJson<AudienceItem[]>(`/api/audiences${query}`);
}
