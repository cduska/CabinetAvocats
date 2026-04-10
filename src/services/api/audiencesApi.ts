import type { AudienceItem } from '../../types/domain';
import {
  getSessionAgency,
  isNeonDataApiEnabled,
  requestNeonRest,
  toQueryString,
  withSessionAgencyFilter,
  requestJson,
} from './utils';

type AudienceNeonRow = {
  id: number;
  date_audience?: string | null;
  commentaire?: string | null;
  instance_juridique?: {
    id?: number | null;
    type_instance?: { libelle?: string | null } | null;
    procedure?: {
      id?: number | null;
      type_procedure?: { libelle?: string | null } | null;
      statut_procedure?: { libelle?: string | null } | null;
      dossier?: {
        reference?: string | null;
        type_dossier?: { libelle?: string | null } | null;
        agence?: { nom?: string | null; ville?: string | null } | null;
      } | null;
    } | null;
  } | null;
};

function mapAudienceRow(row: AudienceNeonRow): AudienceItem {
  return {
    id: row.id,
    procedureId: row.instance_juridique?.procedure?.id ?? null,
    dossierId: row.instance_juridique?.procedure?.dossier?.id ?? null,
    dossierReference: row.instance_juridique?.procedure?.dossier?.reference ?? '',
    dossierType: row.instance_juridique?.procedure?.dossier?.type_dossier?.libelle ?? 'Non renseigne',
    procedureType: row.instance_juridique?.procedure?.type_procedure?.libelle ?? 'Non renseigne',
    procedureStatut: row.instance_juridique?.procedure?.statut_procedure?.libelle ?? 'Non renseigne',
    instanceType: row.instance_juridique?.type_instance?.libelle ?? 'Instance',
    dateAudience: row.date_audience ?? '',
    commentaire: row.commentaire ?? '',
  };
}

function getAudienceAgency(row: AudienceNeonRow): string {
  return row.instance_juridique?.procedure?.dossier?.agence?.nom
    || row.instance_juridique?.procedure?.dossier?.agence?.ville
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
  params.set('select', 'id,date_audience,commentaire,instance_juridique(id,type_instance(libelle),procedure(id,type_procedure(libelle),statut_procedure(libelle),dossier(id,reference,type_dossier(libelle),agence(nom,ville))))');
  params.set('order', 'date_audience.asc,id.asc');

  const rows = await requestNeonRest<AudienceNeonRow[]>(`/audience?${params.toString()}`);
  const agency = String(getSessionAgency() ?? '').trim().toLowerCase();

  const filtered = rows
    .filter((row) => (agency ? getAudienceAgency(row).toLowerCase().includes(agency) : true))
    .filter((row) => (preset === 'upcoming7d' ? isInUpcoming7d(row.date_audience) : true));

  return filtered.map(mapAudienceRow);
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
