-- =========================================================
-- Migration : enrichissement de paragraphe_predefini
-- Date      : 2026-05-09
-- Idempotente : oui (ALTER TABLE IF NOT EXISTS sur colonnes)
-- =========================================================

BEGIN;

-- Ajout de la colonne titre (libellé court pour affichage)
ALTER TABLE paragraphe_predefini
  ADD COLUMN IF NOT EXISTS titre VARCHAR(200);

-- Ajout de la colonne categorie (groupe thématique)
ALTER TABLE paragraphe_predefini
  ADD COLUMN IF NOT EXISTS categorie VARCHAR(100);

-- Remplissage des titres manquants à partir du contenu existant
-- (les 80 premiers caractères du contenu comme titre par défaut)
UPDATE paragraphe_predefini
   SET titre = LEFT(contenu, 80)
 WHERE titre IS NULL;

-- Index sur la catégorie pour faciliter le filtrage
CREATE INDEX IF NOT EXISTS idx_paragraphe_predefini_categorie
  ON paragraphe_predefini (categorie);

COMMIT;
