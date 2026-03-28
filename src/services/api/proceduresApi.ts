import type { ProcedureHistoryItem, ProcedureItem, ProcedureInstance } from '../../types/domain';
import {
  isNeonDataApiEnabled,
  requestNeonRest,
  toQueryString,
  withSessionAgencyFilter,
  requestJson,
} from './utils';

type ProcedureNested = {
  id: number;
  reference?: string | null;
  type_procedure?: { libelle?: string | null } | null;
  statut_procedure?: { libelle?: string | null } | null;
  date_debut?: string | null;
  date_fin?: string | null;
  dossier?: { id?: number | null; reference?: string | null } | null;
};

type InstanceNested = {
  id: number;
  id_procedure?: number | null;
  date_debut?: string | null;
  date_fin?: string | null;
  type_instance?: { libelle?: string | null } | null;
  statut_instance?: { libelle?: string | null } | null;
};

type ProcedureHistoryRow = {
  id: number;
  description?: string | null;
  date_modification?: string | null;
  collaborateur?: { prenom?: string | null; nom?: string | null } | null;
};

async function getTypeProcedureId(label: string): Promise<number> {
  const rows = await requestNeonRest<Array<{ id: number }>>(`/type_procedure?select=id&libelle=eq.${encodeURIComponent(label)}&limit=1`);
  const id = rows[0]?.id;
  if (!Number.isFinite(id)) {
    throw new Error(`Type de procedure introuvable: ${label}`);
  }
  return id;
}

async function getStatutProcedureId(label: string): Promise<number> {
  const rows = await requestNeonRest<Array<{ id: number }>>(`/statut_procedure?select=id&libelle=eq.${encodeURIComponent(label)}&limit=1`);
  const id = rows[0]?.id;
  if (!Number.isFinite(id)) {
    throw new Error(`Statut de procedure introuvable: ${label}`);
  }
  return id;
}

async function getTypeInstanceId(label: string): Promise<number> {
  const rows = await requestNeonRest<Array<{ id: number }>>(`/type_instance?select=id&libelle=eq.${encodeURIComponent(label)}&limit=1`);
  const id = rows[0]?.id;
  if (!Number.isFinite(id)) {
    throw new Error(`Type d'instance introuvable: ${label}`);
  }
  return id;
}

async function getStatutInstanceId(label: string): Promise<number> {
  const rows = await requestNeonRest<Array<{ id: number }>>(`/statut_instance?select=id&libelle=eq.${encodeURIComponent(label)}&limit=1`);
  const id = rows[0]?.id;
  if (!Number.isFinite(id)) {
    throw new Error(`Statut d'instance introuvable: ${label}`);
  }
  return id;
}

function mapProcedure(row: ProcedureNested, juridiction = 'Non renseignee'): ProcedureItem {
  return {
    id: row.id,
    dossierId: row.dossier?.id ?? null,
    dossierReference: row.dossier?.reference ?? row.reference ?? '',
    type: row.type_procedure?.libelle ?? 'Non renseigne',
    statut: row.statut_procedure?.libelle ?? 'Non renseigne',
    juridiction,
    debut: row.date_debut ?? '',
    fin: row.date_fin ?? '',
  };
}

function mapInstance(row: InstanceNested): ProcedureInstance {
  return {
    id: row.id,
    type: row.type_instance?.libelle ?? 'Instance',
    statut: row.statut_instance?.libelle ?? 'Non renseigne',
    debut: row.date_debut ?? '',
    fin: row.date_fin ?? '',
  };
}

async function getProcedureJuridiction(procedureId: number): Promise<string> {
  const instances = await requestNeonRest<InstanceNested[]>(
    `/instance_juridique?select=id,date_debut,type_instance(libelle)&id_procedure=eq.${procedureId}&order=date_debut.desc.nullslast,id.desc&limit=1`,
  );
  return instances[0]?.type_instance?.libelle ?? 'Non renseignee';
}

async function getProceduresFromNeon(): Promise<ProcedureItem[]> {
  const rows = await requestNeonRest<ProcedureNested[]>(
    '/procedure?select=id,date_debut,date_fin,dossier(id,reference),type_procedure(libelle),statut_procedure(libelle)&order=id.desc',
  );

  const mapped = await Promise.all(rows.map(async (row) => mapProcedure(row, await getProcedureJuridiction(row.id))));
  return mapped;
}

async function getProcedureByIdFromNeon(id: number): Promise<ProcedureItem> {
  const rows = await requestNeonRest<ProcedureNested[]>(
    `/procedure?select=id,date_debut,date_fin,dossier(id,reference),type_procedure(libelle),statut_procedure(libelle)&id=eq.${id}&limit=1`,
  );
  const row = rows[0];
  if (!row) {
    throw new Error('Procedure introuvable.');
  }

  const juridiction = await getProcedureJuridiction(id);
  return mapProcedure(row, juridiction);
}

async function getProcedureInstancesFromNeon(id: number): Promise<ProcedureInstance[]> {
  const rows = await requestNeonRest<InstanceNested[]>(
    `/instance_juridique?select=id,id_procedure,date_debut,date_fin,type_instance(libelle),statut_instance(libelle)&id_procedure=eq.${id}&order=id.asc`,
  );

  return rows.map(mapInstance);
}

async function getProcedureHistoryFromNeon(id: number): Promise<ProcedureHistoryItem[]> {
  const rows = await requestNeonRest<ProcedureHistoryRow[]>(
    `/historique_procedure?select=id,date_modification,description,collaborateur(prenom,nom)&id_procedure=eq.${id}&order=date_modification.desc.nullslast,id.desc`,
  );

  return rows.map((row) => ({
    id: row.id,
    action: row.description?.trim() || 'Modification de la procedure',
    actor: [row.collaborateur?.prenom ?? '', row.collaborateur?.nom ?? ''].join(' ').trim() || 'Systeme API Cabinet',
    at: row.date_modification ?? '',
    details: row.description?.trim() || 'Aucun detail fourni',
  }));
}

export async function getProcedures() {
  if (isNeonDataApiEnabled()) {
    return getProceduresFromNeon();
  }

  const query = toQueryString(withSessionAgencyFilter({ agence: undefined }));
  return requestJson<ProcedureItem[]>(`/api/procedures${query}`);
}

export async function getProcedureById(id: number) {
  if (isNeonDataApiEnabled()) {
    return getProcedureByIdFromNeon(id);
  }

  return requestJson<ProcedureItem>(`/api/procedures/${id}`);
}

export async function getProcedureInstances(id: number) {
  if (isNeonDataApiEnabled()) {
    return getProcedureInstancesFromNeon(id);
  }

  return requestJson<ProcedureInstance[]>(`/api/procedures/${id}/instances`);
}

export async function getProcedureHistory(id: number) {
  if (isNeonDataApiEnabled()) {
    return getProcedureHistoryFromNeon(id);
  }

  return requestJson<ProcedureHistoryItem[]>(`/api/procedures/${id}/history`);
}

export async function updateProcedure(id: number, payload: {
  type: string;
  statut: string;
  debut: string;
  fin: string;
}) {
  if (isNeonDataApiEnabled()) {
    const [typeId, statutId] = await Promise.all([
      getTypeProcedureId(payload.type),
      getStatutProcedureId(payload.statut),
    ]);

    await requestNeonRest(`/procedure?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        id_type_procedure: typeId,
        id_statut_procedure: statutId,
        date_debut: payload.debut || null,
        date_fin: payload.fin || null,
      }),
      headers: {
        Prefer: 'return=minimal',
      },
    });

    return getProcedureByIdFromNeon(id);
  }

  return requestJson<ProcedureItem>(`/api/procedures/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updateProcedureInstance(id: number, payload: {
  type: string;
  statut: string;
  debut: string;
  fin: string;
}) {
  if (isNeonDataApiEnabled()) {
    const [typeId, statutId] = await Promise.all([
      getTypeInstanceId(payload.type),
      getStatutInstanceId(payload.statut),
    ]);

    await requestNeonRest(`/instance_juridique?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        id_type_instance: typeId,
        id_statut_instance: statutId,
        date_debut: payload.debut || null,
        date_fin: payload.fin || null,
      }),
      headers: {
        Prefer: 'return=minimal',
      },
    });

    const rows = await requestNeonRest<InstanceNested[]>(
      `/instance_juridique?select=id,id_procedure,date_debut,date_fin,type_instance(libelle),statut_instance(libelle)&id=eq.${id}&limit=1`,
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Instance introuvable.');
    }
    return mapInstance(row);
  }

  return requestJson<ProcedureInstance>(`/api/instances/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
