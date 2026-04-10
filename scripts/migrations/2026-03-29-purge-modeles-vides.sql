-- Suppression des modèles documentaires sans contenu réel (blocs vides)
-- Supprime d'abord les dépendances (versions, sous-domaines) puis les modèles

DELETE FROM modele_document_version
WHERE id_modele IN (
  SELECT id FROM modele_document
  WHERE nom_modele LIKE 'FAST-MODELE-%'
     OR contenu_json IS NULL
     OR contenu_json = 'null'::jsonb
     OR contenu_json = '{}'::jsonb
     OR (contenu_json ? 'content' AND jsonb_array_length(contenu_json->'content') = 0)
     OR (contenu_json ? 'blocks'  AND jsonb_array_length(contenu_json->'blocks')  = 0)
);

DELETE FROM modele_sous_domaine
WHERE id_modele IN (
  SELECT id FROM modele_document
  WHERE nom_modele LIKE 'FAST-MODELE-%'
     OR contenu_json IS NULL
     OR contenu_json = 'null'::jsonb
     OR contenu_json = '{}'::jsonb
     OR (contenu_json ? 'content' AND jsonb_array_length(contenu_json->'content') = 0)
     OR (contenu_json ? 'blocks'  AND jsonb_array_length(contenu_json->'blocks')  = 0)
);

DELETE FROM modele_document
WHERE nom_modele LIKE 'FAST-MODELE-%'
   OR contenu_json IS NULL
   OR contenu_json = 'null'::jsonb
   OR contenu_json = '{}'::jsonb
   OR (contenu_json ? 'content' AND jsonb_array_length(contenu_json->'content') = 0)
   OR (contenu_json ? 'blocks'  AND jsonb_array_length(contenu_json->'blocks')  = 0);
