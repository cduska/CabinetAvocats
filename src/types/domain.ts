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
  client: string;
  type: string;
  statut: string;
  agence: string;
  ouverture: string;
  echeance: string;
  montant: number;
}

export interface ProcedureItem {
  id: number;
  dossierReference: string;
  type: string;
  statut: string;
  juridiction: string;
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
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
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
