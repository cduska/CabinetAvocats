-- =============================================================
-- rebuild-local.sql
-- Reconstruction complète de la base de données locale
-- Intègre schema_complet.sql + toutes les migrations structurelles
--
-- Usage : node scripts/run-sql-file.mjs scripts/rebuild-local.sql
--    ou : psql -U postgres -d <votre_base> -f scripts/rebuild-local.sql
-- =============================================================

BEGIN;

-- =============================================================
-- 1. NETTOYAGE COMPLET
-- =============================================================
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- =============================================================
-- 2. AGENCES
-- =============================================================

CREATE TABLE agence (
   id            SERIAL PRIMARY KEY,
   nom           VARCHAR(150) NOT NULL UNIQUE,
   adresse       VARCHAR(255),
   ville         VARCHAR(100),
   code_postal   VARCHAR(20)
);

-- =============================================================
-- 3. RÉFÉRENTIELS & COLLABORATEURS
-- =============================================================

CREATE TABLE profil (
   id      SERIAL PRIMARY KEY,
   libelle VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE metier (
   id      SERIAL PRIMARY KEY,
   libelle VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE collaborateur (
   id           SERIAL PRIMARY KEY,
   id_agence    INT  REFERENCES agence(id)  ON DELETE SET NULL,
   id_metier    INT  REFERENCES metier(id)  ON DELETE SET NULL,
   nom          VARCHAR(100) NOT NULL,
   prenom       VARCHAR(100) NOT NULL DEFAULT '',
   email        VARCHAR(150) NOT NULL UNIQUE,
   telephone    VARCHAR(50),
   date_entree  DATE,
   actif        BOOLEAN DEFAULT TRUE
);

CREATE TABLE collaborateur_profil (
   id_collaborateur INT REFERENCES collaborateur(id) ON DELETE CASCADE,
   id_profil        INT REFERENCES profil(id)        ON DELETE CASCADE,
   PRIMARY KEY (id_collaborateur, id_profil)
);

-- =============================================================
-- 4. DOMAINES, SOUS-DOMAINES, SPÉCIALITÉS, ÉQUIPES
-- =============================================================

CREATE TABLE domaine_juridique (
   id      SERIAL PRIMARY KEY,
   libelle VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE sous_domaine (
   id        SERIAL PRIMARY KEY,
   id_domaine INT REFERENCES domaine_juridique(id),
   libelle   VARCHAR(150) NOT NULL
);

CREATE TABLE specialite (
   id              SERIAL PRIMARY KEY,
   id_sous_domaine INT REFERENCES sous_domaine(id),
   libelle         VARCHAR(150) NOT NULL
);

CREATE TABLE collaborateur_specialite (
   id_collaborateur INT REFERENCES collaborateur(id) ON DELETE CASCADE,
   id_specialite    INT REFERENCES specialite(id)    ON DELETE CASCADE,
   PRIMARY KEY (id_collaborateur, id_specialite)
);

CREATE TABLE equipe (
   id          SERIAL PRIMARY KEY,
   nom_equipe  VARCHAR(100),
   description TEXT
);

CREATE TABLE collaborateur_equipe (
   id_collaborateur INT REFERENCES collaborateur(id) ON DELETE CASCADE,
   id_equipe        INT REFERENCES equipe(id)        ON DELETE CASCADE,
   PRIMARY KEY (id_collaborateur, id_equipe)
);

-- =============================================================
-- 5. CLIENTS
-- =============================================================

CREATE TABLE client (
   id                          SERIAL PRIMARY KEY,
   id_agence                   INT REFERENCES agence(id),
   id_collaborateur_responsable INT REFERENCES collaborateur(id) ON DELETE SET NULL,
   nom                         VARCHAR(100) NOT NULL,
   prenom                      VARCHAR(100) NOT NULL DEFAULT '',
   email                       VARCHAR(150),
   telephone                   VARCHAR(50)
);

-- =============================================================
-- 6. STATUTS & TYPES
-- =============================================================

CREATE TABLE statut_dossier (
   id      SERIAL PRIMARY KEY,
   libelle VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE type_dossier (
   id      SERIAL PRIMARY KEY,
   libelle VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE statut_procedure (
   id      SERIAL PRIMARY KEY,
   libelle VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE type_procedure (
   id      SERIAL PRIMARY KEY,
   libelle VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE statut_instance (
   id      SERIAL PRIMARY KEY,
   libelle VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE type_instance (
   id      SERIAL PRIMARY KEY,
   libelle VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE type_document (
   id      SERIAL PRIMARY KEY,
   libelle VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE role_affectation (
   id      SERIAL PRIMARY KEY,
   libelle VARCHAR(100) NOT NULL UNIQUE
);

-- =============================================================
-- 7. DOSSIERS & FACTURES
-- =============================================================

CREATE TABLE dossier (
   id                SERIAL PRIMARY KEY,
   id_agence         INT REFERENCES agence(id),
   id_client         INT REFERENCES client(id),
   id_type_dossier   INT REFERENCES type_dossier(id),
   id_statut_dossier INT REFERENCES statut_dossier(id),
   reference         VARCHAR(100) NOT NULL UNIQUE,
   date_ouverture    DATE,
   date_cloture      DATE,
   CONSTRAINT chk_dossier_dates
     CHECK (date_cloture IS NULL OR date_ouverture IS NULL OR date_cloture >= date_ouverture)
);

CREATE TABLE historique_dossier (
   id                SERIAL PRIMARY KEY,
   id_dossier        INT REFERENCES dossier(id) ON DELETE CASCADE,
   auteur            INT REFERENCES collaborateur(id),
   date_modification TIMESTAMP,
   description       TEXT
);

CREATE TABLE facture (
   id            SERIAL PRIMARY KEY,
   id_dossier    INT REFERENCES dossier(id),
   montant       NUMERIC(10,2) CHECK (montant >= 0),
   date_emission DATE,
   statut        VARCHAR(50)
);

-- =============================================================
-- 8. PROCÉDURES, INSTANCES, AUDIENCES, HISTORIQUES
-- =============================================================

CREATE TABLE procedure (
   id                  SERIAL PRIMARY KEY,
   id_dossier          INT REFERENCES dossier(id),
   id_type_procedure   INT REFERENCES type_procedure(id),
   id_statut_procedure INT REFERENCES statut_procedure(id),
   date_debut          DATE,
   date_fin            DATE,
   CONSTRAINT chk_procedure_dates
     CHECK (date_fin IS NULL OR date_debut IS NULL OR date_fin >= date_debut)
);

CREATE TABLE historique_procedure (
   id                SERIAL PRIMARY KEY,
   id_procedure      INT REFERENCES procedure(id) ON DELETE CASCADE,
   auteur            INT REFERENCES collaborateur(id),
   date_modification TIMESTAMP,
   description       TEXT
);

CREATE TABLE instance_juridique (
   id                  SERIAL PRIMARY KEY,
   id_procedure        INT REFERENCES procedure(id),
   id_type_instance    INT REFERENCES type_instance(id),
   id_statut_instance  INT REFERENCES statut_instance(id),
   date_debut          DATE,
   date_fin            DATE,
   CONSTRAINT chk_instance_dates
     CHECK (date_fin IS NULL OR date_debut IS NULL OR date_fin >= date_debut)
);

CREATE TABLE historique_instance (
   id                SERIAL PRIMARY KEY,
   id_instance       INT REFERENCES instance_juridique(id) ON DELETE CASCADE,
   auteur            INT REFERENCES collaborateur(id),
   date_modification TIMESTAMP,
   description       TEXT
);

CREATE TABLE audience (
   id           SERIAL PRIMARY KEY,
   id_instance  INT REFERENCES instance_juridique(id) ON DELETE CASCADE,
   date_audience DATE NOT NULL,
   commentaire  TEXT
);

-- =============================================================
-- 9. MODÈLES DE DOCUMENTS (JSONB + versions)
-- =============================================================

CREATE TABLE modele_document (
   id              SERIAL PRIMARY KEY,
   id_type_document INT REFERENCES type_document(id),
   nom_modele       VARCHAR(150) NOT NULL,
   description      TEXT,
   contenu_json     JSONB,
   CHECK (contenu_json IS NULL OR jsonb_typeof(contenu_json) = 'object')
);

CREATE INDEX idx_modele_document_contenu_json
  ON modele_document USING GIN (contenu_json);

CREATE TABLE modele_document_version (
   id              SERIAL PRIMARY KEY,
   id_modele       INT REFERENCES modele_document(id) ON DELETE CASCADE,
   numero_version  INT NOT NULL CHECK (numero_version >= 1),
   contenu_json    JSONB NOT NULL,
   cree_le         TIMESTAMP DEFAULT NOW(),
   cree_par        INT REFERENCES collaborateur(id),
   CHECK (jsonb_typeof(contenu_json) = 'object')
);

CREATE UNIQUE INDEX uq_modele_version
  ON modele_document_version (id_modele, numero_version);

CREATE INDEX idx_modele_document_version_contenu_json
  ON modele_document_version USING GIN (contenu_json);

CREATE TABLE modele_sous_domaine (
   id_modele       INT REFERENCES modele_document(id) ON DELETE CASCADE,
   id_sous_domaine INT REFERENCES sous_domaine(id),
   PRIMARY KEY (id_modele, id_sous_domaine)
);

CREATE TABLE paragraphe_predefini (
   id        SERIAL PRIMARY KEY,
   id_modele INT REFERENCES modele_document(id) ON DELETE CASCADE,
   ordre     INT,
   contenu   TEXT
);

-- =============================================================
-- 10. DOCUMENTS
-- =============================================================

CREATE TABLE document (
   id                    SERIAL PRIMARY KEY,
   id_type_document      INT REFERENCES type_document(id),
   id_dossier            INT REFERENCES dossier(id),
   id_procedure          INT REFERENCES procedure(id),
   id_instance           INT REFERENCES instance_juridique(id),
   auteur                INT REFERENCES collaborateur(id),
   id_modele             INT REFERENCES modele_document(id),
   numero_version_modele INT,
   statut_document       VARCHAR(50) DEFAULT 'brouillon',
   metadata_json         JSONB,
   chemin_fichier        TEXT,
   date_creation         TIMESTAMP,
   CONSTRAINT chk_document_statut
     CHECK (statut_document IN ('brouillon', 'A relire', 'Valide', 'publie')),
   CONSTRAINT chk_document_cible
     CHECK (
       (id_dossier   IS NOT NULL)::int +
       (id_procedure IS NOT NULL)::int +
       (id_instance  IS NOT NULL)::int = 1
     )
);

-- =============================================================
-- 11. AFFECTATIONS
-- =============================================================

CREATE TABLE affectation_dossier (
   id               SERIAL PRIMARY KEY,
   id_collaborateur INT REFERENCES collaborateur(id) ON DELETE CASCADE,
   id_dossier       INT REFERENCES dossier(id)       ON DELETE CASCADE,
   id_role          INT REFERENCES role_affectation(id),
   date_debut       DATE,
   date_fin         DATE
);

CREATE TABLE affectation_procedure (
   id               SERIAL PRIMARY KEY,
   id_collaborateur INT REFERENCES collaborateur(id) ON DELETE CASCADE,
   id_procedure     INT REFERENCES procedure(id)     ON DELETE CASCADE,
   id_role          INT REFERENCES role_affectation(id),
   date_debut       DATE,
   date_fin         DATE
);

-- =============================================================
-- 12. INDEX
-- =============================================================

-- Agences / rattachements
CREATE INDEX idx_collaborateur_id_agence ON collaborateur(id_agence);
CREATE INDEX idx_client_id_agence        ON client(id_agence);
CREATE INDEX idx_dossier_id_agence       ON dossier(id_agence);

-- Collaborateurs
CREATE INDEX idx_collaborateur_id_metier ON collaborateur(id_metier);
CREATE INDEX idx_collaborateur_actif     ON collaborateur(actif) WHERE actif = TRUE;
CREATE INDEX idx_collaborateur_nom       ON collaborateur(nom);
CREATE INDEX idx_collaborateur_email     ON collaborateur(email);
CREATE INDEX idx_collaborateur_profil    ON collaborateur_profil(id_collaborateur, id_profil);

-- Clients
CREATE INDEX idx_client_id_collaborateur_responsable ON client(id_collaborateur_responsable);
CREATE INDEX idx_client_nom   ON client(nom);
CREATE INDEX idx_client_email ON client(email);

-- Dossiers
CREATE INDEX idx_dossier_id_client        ON dossier(id_client);
CREATE INDEX idx_dossier_id_type_dossier  ON dossier(id_type_dossier);
CREATE INDEX idx_dossier_id_statut_dossier ON dossier(id_statut_dossier);
CREATE INDEX idx_dossier_reference        ON dossier(reference);
CREATE INDEX idx_dossier_date_ouverture   ON dossier(date_ouverture);
CREATE INDEX idx_dossier_agence_client    ON dossier(id_agence, id_client);

-- Historique dossier
CREATE INDEX idx_histo_dossier_id_dossier ON historique_dossier(id_dossier);
CREATE INDEX idx_histo_dossier_auteur     ON historique_dossier(auteur);

-- Factures
CREATE INDEX idx_facture_dossier_emission ON facture(id_dossier, date_emission DESC NULLS LAST);

-- Procédures
CREATE INDEX idx_procedure_id_dossier           ON procedure(id_dossier);
CREATE INDEX idx_procedure_id_type_procedure    ON procedure(id_type_procedure);
CREATE INDEX idx_procedure_id_statut_procedure  ON procedure(id_statut_procedure);
CREATE INDEX idx_procedure_date_debut           ON procedure(date_debut);

-- Historique procédure
CREATE INDEX idx_histo_procedure_id_procedure ON historique_procedure(id_procedure);
CREATE INDEX idx_histo_procedure_auteur       ON historique_procedure(auteur);

-- Instances
CREATE INDEX idx_instance_id_procedure      ON instance_juridique(id_procedure);
CREATE INDEX idx_instance_id_type_instance  ON instance_juridique(id_type_instance);
CREATE INDEX idx_instance_id_statut_instance ON instance_juridique(id_statut_instance);
CREATE INDEX idx_instance_date_debut        ON instance_juridique(date_debut);

-- Historique instance
CREATE INDEX idx_histo_instance_id_instance ON historique_instance(id_instance);
CREATE INDEX idx_histo_instance_auteur      ON historique_instance(auteur);

-- Audiences
CREATE INDEX idx_audience_id_instance   ON audience(id_instance);
CREATE INDEX idx_audience_date_audience ON audience(date_audience);

-- Domaines / Sous-domaines / Spécialités / Paragraphes
CREATE INDEX idx_sous_domaine_id_domaine      ON sous_domaine(id_domaine);
CREATE INDEX idx_specialite_id_sous_domaine   ON specialite(id_sous_domaine);
CREATE INDEX idx_paragraphe_id_modele         ON paragraphe_predefini(id_modele);

-- Modèles
CREATE INDEX idx_modele_id_type_document ON modele_document(id_type_document);

-- Documents
CREATE INDEX idx_document_id_modele      ON document(id_modele);
CREATE INDEX idx_document_modele_version ON document(id_modele, numero_version_modele);
CREATE INDEX idx_document_statut_document ON document(statut_document);
CREATE INDEX idx_document_metadata_json  ON document USING GIN (metadata_json);

-- =============================================================
-- 13. FONCTIONS UTILITAIRES (migration données EditorJS)
-- =============================================================

CREATE OR REPLACE FUNCTION migrate_list_items_to_v2(items jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(item) = 'string'
      THEN jsonb_build_object('content', item, 'items', '[]'::jsonb)
      ELSE item
    END
  )
  FROM jsonb_array_elements(items) AS item
$$;

CREATE OR REPLACE FUNCTION migrate_editorjs_lists_to_v2(doc jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'time',    doc->'time',
    'version', doc->'version',
    'blocks', (
      SELECT jsonb_agg(
        CASE
          WHEN block->>'type' = 'list'
          THEN jsonb_build_object(
            'type', 'list',
            'data', jsonb_build_object(
              'style', block->'data'->'style',
              'items', migrate_list_items_to_v2(block->'data'->'items')
            )
          )
          ELSE block
        END
        ORDER BY ordinality
      )
      FROM jsonb_array_elements(doc->'blocks') WITH ORDINALITY AS t(block, ordinality)
    )
  )
$$;

-- =============================================================
-- 14. COMMENTAIRES
-- =============================================================

COMMENT ON COLUMN dossier.date_cloture IS
  'Exposée côté API sous le nom "echeance" pour compatibilité frontend.';

COMMENT ON COLUMN procedure.id_type_procedure IS
  'Le champ "juridiction" exposé par l''API est calculé dynamiquement depuis le type_instance de la dernière instance - il n''existe pas comme colonne native.';

COMMENT ON COLUMN document.auteur IS
  'FK vers collaborateur(id). Convention dérogatoire : pas de préfixe id_ contrairement aux autres FK du schéma.';

COMMENT ON TABLE historique_dossier IS
  'Journal des modifications du dossier. Non alimenté automatiquement par le serveur Express (TODO: implémenter).';

COMMENT ON TABLE historique_instance IS
  'Journal des modifications d''instance. Attention : les modifications d''instance passaient historiquement dans historique_procedure par erreur - corrigé dans la migration 2026-04-11.';

COMMIT;