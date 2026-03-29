import type { DashboardMetric } from '../../types/domain';
import { getSessionAgency, isNeonDataApiEnabled, requestNeonCount, toQueryString, withSessionAgencyFilter, requestJson } from './utils';

function normalizeAgencyFilterValue(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function agencyFilterQuery(prefix: string): string {
  const agency = normalizeAgencyFilterValue(getSessionAgency());
  if (!agency) {
    return '';
  }

  return `&${prefix}.or=(nom.ilike.*${encodeURIComponent(agency)}*,ville.ilike.*${encodeURIComponent(agency)}*)`;
}

async function getDashboardMetricsFromNeon(): Promise<DashboardMetric[]> {
  const activeDossiers = await requestNeonCount(
    `/dossier?select=id,statut_dossier!inner(libelle),agence!inner(id)&statut_dossier.libelle=not.in.(Clos,Cloture,cloture,clos)${agencyFilterQuery('agence')}&limit=1`,
  );

  const delayedProcedures = await requestNeonCount(
    `/procedure?select=id,dossier!inner(id,agence!inner(id))&date_fin=is.null&date_debut=lt.${encodeURIComponent(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))}${agencyFilterQuery('dossier.agence')}&limit=1`,
  );

  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const upcomingHearings = await requestNeonCount(
    `/audience?select=id,instance_juridique!inner(id,procedure!inner(id,dossier!inner(id,agence!inner(id))))&date_audience=gte.${encodeURIComponent(today.toISOString().slice(0, 10))}&date_audience=lte.${encodeURIComponent(nextWeek.toISOString().slice(0, 10))}${agencyFilterQuery('instance_juridique.procedure.dossier.agence')}&limit=1`,
  );

  const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const pendingDocuments = await requestNeonCount(
    `/document?select=id,dossier!inner(id,agence!inner(id))&or=(date_creation.is.null,date_creation.gte.${encodeURIComponent(threshold)})${agencyFilterQuery('dossier.agence')}&limit=1`,
  );

  return [
    {
      code: 'active-dossiers',
      label: 'Dossiers actifs',
      value: String(activeDossiers),
      trend: 'Hors statuts Clos/Cloture',
      trendUp: true,
    },
    {
      code: 'delayed-procedures',
      label: 'Procedures en retard',
      value: String(delayedProcedures),
      trend: 'Ouvertes depuis plus de 14 jours',
      trendUp: false,
    },
    {
      code: 'upcoming-hearings',
      label: 'Audiences sous 7 jours',
      value: String(upcomingHearings),
      trend: 'Date audience entre J0 et J+7',
      trendUp: false,
    },
    {
      code: 'pending-documents',
      label: 'Documents a valider',
      value: String(pendingDocuments),
      trend: 'Sans date ou crees depuis 30 jours',
      trendUp: false,
    },
  ];
}

export async function getDashboardMetrics() {
  if (isNeonDataApiEnabled()) {
    return getDashboardMetricsFromNeon();
  }

  const query = toQueryString(withSessionAgencyFilter({ agence: undefined }));
  return requestJson<DashboardMetric[]>(`/api/dashboard${query}`);
}
