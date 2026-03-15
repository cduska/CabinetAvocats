import type { SchemaTable } from '../types/domain';

export const schemaTables: SchemaTable[] = [
  {
    name: 'agence',
    group: 'Agences & Profils',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'nom', type: 'VARCHAR(150)', constraints: 'NOT NULL', description: 'Nom de agence' },
      { name: 'adresse', type: 'VARCHAR(255)', description: 'Adresse' },
      { name: 'ville', type: 'VARCHAR(100)', description: 'Ville' },
      { name: 'code_postal', type: 'VARCHAR(20)', description: 'Code postal' },
    ],
  },
  {
    name: 'profil',
    group: 'Agences & Profils',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Profil applicatif' },
    ],
  },
  {
    name: 'collaborateur_profil',
    group: 'Agences & Profils',
    columns: [
      { name: 'id_collaborateur', type: 'INT', constraints: 'PK, FK', description: 'Collaborateur' },
      { name: 'id_profil', type: 'INT', constraints: 'PK, FK', description: 'Profil' },
    ],
  },
  {
    name: 'metier',
    group: 'Collaborateurs',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Metier' },
    ],
  },
  {
    name: 'collaborateur',
    group: 'Collaborateurs',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_agence', type: 'INT', constraints: 'FK', description: 'Agence' },
      { name: 'id_metier', type: 'INT', constraints: 'FK', description: 'Metier' },
      { name: 'nom', type: 'VARCHAR(100)', description: 'Nom' },
      { name: 'prenom', type: 'VARCHAR(100)', description: 'Prenom' },
      { name: 'email', type: 'VARCHAR(150)', description: 'Email' },
      { name: 'telephone', type: 'VARCHAR(50)', description: 'Telephone' },
      { name: 'date_entree', type: 'DATE', description: 'Date entree' },
      { name: 'actif', type: 'BOOLEAN', constraints: 'DEFAULT TRUE', description: 'Actif' },
    ],
  },
  {
    name: 'equipe',
    group: 'Collaborateurs',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'nom_equipe', type: 'VARCHAR(100)', description: 'Nom equipe' },
      { name: 'description', type: 'TEXT', description: 'Description' },
    ],
  },
  {
    name: 'collaborateur_equipe',
    group: 'Collaborateurs',
    columns: [
      { name: 'id_collaborateur', type: 'INT', constraints: 'PK, FK', description: 'Collaborateur' },
      { name: 'id_equipe', type: 'INT', constraints: 'PK, FK', description: 'Equipe' },
    ],
  },
  {
    name: 'domaine_juridique',
    group: 'Collaborateurs',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'libelle', type: 'VARCHAR(150)', constraints: 'NOT NULL', description: 'Domaine' },
    ],
  },
  {
    name: 'sous_domaine',
    group: 'Collaborateurs',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_domaine', type: 'INT', constraints: 'FK', description: 'Domaine' },
      { name: 'libelle', type: 'VARCHAR(150)', constraints: 'NOT NULL', description: 'Sous domaine' },
    ],
  },
  {
    name: 'specialite',
    group: 'Collaborateurs',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_sous_domaine', type: 'INT', constraints: 'FK', description: 'Sous domaine' },
      { name: 'libelle', type: 'VARCHAR(150)', constraints: 'NOT NULL', description: 'Specialite' },
    ],
  },
  {
    name: 'collaborateur_specialite',
    group: 'Collaborateurs',
    columns: [
      { name: 'id_collaborateur', type: 'INT', constraints: 'PK, FK', description: 'Collaborateur' },
      { name: 'id_specialite', type: 'INT', constraints: 'PK, FK', description: 'Specialite' },
    ],
  },
  {
    name: 'client',
    group: 'Clients',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_agence', type: 'INT', constraints: 'FK', description: 'Agence' },
      { name: 'id_collaborateur_responsable', type: 'INT', constraints: 'FK', description: 'Referent' },
      { name: 'nom', type: 'VARCHAR(100)', description: 'Nom' },
      { name: 'prenom', type: 'VARCHAR(100)', description: 'Prenom' },
      { name: 'email', type: 'VARCHAR(150)', description: 'Email' },
      { name: 'telephone', type: 'VARCHAR(50)', description: 'Telephone' },
    ],
  },
  {
    name: 'type_dossier',
    group: 'Dossiers',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Type' },
    ],
  },
  {
    name: 'statut_dossier',
    group: 'Dossiers',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Statut' },
    ],
  },
  {
    name: 'dossier',
    group: 'Dossiers',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_agence', type: 'INT', constraints: 'FK', description: 'Agence' },
      { name: 'id_client', type: 'INT', constraints: 'FK', description: 'Client' },
      { name: 'id_type_dossier', type: 'INT', constraints: 'FK', description: 'Type' },
      { name: 'id_statut_dossier', type: 'INT', constraints: 'FK', description: 'Statut' },
      { name: 'reference', type: 'VARCHAR(100)', description: 'Reference' },
      { name: 'date_ouverture', type: 'DATE', description: 'Ouverture' },
      { name: 'date_cloture', type: 'DATE', description: 'Cloture' },
    ],
  },
  {
    name: 'historique_dossier',
    group: 'Dossiers',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_dossier', type: 'INT', constraints: 'FK', description: 'Dossier' },
      { name: 'auteur', type: 'INT', constraints: 'FK', description: 'Auteur' },
      { name: 'date_modification', type: 'TIMESTAMP', description: 'Date modification' },
      { name: 'description', type: 'TEXT', description: 'Description' },
    ],
  },
  {
    name: 'facture',
    group: 'Dossiers',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_dossier', type: 'INT', constraints: 'FK', description: 'Dossier' },
      { name: 'montant', type: 'NUMERIC(10,2)', description: 'Montant' },
      { name: 'date_emission', type: 'DATE', description: 'Date emission' },
      { name: 'statut', type: 'VARCHAR(50)', description: 'Statut' },
    ],
  },
  {
    name: 'type_procedure',
    group: 'Procedures & Instances',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Type' },
    ],
  },
  {
    name: 'statut_procedure',
    group: 'Procedures & Instances',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Statut' },
    ],
  },
  {
    name: 'procedure',
    group: 'Procedures & Instances',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_dossier', type: 'INT', constraints: 'FK', description: 'Dossier' },
      { name: 'id_type_procedure', type: 'INT', constraints: 'FK', description: 'Type' },
      { name: 'id_statut_procedure', type: 'INT', constraints: 'FK', description: 'Statut' },
      { name: 'date_debut', type: 'DATE', description: 'Date debut' },
      { name: 'date_fin', type: 'DATE', description: 'Date fin' },
    ],
  },
  {
    name: 'historique_procedure',
    group: 'Procedures & Instances',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_procedure', type: 'INT', constraints: 'FK', description: 'Procedure' },
      { name: 'auteur', type: 'INT', constraints: 'FK', description: 'Auteur' },
      { name: 'date_modification', type: 'TIMESTAMP', description: 'Date modification' },
      { name: 'description', type: 'TEXT', description: 'Description' },
    ],
  },
  {
    name: 'type_instance',
    group: 'Procedures & Instances',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Type' },
    ],
  },
  {
    name: 'statut_instance',
    group: 'Procedures & Instances',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Statut' },
    ],
  },
  {
    name: 'instance_juridique',
    group: 'Procedures & Instances',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_procedure', type: 'INT', constraints: 'FK', description: 'Procedure' },
      { name: 'id_type_instance', type: 'INT', constraints: 'FK', description: 'Type' },
      { name: 'id_statut_instance', type: 'INT', constraints: 'FK', description: 'Statut' },
      { name: 'date_debut', type: 'DATE', description: 'Date debut' },
      { name: 'date_fin', type: 'DATE', description: 'Date fin' },
    ],
  },
  {
    name: 'historique_instance',
    group: 'Procedures & Instances',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_instance', type: 'INT', constraints: 'FK', description: 'Instance' },
      { name: 'auteur', type: 'INT', constraints: 'FK', description: 'Auteur' },
      { name: 'date_modification', type: 'TIMESTAMP', description: 'Date modification' },
      { name: 'description', type: 'TEXT', description: 'Description' },
    ],
  },
  {
    name: 'audience',
    group: 'Procedures & Instances',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_instance', type: 'INT', constraints: 'FK', description: 'Instance' },
      { name: 'date_audience', type: 'DATE', description: 'Date audience' },
      { name: 'commentaire', type: 'TEXT', description: 'Commentaire' },
    ],
  },
  {
    name: 'type_document',
    group: 'Documents',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Type document' },
    ],
  },
  {
    name: 'document',
    group: 'Documents',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_type_document', type: 'INT', constraints: 'FK', description: 'Type document' },
      { name: 'id_dossier', type: 'INT', constraints: 'FK', description: 'Dossier' },
      { name: 'id_procedure', type: 'INT', constraints: 'FK', description: 'Procedure' },
      { name: 'id_instance', type: 'INT', constraints: 'FK', description: 'Instance' },
      { name: 'auteur', type: 'INT', constraints: 'FK', description: 'Auteur' },
      { name: 'chemin_fichier', type: 'TEXT', description: 'Chemin fichier' },
      { name: 'date_creation', type: 'TIMESTAMP', description: 'Date creation' },
    ],
  },
  {
    name: 'modele_document',
    group: 'Documents',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_type_document', type: 'INT', constraints: 'FK', description: 'Type document' },
      { name: 'nom_modele', type: 'VARCHAR(150)', description: 'Nom modele' },
      { name: 'description', type: 'TEXT', description: 'Description' },
      { name: 'contenu_json', type: 'JSONB', constraints: 'CHECK JSON', description: 'Contenu JSON' },
    ],
  },
  {
    name: 'modele_document_version',
    group: 'Documents',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_modele', type: 'INT', constraints: 'FK', description: 'Modele' },
      { name: 'numero_version', type: 'INT', constraints: 'UNIQUE(id_modele, numero_version)', description: 'Version' },
      { name: 'contenu_json', type: 'JSONB', constraints: 'NOT NULL', description: 'Contenu JSON' },
      { name: 'cree_le', type: 'TIMESTAMP', constraints: 'DEFAULT NOW()', description: 'Date creation' },
      { name: 'cree_par', type: 'INT', constraints: 'FK', description: 'Auteur' },
    ],
  },
  {
    name: 'modele_sous_domaine',
    group: 'Documents',
    columns: [
      { name: 'id_modele', type: 'INT', constraints: 'PK, FK', description: 'Modele' },
      { name: 'id_sous_domaine', type: 'INT', constraints: 'PK, FK', description: 'Sous domaine' },
    ],
  },
  {
    name: 'paragraphe_predefini',
    group: 'Documents',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_modele', type: 'INT', constraints: 'FK', description: 'Modele' },
      { name: 'ordre', type: 'INT', description: 'Ordre' },
      { name: 'contenu', type: 'TEXT', description: 'Contenu' },
    ],
  },
  {
    name: 'role_affectation',
    group: 'Affectations',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Role' },
    ],
  },
  {
    name: 'affectation_dossier',
    group: 'Affectations',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_collaborateur', type: 'INT', constraints: 'FK', description: 'Collaborateur' },
      { name: 'id_dossier', type: 'INT', constraints: 'FK', description: 'Dossier' },
      { name: 'id_role', type: 'INT', constraints: 'FK', description: 'Role' },
      { name: 'date_debut', type: 'DATE', description: 'Date debut' },
      { name: 'date_fin', type: 'DATE', description: 'Date fin' },
    ],
  },
  {
    name: 'affectation_procedure',
    group: 'Affectations',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_collaborateur', type: 'INT', constraints: 'FK', description: 'Collaborateur' },
      { name: 'id_procedure', type: 'INT', constraints: 'FK', description: 'Procedure' },
      { name: 'id_role', type: 'INT', constraints: 'FK', description: 'Role' },
      { name: 'date_debut', type: 'DATE', description: 'Date debut' },
      { name: 'date_fin', type: 'DATE', description: 'Date fin' },
    ],
  },
  {
    name: 'dossier_lock',
    group: 'Verrouillage',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_dossier', type: 'INT', constraints: 'FK', description: 'Dossier' },
      { name: 'id_collaborateur', type: 'INT', constraints: 'FK', description: 'Collaborateur' },
      { name: 'locked_at', type: 'TIMESTAMP', constraints: 'NOT NULL', description: 'Debut verrou' },
      { name: 'expires_at', type: 'TIMESTAMP', constraints: 'NOT NULL', description: 'Expiration' },
    ],
  },
  {
    name: 'document_lock',
    group: 'Verrouillage',
    columns: [
      { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
      { name: 'id_document', type: 'INT', constraints: 'FK', description: 'Document' },
      { name: 'id_collaborateur', type: 'INT', constraints: 'FK', description: 'Collaborateur' },
      { name: 'locked_at', type: 'TIMESTAMP', constraints: 'NOT NULL', description: 'Debut verrou' },
      { name: 'expires_at', type: 'TIMESTAMP', constraints: 'NOT NULL', description: 'Expiration' },
    ],
  },
];

export const schemaGroups = [...new Set(schemaTables.map((table) => table.group))];
