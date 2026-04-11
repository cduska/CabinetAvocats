-- =========================================================
-- Migration : suppression des index dupliqués
-- Date      : 2026-04-11
-- Idempotente : oui (IF EXISTS)
-- =========================================================
-- Ces index font doublon avec les index de référence (nommage id_*).
-- Les index plus descriptifs (idx_*_id_*) sont conservés.
-- =========================================================

BEGIN;

-- Doublons agence (remplacés par idx_*_id_agence dans le bloc principal)
DROP INDEX IF EXISTS idx_dossier_agence;
DROP INDEX IF EXISTS idx_client_agence;
DROP INDEX IF EXISTS idx_collaborateur_agence;

-- Doublons dossier / instance (remplacés par idx_*_id_* dans le bloc principal)
DROP INDEX IF EXISTS idx_procedure_dossier;
DROP INDEX IF EXISTS idx_instance_procedure;

-- Doublons JSONB modèles (redéfinis en section §8 avec nommage _contenu_json)
DROP INDEX IF EXISTS idx_modele_document_json;
DROP INDEX IF EXISTS idx_modele_document_version_json;

-- Index mono-colonne facture : remplacé par le composite (migration 2026-04-11-coherence-schema.sql)
-- DROP INDEX IF EXISTS idx_facture_id_dossier;  -- déjà traité dans la migration précédente

COMMIT;
