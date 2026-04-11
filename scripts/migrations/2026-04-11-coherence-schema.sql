-- =========================================================
-- Migration : contrôle de cohérence du schéma
-- Date      : 2026-04-11
-- Priorité  : critique → élevée → moyenne
-- Idempotente : oui (blocs DO + IF NOT EXISTS)
-- =========================================================

BEGIN;

-- =========================================================
-- 1. NOT NULL sur champs critiques applicativement validés
--    (on remplace d'abord les NULL existants par des valeurs
--     neutres pour éviter l'échec sur base déjà peuplée)
-- =========================================================

-- collaborateur ------------------------------------------------
UPDATE collaborateur SET nom      = 'Inconnu'     WHERE nom      IS NULL;
UPDATE collaborateur SET prenom   = ''            WHERE prenom   IS NULL;
UPDATE collaborateur SET email    = 'email_' || id || '@a.remplacer.fr'
                     WHERE email  IS NULL;

ALTER TABLE collaborateur
  ALTER COLUMN nom   SET NOT NULL,
  ALTER COLUMN email SET NOT NULL;

-- client -------------------------------------------------------
UPDATE client SET nom    = 'Inconnu' WHERE nom    IS NULL;
UPDATE client SET prenom = ''        WHERE prenom IS NULL;

ALTER TABLE client
  ALTER COLUMN nom   SET NOT NULL,
  ALTER COLUMN prenom SET NOT NULL;

-- dossier ------------------------------------------------------
UPDATE dossier
   SET reference = 'DOS-' || LPAD(id::text, 6, '0')
 WHERE reference IS NULL;

ALTER TABLE dossier
  ALTER COLUMN reference SET NOT NULL;

-- modele_document ----------------------------------------------
UPDATE modele_document SET nom_modele = 'Sans titre' WHERE nom_modele IS NULL;
ALTER TABLE modele_document ALTER COLUMN nom_modele SET NOT NULL;

-- audience -----------------------------------------------------
UPDATE audience
   SET date_audience = CURRENT_DATE
 WHERE date_audience IS NULL;

ALTER TABLE audience ALTER COLUMN date_audience SET NOT NULL;

-- =========================================================
-- 2. UNIQUE sur champs clés d'identification
-- =========================================================

DO $$ BEGIN
  -- collaborateur.email
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_collaborateur_email'
  ) THEN
    ALTER TABLE collaborateur ADD CONSTRAINT uq_collaborateur_email UNIQUE (email);
  END IF;

  -- dossier.reference
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_dossier_reference'
  ) THEN
    ALTER TABLE dossier ADD CONSTRAINT uq_dossier_reference UNIQUE (reference);
  END IF;

  -- agence.nom
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_agence_nom'
  ) THEN
    ALTER TABLE agence ADD CONSTRAINT uq_agence_nom UNIQUE (nom);
  END IF;

  -- Tables référentiel (libellé)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_metier_libelle')
    THEN ALTER TABLE metier ADD CONSTRAINT uq_metier_libelle UNIQUE (libelle); END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_profil_libelle')
    THEN ALTER TABLE profil ADD CONSTRAINT uq_profil_libelle UNIQUE (libelle); END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_domaine_libelle')
    THEN ALTER TABLE domaine_juridique ADD CONSTRAINT uq_domaine_libelle UNIQUE (libelle); END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_type_dossier_libelle')
    THEN ALTER TABLE type_dossier ADD CONSTRAINT uq_type_dossier_libelle UNIQUE (libelle); END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_statut_dossier_libelle')
    THEN ALTER TABLE statut_dossier ADD CONSTRAINT uq_statut_dossier_libelle UNIQUE (libelle); END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_type_procedure_libelle')
    THEN ALTER TABLE type_procedure ADD CONSTRAINT uq_type_procedure_libelle UNIQUE (libelle); END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_statut_procedure_libelle')
    THEN ALTER TABLE statut_procedure ADD CONSTRAINT uq_statut_procedure_libelle UNIQUE (libelle); END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_type_instance_libelle')
    THEN ALTER TABLE type_instance ADD CONSTRAINT uq_type_instance_libelle UNIQUE (libelle); END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_statut_instance_libelle')
    THEN ALTER TABLE statut_instance ADD CONSTRAINT uq_statut_instance_libelle UNIQUE (libelle); END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_type_document_libelle')
    THEN ALTER TABLE type_document ADD CONSTRAINT uq_type_document_libelle UNIQUE (libelle); END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_role_affectation_libelle')
    THEN ALTER TABLE role_affectation ADD CONSTRAINT uq_role_affectation_libelle UNIQUE (libelle); END IF;
END $$;

-- =========================================================
-- 3. CHECK constraints : cohérence des dates et des statuts
-- =========================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_dossier_dates') THEN
    ALTER TABLE dossier ADD CONSTRAINT chk_dossier_dates
      CHECK (date_cloture IS NULL OR date_ouverture IS NULL OR date_cloture >= date_ouverture);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_procedure_dates') THEN
    ALTER TABLE procedure ADD CONSTRAINT chk_procedure_dates
      CHECK (date_fin IS NULL OR date_debut IS NULL OR date_fin >= date_debut);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_instance_dates') THEN
    ALTER TABLE instance_juridique ADD CONSTRAINT chk_instance_dates
      CHECK (date_fin IS NULL OR date_debut IS NULL OR date_fin >= date_debut);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_facture_montant') THEN
    ALTER TABLE facture ADD CONSTRAINT chk_facture_montant CHECK (montant >= 0);
  END IF;

  -- Valeurs autorisées pour statut_document
  -- On corrige d'abord les éventuelles valeurs hors liste
  UPDATE document
     SET statut_document = 'brouillon'
   WHERE statut_document NOT IN ('brouillon', 'A relire', 'Valide', 'publie');

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_document_statut') THEN
    ALTER TABLE document ADD CONSTRAINT chk_document_statut
      CHECK (statut_document IN ('brouillon', 'A relire', 'Valide', 'publie'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_version_numero') THEN
    ALTER TABLE modele_document_version ADD CONSTRAINT chk_version_numero
      CHECK (numero_version >= 1);
  END IF;
END $$;

-- =========================================================
-- 4. ON DELETE : CASCADE sur les tables dépendantes
--               SET NULL sur les FK optionnelles
-- =========================================================

-- 4.1 historique_dossier → dossier : CASCADE
ALTER TABLE historique_dossier
  DROP CONSTRAINT IF EXISTS historique_dossier_id_dossier_fkey;
ALTER TABLE historique_dossier
  ADD CONSTRAINT historique_dossier_id_dossier_fkey
    FOREIGN KEY (id_dossier) REFERENCES dossier(id) ON DELETE CASCADE;

-- 4.2 historique_procedure → procedure : CASCADE
ALTER TABLE historique_procedure
  DROP CONSTRAINT IF EXISTS historique_procedure_id_procedure_fkey;
ALTER TABLE historique_procedure
  ADD CONSTRAINT historique_procedure_id_procedure_fkey
    FOREIGN KEY (id_procedure) REFERENCES procedure(id) ON DELETE CASCADE;

-- 4.3 historique_instance → instance_juridique : CASCADE
ALTER TABLE historique_instance
  DROP CONSTRAINT IF EXISTS historique_instance_id_instance_fkey;
ALTER TABLE historique_instance
  ADD CONSTRAINT historique_instance_id_instance_fkey
    FOREIGN KEY (id_instance) REFERENCES instance_juridique(id) ON DELETE CASCADE;

-- 4.4 audience → instance_juridique : CASCADE
ALTER TABLE audience
  DROP CONSTRAINT IF EXISTS audience_id_instance_fkey;
ALTER TABLE audience
  ADD CONSTRAINT audience_id_instance_fkey
    FOREIGN KEY (id_instance) REFERENCES instance_juridique(id) ON DELETE CASCADE;

-- 4.5 affectation_dossier → dossier / collaborateur : CASCADE
ALTER TABLE affectation_dossier
  DROP CONSTRAINT IF EXISTS affectation_dossier_id_dossier_fkey,
  DROP CONSTRAINT IF EXISTS affectation_dossier_id_collaborateur_fkey;
ALTER TABLE affectation_dossier
  ADD CONSTRAINT affectation_dossier_id_dossier_fkey
    FOREIGN KEY (id_dossier) REFERENCES dossier(id) ON DELETE CASCADE,
  ADD CONSTRAINT affectation_dossier_id_collaborateur_fkey
    FOREIGN KEY (id_collaborateur) REFERENCES collaborateur(id) ON DELETE CASCADE;

-- 4.6 affectation_procedure → procedure / collaborateur : CASCADE
ALTER TABLE affectation_procedure
  DROP CONSTRAINT IF EXISTS affectation_procedure_id_procedure_fkey,
  DROP CONSTRAINT IF EXISTS affectation_procedure_id_collaborateur_fkey;
ALTER TABLE affectation_procedure
  ADD CONSTRAINT affectation_procedure_id_procedure_fkey
    FOREIGN KEY (id_procedure) REFERENCES procedure(id) ON DELETE CASCADE,
  ADD CONSTRAINT affectation_procedure_id_collaborateur_fkey
    FOREIGN KEY (id_collaborateur) REFERENCES collaborateur(id) ON DELETE CASCADE;

-- 4.7 collaborateur_profil → collaborateur / profil : CASCADE
ALTER TABLE collaborateur_profil
  DROP CONSTRAINT IF EXISTS collaborateur_profil_id_collaborateur_fkey,
  DROP CONSTRAINT IF EXISTS collaborateur_profil_id_profil_fkey;
ALTER TABLE collaborateur_profil
  ADD CONSTRAINT collaborateur_profil_id_collaborateur_fkey
    FOREIGN KEY (id_collaborateur) REFERENCES collaborateur(id) ON DELETE CASCADE,
  ADD CONSTRAINT collaborateur_profil_id_profil_fkey
    FOREIGN KEY (id_profil) REFERENCES profil(id) ON DELETE CASCADE;

-- 4.8 collaborateur_specialite → collaborateur / specialite : CASCADE
ALTER TABLE collaborateur_specialite
  DROP CONSTRAINT IF EXISTS collaborateur_specialite_id_collaborateur_fkey,
  DROP CONSTRAINT IF EXISTS collaborateur_specialite_id_specialite_fkey;
ALTER TABLE collaborateur_specialite
  ADD CONSTRAINT collaborateur_specialite_id_collaborateur_fkey
    FOREIGN KEY (id_collaborateur) REFERENCES collaborateur(id) ON DELETE CASCADE,
  ADD CONSTRAINT collaborateur_specialite_id_specialite_fkey
    FOREIGN KEY (id_specialite) REFERENCES specialite(id) ON DELETE CASCADE;

-- 4.9 collaborateur_equipe → collaborateur / equipe : CASCADE
ALTER TABLE collaborateur_equipe
  DROP CONSTRAINT IF EXISTS collaborateur_equipe_id_collaborateur_fkey,
  DROP CONSTRAINT IF EXISTS collaborateur_equipe_id_equipe_fkey;
ALTER TABLE collaborateur_equipe
  ADD CONSTRAINT collaborateur_equipe_id_collaborateur_fkey
    FOREIGN KEY (id_collaborateur) REFERENCES collaborateur(id) ON DELETE CASCADE,
  ADD CONSTRAINT collaborateur_equipe_id_equipe_fkey
    FOREIGN KEY (id_equipe) REFERENCES equipe(id) ON DELETE CASCADE;

-- 4.10 modele_sous_domaine → modele_document : CASCADE
ALTER TABLE modele_sous_domaine
  DROP CONSTRAINT IF EXISTS modele_sous_domaine_id_modele_fkey;
ALTER TABLE modele_sous_domaine
  ADD CONSTRAINT modele_sous_domaine_id_modele_fkey
    FOREIGN KEY (id_modele) REFERENCES modele_document(id) ON DELETE CASCADE;

-- 4.11 paragraphe_predefini → modele_document : CASCADE
ALTER TABLE paragraphe_predefini
  DROP CONSTRAINT IF EXISTS paragraphe_predefini_id_modele_fkey;
ALTER TABLE paragraphe_predefini
  ADD CONSTRAINT paragraphe_predefini_id_modele_fkey
    FOREIGN KEY (id_modele) REFERENCES modele_document(id) ON DELETE CASCADE;

-- 4.12 modele_document_version → modele_document : CASCADE
ALTER TABLE modele_document_version
  DROP CONSTRAINT IF EXISTS modele_document_version_id_modele_fkey;
ALTER TABLE modele_document_version
  ADD CONSTRAINT modele_document_version_id_modele_fkey
    FOREIGN KEY (id_modele) REFERENCES modele_document(id) ON DELETE CASCADE;

-- 4.13 client → collaborateur (responsable) : SET NULL
ALTER TABLE client
  DROP CONSTRAINT IF EXISTS client_id_collaborateur_responsable_fkey;
ALTER TABLE client
  ADD CONSTRAINT client_id_collaborateur_responsable_fkey
    FOREIGN KEY (id_collaborateur_responsable) REFERENCES collaborateur(id) ON DELETE SET NULL;

-- 4.14 collaborateur → agence : SET NULL
ALTER TABLE collaborateur
  DROP CONSTRAINT IF EXISTS collaborateur_id_agence_fkey;
ALTER TABLE collaborateur
  ADD CONSTRAINT collaborateur_id_agence_fkey
    FOREIGN KEY (id_agence) REFERENCES agence(id) ON DELETE SET NULL;

-- 4.15 collaborateur → metier : SET NULL
ALTER TABLE collaborateur
  DROP CONSTRAINT IF EXISTS collaborateur_id_metier_fkey;
ALTER TABLE collaborateur
  ADD CONSTRAINT collaborateur_id_metier_fkey
    FOREIGN KEY (id_metier) REFERENCES metier(id) ON DELETE SET NULL;

-- =========================================================
-- 5. Index manquants
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_sous_domaine_id_domaine
  ON sous_domaine(id_domaine);

CREATE INDEX IF NOT EXISTS idx_specialite_id_sous_domaine
  ON specialite(id_sous_domaine);

CREATE INDEX IF NOT EXISTS idx_paragraphe_id_modele
  ON paragraphe_predefini(id_modele);

CREATE INDEX IF NOT EXISTS idx_dossier_reference
  ON dossier(reference);

CREATE INDEX IF NOT EXISTS idx_audience_date_audience
  ON audience(date_audience);

CREATE INDEX IF NOT EXISTS idx_collaborateur_actif
  ON collaborateur(actif) WHERE actif = TRUE;

-- Index composite facture (remplace le mono-colonne le cas échéant)
DROP INDEX IF EXISTS idx_facture_id_dossier;
CREATE INDEX IF NOT EXISTS idx_facture_dossier_emission
  ON facture(id_dossier, date_emission DESC NULLS LAST);

-- =========================================================
-- 6. COMMENTAIRES sur champs à sémantique non évidente
-- =========================================================

COMMENT ON COLUMN dossier.date_cloture IS
  'Exposée côté API sous le nom "echeance" pour compatibilité frontend.';

COMMENT ON COLUMN procedure.id_type_procedure IS
  'Le champ "juridiction" exposé par l''API est calculé dynamiquement depuis le type_instance de la dernière instance — il n''existe pas comme colonne native.';

COMMENT ON COLUMN document.auteur IS
  'FK vers collaborateur(id). Convention dérogatoire : pas de préfixe id_ contrairement aux autres FK du schéma.';

COMMENT ON TABLE historique_dossier IS
  'Journal des modifications du dossier. Non alimenté automatiquement par le serveur Express (TODO: implémenter).';

COMMENT ON TABLE historique_instance IS
  'Journal des modifications d''instance. Attention : les modifications d''instance passaient historiquement dans historique_procedure par erreur — corrigé dans la migration 2026-04-11.';

COMMIT;
