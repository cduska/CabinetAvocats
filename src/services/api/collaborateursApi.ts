import type { AffectationDossier, AffectationProcedure, Collaborateur, Metier, RoleAffectation } from '../../types/domain';
import { isNeonDataApiEnabled, requestJson, requestNeonRest } from './utils';

// ─── Neon row types ───────────────────────────────────────────────────────────

type NeonCollaborateurRow = {
  id: number;
  nom?: string | null;
  prenom?: string | null;
  email?: string | null;
  telephone?: string | null;
  id_agence?: number | null;
  id_metier?: number | null;
  date_entree?: string | null;
  actif?: boolean | null;
  agence?: { nom?: string | null } | null;
  metier?: { libelle?: string | null } | null;
};

type NeonAffectationDossierRow = {
  id: number;
  id_dossier?: number | null;
  id_role?: number | null;
  date_debut?: string | null;
  date_fin?: string | null;
  dossier?: { id?: number | null; reference?: string | null; client?: { prenom?: string | null; nom?: string | null } | null } | null;
  role_affectation?: { id?: number | null; libelle?: string | null } | null;
};

type NeonAffectationProcedureRow = {
  id: number;
  id_procedure?: number | null;
  id_role?: number | null;
  date_debut?: string | null;
  date_fin?: string | null;
  procedure?: { id?: number | null; type_procedure?: { libelle?: string | null } | null; dossier?: { reference?: string | null } | null } | null;
  role_affectation?: { id?: number | null; libelle?: string | null } | null;
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapCollaborateur(row: NeonCollaborateurRow): Collaborateur {
  return {
    id: row.id,
    nom: row.nom ?? '',
    prenom: row.prenom ?? '',
    email: row.email ?? '',
    telephone: row.telephone ?? '',
    agenceId: row.id_agence ?? null,
    agenceNom: row.agence?.nom ?? '',
    metierId: row.id_metier ?? null,
    metierLabel: row.metier?.libelle ?? '',
    dateEntree: row.date_entree ?? null,
    actif: row.actif ?? true,
  };
}

function mapAffectationDossier(row: NeonAffectationDossierRow): AffectationDossier {
  const client = row.dossier?.client;
  const clientName = [client?.prenom ?? '', client?.nom ?? ''].join(' ').trim();
  return {
    id: row.id,
    dossierId: row.dossier?.id ?? row.id_dossier ?? 0,
    dossierReference: row.dossier?.reference ?? '',
    dossierClient: clientName,
    roleId: row.role_affectation?.id ?? row.id_role ?? null,
    roleLibelle: row.role_affectation?.libelle ?? '',
    dateDebut: row.date_debut ?? null,
    dateFin: row.date_fin ?? null,
  };
}

function mapAffectationProcedure(row: NeonAffectationProcedureRow): AffectationProcedure {
  return {
    id: row.id,
    procedureId: row.procedure?.id ?? row.id_procedure ?? 0,
    procedureType: row.procedure?.type_procedure?.libelle ?? '',
    dossierReference: row.procedure?.dossier?.reference ?? '',
    roleId: row.role_affectation?.id ?? row.id_role ?? null,
    roleLibelle: row.role_affectation?.libelle ?? '',
    dateDebut: row.date_debut ?? null,
    dateFin: row.date_fin ?? null,
  };
}

// ─── Neon implementations ─────────────────────────────────────────────────────

const COLLAB_SELECT = 'id,nom,prenom,email,telephone,id_agence,id_metier,date_entree,actif,agence(nom),metier(libelle)';

async function getCollaborateursFromNeon(): Promise<Collaborateur[]> {
  const rows = await requestNeonRest<NeonCollaborateurRow[]>(
    `/collaborateur?select=${COLLAB_SELECT}&order=nom.asc.nullslast,prenom.asc.nullslast`,
  );
  return rows.map(mapCollaborateur);
}

async function getCollaborateurByIdFromNeon(id: number): Promise<Collaborateur> {
  const rows = await requestNeonRest<NeonCollaborateurRow[]>(
    `/collaborateur?select=${COLLAB_SELECT}&id=eq.${id}&limit=1`,
  );
  const row = rows[0];
  if (!row) throw new Error('Collaborateur introuvable.');
  return mapCollaborateur(row);
}

async function getMetiersFromNeon(): Promise<Metier[]> {
  return requestNeonRest<Metier[]>('/metier?select=id,libelle&order=libelle.asc');
}

async function getRoleAffectationsFromNeon(): Promise<RoleAffectation[]> {
  return requestNeonRest<RoleAffectation[]>('/role_affectation?select=id,libelle&order=libelle.asc');
}

async function getAffectationsFromNeon(collaborateurId: number): Promise<{ dossiers: AffectationDossier[]; procedures: AffectationProcedure[] }> {
  const [dossierRows, procedureRows] = await Promise.all([
    requestNeonRest<NeonAffectationDossierRow[]>(
      `/affectation_dossier?select=id,id_dossier,id_role,date_debut,date_fin,dossier(id,reference,client(prenom,nom)),role_affectation(id,libelle)&id_collaborateur=eq.${collaborateurId}&order=date_debut.desc.nullslast`,
    ),
    requestNeonRest<NeonAffectationProcedureRow[]>(
      `/affectation_procedure?select=id,id_procedure,id_role,date_debut,date_fin,procedure(id,type_procedure(libelle),dossier(reference)),role_affectation(id,libelle)&id_collaborateur=eq.${collaborateurId}&order=date_debut.desc.nullslast`,
    ),
  ]);
  return {
    dossiers: dossierRows.map(mapAffectationDossier),
    procedures: procedureRows.map(mapAffectationProcedure),
  };
}

// =========================================================
// Métiers
// =========================================================

export async function getMetiers(): Promise<Metier[]> {
  if (isNeonDataApiEnabled()) {
    return getMetiersFromNeon();
  }
  return requestJson<Metier[]>('/api/metier');
}

export async function createMetier(libelle: string): Promise<Metier> {
  if (isNeonDataApiEnabled()) {
    const rows = await requestNeonRest<Metier[]>('/metier', {
      method: 'POST',
      body: JSON.stringify({ libelle }),
      headers: { Prefer: 'return=representation,resolution=header-or-ignore' },
    });
    if (!rows[0]) throw new TypeError('Erreur lors de la création du métier.');
    return rows[0];
  }
  return requestJson<Metier>('/api/metier', {
    method: 'POST',
    body: JSON.stringify({ libelle }),
  });
}

export async function updateMetier(id: number, libelle: string): Promise<Metier> {
  if (isNeonDataApiEnabled()) {
    await requestNeonRest(`/metier?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ libelle }),
      headers: { Prefer: 'return=minimal' },
    });
    const rows = await requestNeonRest<Metier[]>(`/metier?select=id,libelle&id=eq.${id}&limit=1`);
    if (!rows[0]) throw new Error('Métier introuvable.');
    return rows[0];
  }
  return requestJson<Metier>(`/api/metier/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ libelle }),
  });
}

export async function deleteMetier(id: number): Promise<void> {
  if (isNeonDataApiEnabled()) {
    await requestNeonRest(`/metier?id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    return;
  }
  await requestJson<void>(`/api/metier/${id}`, { method: 'DELETE' });
}

// =========================================================
// Collaborateurs
// =========================================================

export async function getCollaborateurs(): Promise<Collaborateur[]> {
  if (isNeonDataApiEnabled()) {
    return getCollaborateursFromNeon();
  }
  return requestJson<Collaborateur[]>('/api/collaborateur');
}

export interface CollaborateurPayload {
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  agenceId?: number | null;
  metierId?: number | null;
  dateEntree?: string | null;
  actif?: boolean;
}

export async function createCollaborateur(payload: CollaborateurPayload): Promise<Collaborateur> {
  if (isNeonDataApiEnabled()) {
    const rows = await requestNeonRest<Array<{ id: number }>>('/collaborateur', {
      method: 'POST',
      body: JSON.stringify({
        nom: payload.nom,
        prenom: payload.prenom || null,
        email: payload.email || null,
        telephone: payload.telephone || null,
        id_agence: payload.agenceId ?? null,
        id_metier: payload.metierId ?? null,
        date_entree: payload.dateEntree || null,
        actif: payload.actif ?? true,
      }),
      headers: { Prefer: 'return=representation,resolution=header-or-ignore' },
    });
    const newId = rows[0]?.id;
    if (!Number.isFinite(newId)) throw new TypeError('Erreur lors de la création du collaborateur.');
    return getCollaborateurByIdFromNeon(newId);
  }
  return requestJson<Collaborateur>('/api/collaborateur', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCollaborateur(id: number, payload: CollaborateurPayload): Promise<Collaborateur> {
  if (isNeonDataApiEnabled()) {
    await requestNeonRest(`/collaborateur?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        nom: payload.nom,
        prenom: payload.prenom || null,
        email: payload.email || null,
        telephone: payload.telephone || null,
        id_agence: payload.agenceId ?? null,
        id_metier: payload.metierId ?? null,
        date_entree: payload.dateEntree || null,
        actif: payload.actif ?? true,
      }),
      headers: { Prefer: 'return=minimal' },
    });
    return getCollaborateurByIdFromNeon(id);
  }
  return requestJson<Collaborateur>(`/api/collaborateur/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteCollaborateur(id: number): Promise<void> {
  if (isNeonDataApiEnabled()) {
    await requestNeonRest(`/collaborateur?id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    return;
  }
  await requestJson<void>(`/api/collaborateur/${id}`, { method: 'DELETE' });
}

// =========================================================
// Rôles d'affectation
// =========================================================

export async function getRoleAffectations(): Promise<RoleAffectation[]> {
  if (isNeonDataApiEnabled()) {
    return getRoleAffectationsFromNeon();
  }
  return requestJson<RoleAffectation[]>('/api/role-affectation');
}

// =========================================================
// Affectations d'un collaborateur
// =========================================================

export interface CollaborateurAffectations {
  dossiers: AffectationDossier[];
  procedures: AffectationProcedure[];
}

export async function getAffectations(collaborateurId: number): Promise<CollaborateurAffectations> {
  if (isNeonDataApiEnabled()) {
    return getAffectationsFromNeon(collaborateurId);
  }
  return requestJson<CollaborateurAffectations>(`/api/collaborateur/${collaborateurId}/affectations`);
}

export interface AffectationDossierPayload {
  dossierId: number;
  roleId?: number | null;
  dateDebut?: string | null;
  dateFin?: string | null;
}

export async function addAffectationDossier(
  collaborateurId: number,
  payload: AffectationDossierPayload,
): Promise<AffectationDossier> {
  if (isNeonDataApiEnabled()) {
    const rows = await requestNeonRest<Array<{ id: number }>>('/affectation_dossier', {
      method: 'POST',
      body: JSON.stringify({
        id_collaborateur: collaborateurId,
        id_dossier: payload.dossierId,
        id_role: payload.roleId ?? null,
        date_debut: payload.dateDebut || null,
        date_fin: payload.dateFin || null,
      }),
      headers: { Prefer: 'return=representation,resolution=header-or-ignore' },
    });
    const newId = rows[0]?.id;
    if (!Number.isFinite(newId)) throw new TypeError('Erreur lors de la création de l\'affectation.');
    const detail = await requestNeonRest<NeonAffectationDossierRow[]>(
      `/affectation_dossier?select=id,id_dossier,id_role,date_debut,date_fin,dossier(id,reference,client(prenom,nom)),role_affectation(id,libelle)&id=eq.${newId}&limit=1`,
    );
    if (!detail[0]) throw new Error('Affectation introuvable après création.');
    return mapAffectationDossier(detail[0]);
  }
  return requestJson<AffectationDossier>(`/api/collaborateur/${collaborateurId}/affectation-dossier`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeAffectationDossier(affectId: number): Promise<void> {
  if (isNeonDataApiEnabled()) {
    await requestNeonRest(`/affectation_dossier?id=eq.${affectId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    return;
  }
  await requestJson<void>(`/api/affectation-dossier/${affectId}`, { method: 'DELETE' });
}

export interface AffectationProcedurePayload {
  procedureId: number;
  roleId?: number | null;
  dateDebut?: string | null;
  dateFin?: string | null;
}

export async function addAffectationProcedure(
  collaborateurId: number,
  payload: AffectationProcedurePayload,
): Promise<AffectationProcedure> {
  if (isNeonDataApiEnabled()) {
    const rows = await requestNeonRest<Array<{ id: number }>>('/affectation_procedure', {
      method: 'POST',
      body: JSON.stringify({
        id_collaborateur: collaborateurId,
        id_procedure: payload.procedureId,
        id_role: payload.roleId ?? null,
        date_debut: payload.dateDebut || null,
        date_fin: payload.dateFin || null,
      }),
      headers: { Prefer: 'return=representation,resolution=header-or-ignore' },
    });
    const newId = rows[0]?.id;
    if (!Number.isFinite(newId)) throw new TypeError('Erreur lors de la création de l\'affectation.');
    const detail = await requestNeonRest<NeonAffectationProcedureRow[]>(
      `/affectation_procedure?select=id,id_procedure,id_role,date_debut,date_fin,procedure(id,type_procedure(libelle),dossier(reference)),role_affectation(id,libelle)&id=eq.${newId}&limit=1`,
    );
    if (!detail[0]) throw new Error('Affectation introuvable après création.');
    return mapAffectationProcedure(detail[0]);
  }
  return requestJson<AffectationProcedure>(`/api/collaborateur/${collaborateurId}/affectation-procedure`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeAffectationProcedure(affectId: number): Promise<void> {
  if (isNeonDataApiEnabled()) {
    await requestNeonRest(`/affectation_procedure?id=eq.${affectId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    return;
  }
  await requestJson<void>(`/api/affectation-procedure/${affectId}`, { method: 'DELETE' });
}


// =========================================================
// Métiers
// =========================================================

export async function getMetiers(): Promise<Metier[]> {
  return requestJson<Metier[]>('/api/metier');
}

export async function createMetier(libelle: string): Promise<Metier> {
  return requestJson<Metier>('/api/metier', {
    method: 'POST',
    body: JSON.stringify({ libelle }),
  });
}

export async function updateMetier(id: number, libelle: string): Promise<Metier> {
  return requestJson<Metier>(`/api/metier/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ libelle }),
  });
}

export async function deleteMetier(id: number): Promise<void> {
  await requestJson<void>(`/api/metier/${id}`, { method: 'DELETE' });
}

// =========================================================
// Collaborateurs
// =========================================================

export async function getCollaborateurs(): Promise<Collaborateur[]> {
  return requestJson<Collaborateur[]>('/api/collaborateur');
}

export interface CollaborateurPayload {
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  agenceId?: number | null;
  metierId?: number | null;
  dateEntree?: string | null;
  actif?: boolean;
}

export async function createCollaborateur(payload: CollaborateurPayload): Promise<Collaborateur> {
  return requestJson<Collaborateur>('/api/collaborateur', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCollaborateur(id: number, payload: CollaborateurPayload): Promise<Collaborateur> {
  return requestJson<Collaborateur>(`/api/collaborateur/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteCollaborateur(id: number): Promise<void> {
  await requestJson<void>(`/api/collaborateur/${id}`, { method: 'DELETE' });
}

// =========================================================
// Rôles d'affectation
// =========================================================

export async function getRoleAffectations(): Promise<RoleAffectation[]> {
  return requestJson<RoleAffectation[]>('/api/role-affectation');
}

// =========================================================
// Affectations d'un collaborateur
// =========================================================

export interface CollaborateurAffectations {
  dossiers: AffectationDossier[];
  procedures: AffectationProcedure[];
}

export async function getAffectations(collaborateurId: number): Promise<CollaborateurAffectations> {
  return requestJson<CollaborateurAffectations>(`/api/collaborateur/${collaborateurId}/affectations`);
}

export interface AffectationDossierPayload {
  dossierId: number;
  roleId?: number | null;
  dateDebut?: string | null;
  dateFin?: string | null;
}

export async function addAffectationDossier(
  collaborateurId: number,
  payload: AffectationDossierPayload,
): Promise<AffectationDossier> {
  return requestJson<AffectationDossier>(`/api/collaborateur/${collaborateurId}/affectation-dossier`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeAffectationDossier(affectId: number): Promise<void> {
  await requestJson<void>(`/api/affectation-dossier/${affectId}`, { method: 'DELETE' });
}

export interface AffectationProcedurePayload {
  procedureId: number;
  roleId?: number | null;
  dateDebut?: string | null;
  dateFin?: string | null;
}

export async function addAffectationProcedure(
  collaborateurId: number,
  payload: AffectationProcedurePayload,
): Promise<AffectationProcedure> {
  return requestJson<AffectationProcedure>(`/api/collaborateur/${collaborateurId}/affectation-procedure`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeAffectationProcedure(affectId: number): Promise<void> {
  await requestJson<void>(`/api/affectation-procedure/${affectId}`, { method: 'DELETE' });
}
