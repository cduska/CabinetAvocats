import type { Collaborateur, Metier } from '../../types/domain';
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
