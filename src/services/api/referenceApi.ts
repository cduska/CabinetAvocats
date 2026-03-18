import type { Agence, TypeDossier, StatutDossier } from '../../types/domain';
import { requestJson } from './utils';

export async function getStatutsDossier() {
  return requestJson<StatutDossier[]>('/api/statut_dossier');
}

export async function getTypesDossier() {
  return requestJson<TypeDossier[]>('/api/type_dossier');
}

export async function getAgences() {
  return requestJson<Agence[]>('/api/agence');
}
