-- SCHEMA: public

-- DROP SCHEMA IF EXISTS public ;

CREATE SCHEMA IF NOT EXISTS public
    AUTHORIZATION postgres;

-- ========================================================= 
-- 1. AGENCES & PROFILS 
-- ========================================================= 
 
CREATE TABLE agence ( 
   id SERIAL PRIMARY KEY, 
   nom VARCHAR(150) NOT NULL, 
   adresse VARCHAR(255), 
   ville VARCHAR(100), 
   code_postal VARCHAR(20) 
); 
 
CREATE TABLE profil ( 
   id SERIAL PRIMARY KEY, 
   libelle VARCHAR(100) NOT NULL 
); 
 
-- ========================================================= 
-- 2. METIERS, COLLABORATEURS, ROLES APPLICATIFS 
-- ========================================================= 
 
CREATE TABLE metier ( 
   id SERIAL PRIMARY KEY, 
   libelle VARCHAR(100) NOT NULL 
); 
 
CREATE TABLE collaborateur ( 
   id SERIAL PRIMARY KEY, 
   id_agence INT REFERENCES agence(id), 
   id_metier INT REFERENCES metier(id), 
   nom VARCHAR(100), 
   prenom VARCHAR(100), 
   email VARCHAR(150), 
   telephone VARCHAR(50), 
   date_entree DATE, 
   actif BOOLEAN DEFAULT TRUE 
); 
 
CREATE TABLE collaborateur_profil ( 
   id_collaborateur INT REFERENCES collaborateur(id), 
   id_profil INT REFERENCES profil(id), 
   PRIMARY KEY(id_collaborateur, id_profil) 
); 
 
-- ========================================================= 
-- 3. DOMAINES, SOUS-DOMAINES, SPECIALITES, EQUIPES 
-- ========================================================= 
 
CREATE TABLE domaine_juridique ( 
   id SERIAL PRIMARY KEY, 
   libelle VARCHAR(150) NOT NULL 
); 
 
CREATE TABLE sous_domaine ( 
   id SERIAL PRIMARY KEY, 
   id_domaine INT REFERENCES domaine_juridique(id), 
   libelle VARCHAR(150) NOT NULL 
); 
 
CREATE TABLE specialite ( 
   id SERIAL PRIMARY KEY, 
   id_sous_domaine INT REFERENCES sous_domaine(id), 
   libelle VARCHAR(150) NOT NULL 
); 
 
CREATE TABLE collaborateur_specialite ( 
   id_collaborateur INT REFERENCES collaborateur(id), 
   id_specialite INT REFERENCES specialite(id), 
   PRIMARY KEY(id_collaborateur, id_specialite) 
); 
 
CREATE TABLE equipe ( 
   id SERIAL PRIMARY KEY, 
   nom_equipe VARCHAR(100), 
   description TEXT 
); 
 
CREATE TABLE collaborateur_equipe ( 
   id_collaborateur INT REFERENCES collaborateur(id), 
   id_equipe INT REFERENCES equipe(id), 
   PRIMARY KEY(id_collaborateur, id_equipe) 
); 
 
-- ========================================================= 
-- 4. CLIENTS 
-- ========================================================= 
 
CREATE TABLE client ( 
   id SERIAL PRIMARY KEY, 
   id_agence INT REFERENCES agence(id), 
   id_collaborateur_responsable INT REFERENCES collaborateur(id), 
   nom VARCHAR(100), 
   prenom VARCHAR(100), 
   email VARCHAR(150), 
   telephone VARCHAR(50) 
); 
 
-- ========================================================= 
-- 5. STATUTS & TYPES 
-- ========================================================= 
 
CREATE TABLE statut_dossier ( 
   id SERIAL PRIMARY KEY, 
   libelle VARCHAR(100) NOT NULL 
); 
 
CREATE TABLE type_dossier ( 
   id SERIAL PRIMARY KEY, 
   libelle VARCHAR(100) NOT NULL 
); 
 
CREATE TABLE statut_procedure ( 
   id SERIAL PRIMARY KEY, 
   libelle VARCHAR(100) NOT NULL 
); 
 
CREATE TABLE type_procedure ( 
   id SERIAL PRIMARY KEY, 
   libelle VARCHAR(100) NOT NULL 
); 
 
CREATE TABLE statut_instance ( 
   id SERIAL PRIMARY KEY, 
   libelle VARCHAR(100) NOT NULL 
); 
 
CREATE TABLE type_instance ( 
   id SERIAL PRIMARY KEY, 
   libelle VARCHAR(100) NOT NULL 
); 
 
CREATE TABLE type_document ( 
   id SERIAL PRIMARY KEY, 
   libelle VARCHAR(100) NOT NULL 
); 
 
-- ========================================================= 
-- 6. DOSSIERS, HISTORIQUE, FACTURES 
-- ========================================================= 
 
CREATE TABLE dossier ( 
   id SERIAL PRIMARY KEY, 
   id_agence INT REFERENCES agence(id), 
   id_client INT REFERENCES client(id), 
   id_type_dossier INT REFERENCES type_dossier(id), 
   id_statut_dossier INT REFERENCES statut_dossier(id), 
   reference VARCHAR(100), 
   date_ouverture DATE, 
   date_cloture DATE 
); 
 
CREATE TABLE historique_dossier ( 
   id SERIAL PRIMARY KEY, 
   id_dossier INT REFERENCES dossier(id), 
   auteur INT REFERENCES collaborateur(id), 
   date_modification TIMESTAMP, 
   description TEXT 
); 
 
CREATE TABLE facture ( 
   id SERIAL PRIMARY KEY, 
   id_dossier INT REFERENCES dossier(id), 
   montant NUMERIC(10,2), 
   date_emission DATE, 
   statut VARCHAR(50) 
); 
 
-- ========================================================= 
-- 7. PROCEDURES, INSTANCES, AUDIENCES, HISTORIQUES 
-- ========================================================= 
 
CREATE TABLE procedure ( 
   id SERIAL PRIMARY KEY, 
   id_dossier INT REFERENCES dossier(id), 
   id_type_procedure INT REFERENCES type_procedure(id), 
   id_statut_procedure INT REFERENCES statut_procedure(id), 
   date_debut DATE, 
   date_fin DATE 
); 
 
CREATE TABLE historique_procedure ( 
   id SERIAL PRIMARY KEY, 
   id_procedure INT REFERENCES procedure(id), 
   auteur INT REFERENCES collaborateur(id), 
   date_modification TIMESTAMP, 
   description TEXT 
); 
 
CREATE TABLE instance_juridique ( 
   id SERIAL PRIMARY KEY, 
   id_procedure INT REFERENCES procedure(id), 
   id_type_instance INT REFERENCES type_instance(id), 
   id_statut_instance INT REFERENCES statut_instance(id), 
   date_debut DATE, 
   date_fin DATE 
); 
 
CREATE TABLE historique_instance ( 
   id SERIAL PRIMARY KEY, 
   id_instance INT REFERENCES instance_juridique(id), 
   auteur INT REFERENCES collaborateur(id), 
   date_modification TIMESTAMP, 
   description TEXT 
); 
 
CREATE TABLE audience ( 
   id SERIAL PRIMARY KEY, 
   id_instance INT REFERENCES instance_juridique(id), 
   date_audience DATE, 
   commentaire TEXT 
); 
 
-- ========================================================= 
-- 8. DOCUMENTS & MODELES (JSONB + versions) 
-- ========================================================= 
 
CREATE TABLE document ( 
   id SERIAL PRIMARY KEY, 
   id_type_document INT REFERENCES type_document(id), 
   id_dossier INT REFERENCES dossier(id), 
   id_procedure INT REFERENCES procedure(id), 
   id_instance INT REFERENCES instance_juridique(id), 
   auteur INT REFERENCES collaborateur(id), 
   chemin_fichier TEXT, 
   date_creation TIMESTAMP, 
   CHECK ( 
       (id_dossier IS NOT NULL)::int + 
       (id_procedure IS NOT NULL)::int + 
       (id_instance IS NOT NULL)::int = 1 
   ) 
); 
 
CREATE TABLE modele_document ( 
   id SERIAL PRIMARY KEY, 
   id_type_document INT REFERENCES type_document(id), 
   nom_modele VARCHAR(150), 
   description TEXT, 
   contenu_json JSONB, 
   CHECK (contenu_json IS NULL OR jsonb_typeof(contenu_json) = 'object') 
); 
 
CREATE INDEX idx_modele_document_json 
ON modele_document 
USING GIN (contenu_json); 
 
CREATE TABLE modele_document_version ( 
   id SERIAL PRIMARY KEY, 
   id_modele INT REFERENCES modele_document(id), 
   numero_version INT NOT NULL, 
   contenu_json JSONB NOT NULL, 
   cree_le TIMESTAMP DEFAULT NOW(), 
   cree_par INT REFERENCES collaborateur(id), 
   CHECK (jsonb_typeof(contenu_json) = 'object') 
); 
 
CREATE UNIQUE INDEX uq_modele_version 
ON modele_document_version (id_modele, numero_version); 
 
CREATE INDEX idx_modele_document_version_json 
ON modele_document_version 
USING GIN (contenu_json); 
 
CREATE TABLE modele_sous_domaine ( 
   id_modele INT REFERENCES modele_document(id), 
   id_sous_domaine INT REFERENCES sous_domaine(id), 
   PRIMARY KEY(id_modele, id_sous_domaine) 
); 
 
CREATE TABLE paragraphe_predefini ( 
   id SERIAL PRIMARY KEY, 
   id_modele INT REFERENCES modele_document(id), 
   ordre INT, 
   contenu TEXT 
); 
 
-- ========================================================= 
-- 9. AFFECTATIONS (multi-agences autorisé) 
-- ========================================================= 
 
CREATE TABLE role_affectation ( 
   id SERIAL PRIMARY KEY, 
   libelle VARCHAR(100) NOT NULL 
); 
 
CREATE TABLE affectation_dossier ( 
   id SERIAL PRIMARY KEY, 
   id_collaborateur INT REFERENCES collaborateur(id), 
   id_dossier INT REFERENCES dossier(id), 
   id_role INT REFERENCES role_affectation(id), 
   date_debut DATE, 
   date_fin DATE 
); 
 
CREATE TABLE affectation_procedure ( 
   id SERIAL PRIMARY KEY, 
   id_collaborateur INT REFERENCES collaborateur(id), 
   id_procedure INT REFERENCES procedure(id), 
   id_role INT REFERENCES role_affectation(id), 
   date_debut DATE, 
   date_fin DATE 
);

-- 1. Index généraux sur les clés étrangères

-- AGENCE 
CREATE INDEX idx_collaborateur_id_agence ON collaborateur(id_agence); 
CREATE INDEX idx_client_id_agence ON client(id_agence); 
CREATE INDEX idx_dossier_id_agence ON dossier(id_agence); 
 
-- COLLABORATEURS 
CREATE INDEX idx_collaborateur_id_metier ON collaborateur(id_metier); 
 
-- CLIENTS 
CREATE INDEX idx_client_id_collaborateur_responsable ON client(id_collaborateur_responsable); 
 
-- DOSSIERS 
CREATE INDEX idx_dossier_id_client ON dossier(id_client); 
CREATE INDEX idx_dossier_id_type_dossier ON dossier(id_type_dossier); 
CREATE INDEX idx_dossier_id_statut_dossier ON dossier(id_statut_dossier); 
 
-- HISTORIQUE DOSSIER 
CREATE INDEX idx_histo_dossier_id_dossier ON historique_dossier(id_dossier); 
CREATE INDEX idx_histo_dossier_auteur ON historique_dossier(auteur); 
 
-- FACTURES 
CREATE INDEX idx_facture_id_dossier ON facture(id_dossier); 
 
-- PROCEDURES 
CREATE INDEX idx_procedure_id_dossier ON procedure(id_dossier); 
CREATE INDEX idx_procedure_id_type_procedure ON procedure(id_type_procedure); 
CREATE INDEX idx_procedure_id_statut_procedure ON procedure(id_statut_procedure); 
 
-- HISTORIQUE PROCEDURE 
CREATE INDEX idx_histo_procedure_id_procedure ON historique_procedure(id_procedure); 
CREATE INDEX idx_histo_procedure_auteur ON historique_procedure(auteur); 
 
-- INSTANCES 
CREATE INDEX idx_instance_id_procedure ON instance_juridique(id_procedure); 
CREATE INDEX idx_instance_id_type_instance ON instance_juridique(id_type_instance); 
CREATE INDEX idx_instance_id_statut_instance ON instance_juridique(id_statut_instance); 
 
-- HISTORIQUE INSTANCE 
CREATE INDEX idx_histo_instance_id_instance ON historique_instance(id_instance); 
CREATE INDEX idx_histo_instance_auteur ON historique_instance(auteur); 
 
-- AUDIENCES 
CREATE INDEX idx_audience_id_instance ON audience(id_instance); 
 
-- DOCUMENTS 
CREATE INDEX idx_document_id_type_document ON document(id_type_document); 
CREATE INDEX idx_document_id_dossier ON document(id_dossier); 
CREATE INDEX idx_document_id_procedure ON document(id_procedure); 
CREATE INDEX idx_document_id_instance ON document(id_instance); 
CREATE INDEX idx_document_auteur ON document(auteur); 
 
-- MODELES 
CREATE INDEX idx_modele_id_type_document ON modele_document(id_type_document); 
 
-- MODELE VERSION 
CREATE INDEX idx_modele_version_id_modele ON modele_document_version(id_modele); 
 
-- AFFECTATIONS 
CREATE INDEX idx_affect_dossier_id_collaborateur ON affectation_dossier(id_collaborateur); 
CREATE INDEX idx_affect_dossier_id_dossier ON affectation_dossier(id_dossier); 
CREATE INDEX idx_affect_dossier_id_role ON affectation_dossier(id_role); 
 
CREATE INDEX idx_affect_procedure_id_collaborateur ON affectation_procedure(id_collaborateur); 
CREATE INDEX idx_affect_procedure_id_procedure ON affectation_procedure(id_procedure); 
CREATE INDEX idx_affect_procedure_id_role ON affectation_procedure(id_role); 

-- 2. Index pour les recherches par agence
CREATE INDEX idx_dossier_agence ON dossier(id_agence); 
CREATE INDEX idx_client_agence ON client(id_agence); 
CREATE INDEX idx_collaborateur_agence ON collaborateur(id_agence); 

-- 3. Index pour les recherches par dossier / procédure / instance 

CREATE INDEX idx_document_parent ON document(id_dossier, id_procedure, id_instance); 
CREATE INDEX idx_procedure_dossier ON procedure(id_dossier); 
CREATE INDEX idx_instance_procedure ON instance_juridique(id_procedure); 

-- 4. Index pour les recherches textuelles 

CREATE INDEX idx_client_nom ON client(nom); 
CREATE INDEX idx_client_email ON client(email); 
 
CREATE INDEX idx_collaborateur_nom ON collaborateur(nom); 
CREATE INDEX idx_collaborateur_email ON collaborateur(email);

-- 5. Index JSONB (modèles de documents) 

-- Recherche dans les modèles 
CREATE INDEX idx_modele_document_contenu_json 
ON modele_document 
USING GIN (contenu_json); 
 
-- Recherche dans les versions 
CREATE INDEX idx_modele_document_version_contenu_json 
ON modele_document_version 
USING GIN (contenu_json); 

-- 6. Index pour les tables d’association N:N 

CREATE INDEX idx_collab_specialite_collab ON collaborateur_specialite(id_collaborateur); 
CREATE INDEX idx_collab_specialite_specialite ON collaborateur_specialite(id_specialite); 
 
CREATE INDEX idx_collab_equipe_collab ON collaborateur_equipe(id_collaborateur); 
CREATE INDEX idx_collab_equipe_equipe ON collaborateur_equipe(id_equipe); 
 
CREATE INDEX idx_modele_sous_domaine_modele ON modele_sous_domaine(id_modele); 
CREATE INDEX idx_modele_sous_domaine_sous_domaine ON modele_sous_domaine(id_sous_domaine);

-- 7. Index pour les dates (si tu fais des filtres temporels) 

CREATE INDEX idx_dossier_date_ouverture ON dossier(date_ouverture); 
CREATE INDEX idx_procedure_date_debut ON procedure(date_debut); 
CREATE INDEX idx_instance_date_debut ON instance_juridique(date_debut); 
CREATE INDEX idx_document_date_creation ON document(date_creation);

-- 8. Index pour les règles d’accès

CREATE INDEX idx_collaborateur_profil ON collaborateur_profil(id_collaborateur, id_profil);
CREATE INDEX idx_dossier_agence_client ON dossier(id_agence, id_client);

