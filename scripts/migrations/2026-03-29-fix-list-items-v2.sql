-- Fix: migration des blocs "list" vers le format @editorjs/list v2
-- Date: 2026-03-29
--
-- @editorjs/list v2+ exige que chaque item soit un objet
-- { "content": "...", "items": [] } au lieu d'une simple string.
--
-- Ce script transforme les données déjà en base pour modele_document
-- et modele_document_version.

-- Helper : convertit un tableau d'items list (strings ou objets) vers format v2
CREATE OR REPLACE FUNCTION migrate_list_items_to_v2(items jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(item) = 'string'
      THEN jsonb_build_object('content', item, 'items', '[]'::jsonb)
      ELSE item
    END
  )
  FROM jsonb_array_elements(items) AS item
$$;

-- Helper : transforme tous les blocs list d'un contenu_json Editor.js
CREATE OR REPLACE FUNCTION migrate_editorjs_lists_to_v2(doc jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'time',    doc->'time',
    'version', doc->'version',
    'blocks',  (
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
      FROM jsonb_array_elements(doc->'blocks') WITH ORDINALITY AS block
    )
  )
$$;

-- =========================================================
-- 1. Mise à jour de modele_document
-- =========================================================
UPDATE modele_document
SET contenu_json = migrate_editorjs_lists_to_v2(contenu_json)
WHERE contenu_json ? 'blocks'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(contenu_json->'blocks') AS block
    WHERE block->>'type' = 'list'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(block->'data'->'items') AS item
        WHERE jsonb_typeof(item) = 'string'
      )
  );

-- =========================================================
-- 2. Mise à jour de modele_document_version
-- =========================================================
UPDATE modele_document_version
SET contenu_json = migrate_editorjs_lists_to_v2(contenu_json)
WHERE contenu_json ? 'blocks'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(contenu_json->'blocks') AS block
    WHERE block->>'type' = 'list'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(block->'data'->'items') AS item
        WHERE jsonb_typeof(item) = 'string'
      )
  );

-- Nettoyage des fonctions temporaires
DROP FUNCTION IF EXISTS migrate_list_items_to_v2(jsonb);
DROP FUNCTION IF EXISTS migrate_editorjs_lists_to_v2(jsonb);
