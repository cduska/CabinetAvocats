-- Migration: modeles + documents workflow metadata
-- Date: 2026-03-28

ALTER TABLE document
  ADD COLUMN IF NOT EXISTS id_modele INT REFERENCES modele_document(id),
  ADD COLUMN IF NOT EXISTS numero_version_modele INT,
  ADD COLUMN IF NOT EXISTS statut_document VARCHAR(50),
  ADD COLUMN IF NOT EXISTS metadata_json JSONB;

UPDATE document
SET statut_document = COALESCE(statut_document,
  CASE
    WHEN date_creation IS NULL THEN 'brouillon'
    WHEN date_creation < NOW() - INTERVAL '30 days' THEN 'valide'
    ELSE 'a relire'
  END
)
WHERE statut_document IS NULL;

ALTER TABLE document
  ALTER COLUMN statut_document SET DEFAULT 'brouillon';

CREATE INDEX IF NOT EXISTS idx_document_id_modele ON document(id_modele);
CREATE INDEX IF NOT EXISTS idx_document_modele_version ON document(id_modele, numero_version_modele);
CREATE INDEX IF NOT EXISTS idx_document_statut_document ON document(statut_document);
CREATE INDEX IF NOT EXISTS idx_document_metadata_json ON document USING GIN (metadata_json);
