export interface SchemaColumn {
  name: string;
  type: string;
  constraints?: string;
  description?: string;
}

export interface SchemaTable {
  name: string;
  group: string;
  columns: SchemaColumn[];
}

export interface Client {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  agence: string;
  responsable: string;
}

export interface Dossier {
  id: number;
  reference: string;
  clientId?: number | null;
  client: string;
  typeId?: number | null;
  type: string;
  statutId?: number | null;
  statut: string;
  agenceId?: number | null;
  agence: string;
  ouverture: string;
  echeance: string;
  montant: number;
}

export interface ProcedureItem {
  id: number;
  dossierId?: number | null;
  dossierReference: string;
  typeId?: number | null;
  type: string;
  statutId?: number | null;
  statut: string;
  juridiction: string;
  debut: string;
  fin?: string;
}

export interface ProcedureInstance {
  id: number;
  type: string;
  statut: string;
  debut: string;
  fin?: string;
}

export interface DocumentItem {
  id: number;
  type: string;
  dossierReference?: string;
  procedureId?: number;
  auteur: string;
  dateCreation: string;
  statut: string;
}

export interface Collaborateur {
  id: number;
  nom: string;
  prenom: string;
  metier: string;
  email: string;
  actif: boolean;
}

export interface DashboardMetric {
  code: string;
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
}

export interface AudienceItem {
  id: number;
  procedureId?: number | null;
  dossierReference: string;
  dossierType: string;
  procedureType: string;
  procedureStatut: string;
  instanceType: string;
  dateAudience: string;
  commentaire: string;
}

// Types pour les listes de référence
export interface StatutDossier {
  id: number;
  libelle: string;
}

export interface TypeDossier {
  id: number;
  libelle: string;
}

export interface Agence {
  id: number;
  nom: string;
}
