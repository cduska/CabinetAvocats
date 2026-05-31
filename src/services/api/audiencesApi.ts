import type { AudienceItem } from '../../types/domain';
import {
  getSessionAgency,
  isNeonDataApiEnabled,
  requestNeonRest,
  toQueryString,
  withSessionAgencyFilter,
  requestJson,
} from './utils';

type InstanceNeonAudienceEntry = {
  id?: number | null;
  date_audience?: string | null;
  commentaire?: string | null;
};

type InstanceNeonRow = {
  id: number;
  date_debut?: string | null;
  audience?: InstanceNeonAudienceEntry[] | null;
  type_instance?: { libelle?: string | null } | null;
  procedure?: {
    id?: number | null;
    type_procedure?: { libelle?: string | null } | null;
    statut_procedure?: { libelle?: string | null } | null;
    dossier?: {
      id?: number | null;
      reference?: string | null;
      type_dossier?: { libelle?: string | null } | null;
      agence?: { nom?: string | null; ville?: string | null } | null;
    } | null;
  } | null;
};

function mapInstanceNeonRow(row: InstanceNeonRow): AudienceItem[] {
  const base = {
    procedureId: row.procedure?.id ?? null,
    dossierId: row.procedure?.dossier?.id ?? null,
    dossierReference: row.procedure?.dossier?.reference ?? '',
    dossierType: row.procedure?.dossier?.type_dossier?.libelle ?? 'Non renseigne',
    procedureType: row.procedure?.type_procedure?.libelle ?? 'Non renseigne',
    procedureStatut: row.procedure?.statut_procedure?.libelle ?? 'Non renseigne',
    instanceType: row.type_instance?.libelle ?? 'Instance',
  };

  const audiences = row.audience ?? [];
  if (audiences.length === 0) {
    return [{
      ...base,
      id: row.id,
      dateAudience: row.date_debut ?? '',
      commentaire: '',
    }];
  }

  return audiences.map((aud) => ({
    ...base,
    id: aud.id ?? row.id,
    dateAudience: aud.date_audience ?? '',
    commentaire: aud.commentaire ?? '',
  }));
}

function getInstanceAgency(row: InstanceNeonRow): string {
  return row.procedure?.dossier?.agence?.nom
    || row.procedure?.dossier?.agence?.ville
    || '';
}

function isInUpcoming7d(dateValue?: string | null): boolean {
  if (!dateValue) {
    return false;
  }

  const current = new Date();
  const start = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed >= start && parsed <= end;
}

async function getAudiencesFromNeon(preset?: 'upcoming7d'): Promise<AudienceItem[]> {
  const params = new URLSearchParams();
  params.set('select', 'id,date_debut,audience(id,date_audience,commentaire),type_instance(libelle),procedure(id,type_procedure(libelle),statut_procedure(libelle),dossier(id,reference,type_dossier(libelle),agence(nom,ville)))');
  params.set('order', 'date_debut.asc,id.asc');

  const rows = await requestNeonRest<InstanceNeonRow[]>(`/instance_juridique?${params.toString()}`);
  const agency = String(getSessionAgency() ?? '').trim().toLowerCase();

  return rows
    .filter((row) => (agency ? getInstanceAgency(row).toLowerCase().includes(agency) : true))
    .flatMap(mapInstanceNeonRow)
    .filter((item) => (preset === 'upcoming7d' ? isInUpcoming7d(item.dateAudience) : true));
}

export async function getAudiences(preset?: 'upcoming7d') {
  if (isNeonDataApiEnabled()) {
    return getAudiencesFromNeon(preset);
  }

  const query = toQueryString(withSessionAgencyFilter({
    agence: undefined,
    preset,
  }));

  return requestJson<AudienceItem[]>(`/api/audiences${query}`);
}
