-- =============================================================
-- Migration : EditorJS JSON → TipTap JSON
-- Date      : 2026-04-12
-- Tables    : modele_document, modele_document_version, document
-- Usage     : coller dans Neon SQL editor et exécuter en bloc
--
-- Note : les balises inline HTML (<b>, <i>, <u>…) présentes dans
-- les textes sont supprimées (le texte brut est conservé). Les
-- éléments structurels (titres, listes, citations, séparateurs)
-- sont entièrement convertis dans le format TipTap.
-- =============================================================

-- -------------------------------------------------------------
-- ÉTAPE 1 — Fonctions helper (temporaires, nettoyées à la fin)
-- -------------------------------------------------------------

-- Convertit le texte HTML inline EditorJS en tableau de nœuds TipTap.
-- Gère <br> → hardBreak ; strip les balises HTML ; décode les entités.
CREATE OR REPLACE FUNCTION _ej_text_to_tt(html text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  segs  text[];
  result jsonb := '[]'::jsonb;
  seg   text;
  txt   text;
  i     int;
BEGIN
  IF html IS NULL OR html = '' THEN
    RETURN jsonb_build_array(jsonb_build_object('type', 'text', 'text', ''));
  END IF;

  -- Découpage sur les balises <br> / <br/>
  segs := regexp_split_to_array(html, '<br\s*/?>', 'i');

  FOR i IN 1..array_length(segs, 1) LOOP
    seg := segs[i];
    -- Suppression de toutes les balises HTML
    txt := regexp_replace(seg, '<[^>]+>', '', 'g');
    -- Décodage des entités HTML courantes
    txt := replace(txt, '&amp;',  '&');
    txt := replace(txt, '&lt;',   '<');
    txt := replace(txt, '&gt;',   '>');
    txt := replace(txt, '&nbsp;', ' ');
    txt := replace(txt, '&#39;',  '''');
    txt := replace(txt, '&quot;', '"');

    IF txt <> '' THEN
      result := result || jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', txt)
      );
    END IF;

    -- hardBreak entre les segments (pas après le dernier)
    IF i < array_length(segs, 1) THEN
      result := result || jsonb_build_array(jsonb_build_object('type', 'hardBreak'));
    END IF;
  END LOOP;

  -- Garantit au moins un nœud texte vide
  IF jsonb_array_length(result) = 0 THEN
    result := jsonb_build_array(jsonb_build_object('type', 'text', 'text', ''));
  END IF;

  RETURN result;
END;
$$;

-- Convertit un seul bloc EditorJS en nœud TipTap.
CREATE OR REPLACE FUNCTION _ej_block_to_tt(block jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  btype      text  := block->>'type';
  bdata      jsonb := block->'data';
  item       jsonb;
  item_text  text;
  list_type  text;
  list_nodes jsonb := '[]'::jsonb;
BEGIN
  CASE btype

    WHEN 'header' THEN
      RETURN jsonb_build_object(
        'type',    'heading',
        'attrs',   jsonb_build_object(
                     'level',     COALESCE((bdata->>'level')::int, 2),
                     'textAlign', NULL
                   ),
        'content', _ej_text_to_tt(bdata->>'text')
      );

    WHEN 'paragraph' THEN
      RETURN jsonb_build_object(
        'type',    'paragraph',
        'content', _ej_text_to_tt(bdata->>'text')
      );

    WHEN 'list' THEN
      list_type := CASE
                     WHEN bdata->>'style' = 'ordered' THEN 'orderedList'
                     ELSE 'bulletList'
                   END;

      FOR item IN SELECT * FROM jsonb_array_elements(bdata->'items') LOOP
        -- items v1 = string simple ; items v2 = { content, items }
        IF jsonb_typeof(item) = 'string' THEN
          item_text := item #>> '{}';
        ELSE
          item_text := COALESCE(item->>'content', '');
        END IF;

        list_nodes := list_nodes || jsonb_build_array(
          jsonb_build_object(
            'type',    'listItem',
            'content', jsonb_build_array(
              jsonb_build_object(
                'type',    'paragraph',
                'content', _ej_text_to_tt(item_text)
              )
            )
          )
        );
      END LOOP;

      RETURN jsonb_build_object('type', list_type, 'content', list_nodes);

    WHEN 'quote' THEN
      RETURN jsonb_build_object(
        'type',    'blockquote',
        'content', jsonb_build_array(
          jsonb_build_object(
            'type',    'paragraph',
            'content', _ej_text_to_tt(bdata->>'text')
          )
        )
      );

    WHEN 'delimiter' THEN
      RETURN jsonb_build_object('type', 'horizontalRule');

    ELSE
      -- Bloc inconnu → paragraphe vide
      RETURN jsonb_build_object('type', 'paragraph');

  END CASE;
END;
$$;

-- Convertit un document EditorJS complet en document TipTap.
-- Si le document est déjà TipTap (type = 'doc'), il est retourné tel quel.
CREATE OR REPLACE FUNCTION editorjs_to_tiptap(doc jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  block   jsonb;
  content jsonb := '[]'::jsonb;
BEGIN
  -- Déjà TipTap ou format inconnu → ne pas toucher
  IF doc IS NULL OR doc->>'type' = 'doc' OR NOT (doc ? 'blocks') THEN
    RETURN doc;
  END IF;

  FOR block IN SELECT * FROM jsonb_array_elements(doc->'blocks') LOOP
    content := content || jsonb_build_array(_ej_block_to_tt(block));
  END LOOP;

  RETURN jsonb_build_object('type', 'doc', 'content', content);
END;
$$;

-- -------------------------------------------------------------
-- ÉTAPE 2 — Migration des données
-- -------------------------------------------------------------

-- 1. Modèles de documents
UPDATE modele_document
SET    contenu_json = editorjs_to_tiptap(contenu_json)
WHERE  contenu_json ? 'blocks';

-- 2. Versions de modèles
UPDATE modele_document_version
SET    contenu_json = editorjs_to_tiptap(contenu_json)
WHERE  contenu_json ? 'blocks';

-- 3. Documents (contenu stocké dans metadata_json->contenuJson)
UPDATE document
SET    metadata_json = jsonb_set(
         metadata_json,
         '{contenuJson}',
         editorjs_to_tiptap(metadata_json->'contenuJson')
       )
WHERE  metadata_json->'contenuJson' ? 'blocks';

-- -------------------------------------------------------------
-- ÉTAPE 3 — Nettoyage des fonctions temporaires
-- -------------------------------------------------------------
DROP FUNCTION IF EXISTS _ej_text_to_tt(text);
DROP FUNCTION IF EXISTS _ej_block_to_tt(jsonb);
DROP FUNCTION IF EXISTS editorjs_to_tiptap(jsonb);

-- -------------------------------------------------------------
-- ÉTAPE 4 — Vérification post-migration
-- -------------------------------------------------------------
SELECT
  'modele_document'          AS table_name,
  COUNT(*)                   AS total,
  COUNT(*) FILTER (WHERE contenu_json->>'type' = 'doc')  AS tiptap_ok,
  COUNT(*) FILTER (WHERE contenu_json ? 'blocks')        AS editorjs_restants
FROM modele_document

UNION ALL

SELECT
  'modele_document_version',
  COUNT(*),
  COUNT(*) FILTER (WHERE contenu_json->>'type' = 'doc'),
  COUNT(*) FILTER (WHERE contenu_json ? 'blocks')
FROM modele_document_version

UNION ALL

SELECT
  'document',
  COUNT(*),
  COUNT(*) FILTER (WHERE metadata_json->'contenuJson'->>'type' = 'doc'),
  COUNT(*) FILTER (WHERE metadata_json->'contenuJson' ? 'blocks')
FROM document
WHERE metadata_json IS NOT NULL;
