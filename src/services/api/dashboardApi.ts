import type { DashboardMetric } from '../../types/domain';
import { toQueryString, withSessionAgencyFilter, requestJson } from './utils';

export async function getDashboardMetrics() {
  const query = toQueryString(withSessionAgencyFilter({ agence: undefined }));
  return requestJson<DashboardMetric[]>(`/api/dashboard${query}`);
}
