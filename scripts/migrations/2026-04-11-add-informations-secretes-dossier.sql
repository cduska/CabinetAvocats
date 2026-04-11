-- Migration : ajout de la colonne informations_secretes sur la table dossier
-- Date : 2026-04-11
-- Idempotente : oui

ALTER TABLE dossier
  ADD COLUMN IF NOT EXISTS informations_secretes TEXT;
