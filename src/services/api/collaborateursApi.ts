import type { AffectationDossier, AffectationProcedure, Collaborateur, Metier, RoleAffectation } from '../../types/domain';
import { requestJson } from './utils';

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
