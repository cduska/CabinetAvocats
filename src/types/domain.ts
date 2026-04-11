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

export interface ProcedureHistoryItem {
  id: number;
  action: string;
  actor: string;
  at: string;
  details: string;
}

export interface DocumentItem {
  id: number;
  type: string;
  dossierReference?: string;
  procedureId?: number;
  instanceId?: number;
  auteur: string;
  dateCreation: string;
  statut: string;
  modeleId?: number;
  modeleVersion?: number;
}

export interface ModeleDocumentItem {
  id: number;
  typeDocumentId: number;
  typeDocumentLabel: string;
  nomModele: string;
  description: string;
  latestVersion: number;
  latestVersionCreatedAt: string;
  published: boolean;
}

export interface ModeleDocumentDetail {
  id: number;
  typeDocumentId: number;
  typeDocumentLabel: string;
  nomModele: string;
  description: string;
  contenuJson: Record<string, unknown>;
  sousDomaines: number[];
  paragraphes: Array<{ id: number; ordre: number; contenu: string }>;
  latestVersion?: ModeleDocumentVersion | null;
}

export interface ModeleDocumentVersion {
  id: number;
  modeleId: number;
  numeroVersion: number;
  contenuJson: Record<string, unknown>;
  creeLe: string;
  creePar?: number | null;
}

export interface Collaborateur {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  agenceId: number | null;
  agenceNom: string;
  metierId: number | null;
  metierLabel: string;
  dateEntree: string | null;
  actif: boolean;
}

export interface Metier {
  id: number;
  libelle: string;
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
  dossierId?: number | null;
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

export interface TypeProcedure {
  id: number;
  libelle: string;
}

export interface TypeDocument {
  id: number;
  libelle: string;
}

export interface TypeInstance {
  id: number;
  libelle: string;
}

export interface StatutInstance {
  id: number;
  libelle: string;
}

export interface Agence {
  id: number;
  nom: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
}

export interface RefItem {
  id: number;
  libelle: string;
}
