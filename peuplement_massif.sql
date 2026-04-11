-- Script de peuplement massif idempotent
-- Compatible avec schema_complet.sql
-- Relance possible sans doublons fonctionnels (WHERE NOT EXISTS / ON CONFLICT)

BEGIN;

-- =========================================================
-- A. REFERENTIELS DE BASE
-- =========================================================

INSERT INTO profil (libelle)
SELECT v.libelle
FROM (
  VALUES
    ('Administrateur national'),
    ('Administrateur agence'),
    ('Collaborateur')
) AS v(libelle)
WHERE NOT EXISTS (
  SELECT 1
  FROM profil p
  WHERE p.libelle = v.libelle
);

INSERT INTO metier (libelle)
SELECT v.libelle
FROM (
  VALUES
    ('Avocat'),
    ('Juriste'),
    ('Assistant juridique')
) AS v(libelle)
WHERE NOT EXISTS (
  SELECT 1
  FROM metier m
  WHERE m.libelle = v.libelle
);

INSERT INTO domaine_juridique (libelle)
SELECT v.libelle
FROM (
  VALUES
    ('Droit du travail'),
    ('Droit des affaires'),
    ('Droit penal')
) AS v(libelle)
WHERE NOT EXISTS (
  SELECT 1
  FROM domaine_juridique d
  WHERE d.libelle = v.libelle
);

INSERT INTO type_dossier (libelle)
SELECT v.libelle
FROM (
  VALUES
    ('Contentieux'),
    ('Conseil'),
    ('Transaction')
) AS v(libelle)
WHERE NOT EXISTS (
  SELECT 1
  FROM type_dossier td
  WHERE td.libelle = v.libelle
);

INSERT INTO statut_dossier (libelle)
SELECT v.libelle
FROM (
  VALUES
    ('Ouvert'),
    ('En cours'),
    ('A valider'),
    ('Clos')
) AS v(libelle)
WHERE NOT EXISTS (
  SELECT 1
  FROM statut_dossier sd
  WHERE sd.libelle = v.libelle
);

INSERT INTO type_procedure (libelle)
SELECT v.libelle
FROM (
  VALUES
    ('Prud''hommes'),
    ('Appel'),
    ('Refere')
) AS v(libelle)
WHERE NOT EXISTS (
  SELECT 1
  FROM type_procedure tp
  WHERE tp.libelle = v.libelle
);

INSERT INTO statut_procedure (libelle)
SELECT v.libelle
FROM (
  VALUES
    ('Initiee'),
    ('En cours'),
    ('Terminee')
) AS v(libelle)
WHERE NOT EXISTS (
  SELECT 1
  FROM statut_procedure sp
  WHERE sp.libelle = v.libelle
);

INSERT INTO type_instance (libelle)
SELECT v.libelle
FROM (
  VALUES
    ('Audience conciliation'),
    ('Audience jugement'),
    ('Audience mise en etat')
) AS v(libelle)
WHERE NOT EXISTS (
  SELECT 1
  FROM type_instance ti
  WHERE ti.libelle = v.libelle
);

INSERT INTO statut_instance (libelle)
SELECT v.libelle
FROM (
  VALUES
    ('Active'),
    ('Suspendue'),
    ('Terminee')
) AS v(libelle)
WHERE NOT EXISTS (
  SELECT 1
  FROM statut_instance si
  WHERE si.libelle = v.libelle
);

INSERT INTO type_document (libelle)
SELECT v.libelle
FROM (
  VALUES
    ('Assignation'),
    ('Conclusions'),
    ('Courrier'),
    ('Note interne')
) AS v(libelle)
WHERE NOT EXISTS (
  SELECT 1
  FROM type_document td
  WHERE td.libelle = v.libelle
);

INSERT INTO role_affectation (libelle)
SELECT v.libelle
FROM (
  VALUES
    ('Responsable'),
    ('Second'),
    ('Redacteur')
) AS v(libelle)
WHERE NOT EXISTS (
  SELECT 1
  FROM role_affectation ra
  WHERE ra.libelle = v.libelle
);

-- =========================================================
-- B. AGENCES
-- =========================================================

WITH generated AS (
  SELECT
    g,
    'Agence ' || g AS nom,
    g || ' rue Exemple' AS adresse,
    CASE
      WHEN g % 3 = 0 THEN 'Paris'
      WHEN g % 3 = 1 THEN 'Lyon'
      ELSE 'Nantes'
    END AS ville,
    CASE
      WHEN g % 3 = 0 THEN '7500' || (g % 10)
      WHEN g % 3 = 1 THEN '6900' || (g % 10)
      ELSE '4400' || (g % 10)
    END AS code_postal
  FROM generate_series(1, 20) AS g
)
INSERT INTO agence (nom, adresse, ville, code_postal)
SELECT g.nom, g.adresse, g.ville, g.code_postal
FROM generated g
WHERE NOT EXISTS (
  SELECT 1
  FROM agence a
  WHERE a.nom = g.nom
);

-- =========================================================
-- C. DOMAINES / SOUS-DOMAINES / SPECIALITES
-- =========================================================

WITH generated AS (
  SELECT *
  FROM (
    VALUES
      ('Droit du travail', 'Licenciement'),
      ('Droit du travail', 'Harcelement'),
      ('Droit des affaires', 'Contrats commerciaux'),
      ('Droit des affaires', 'Fusions & acquisitions'),
      ('Droit penal', 'Infractions financieres')
  ) AS v(domaine_libelle, sous_domaine_libelle)
)
INSERT INTO sous_domaine (id_domaine, libelle)
SELECT dj.id, g.sous_domaine_libelle
FROM generated g
JOIN domaine_juridique dj ON dj.libelle = g.domaine_libelle
WHERE NOT EXISTS (
  SELECT 1
  FROM sous_domaine sd
  WHERE sd.id_domaine = dj.id
    AND sd.libelle = g.sous_domaine_libelle
);

WITH generated AS (
  SELECT *
  FROM (
    VALUES
      ('Licenciement', 'Contentieux licenciement'),
      ('Harcelement', 'Contentieux harcelement'),
      ('Contrats commerciaux', 'Redaction contrats'),
      ('Fusions & acquisitions', 'Operations M&A'),
      ('Infractions financieres', 'Droit penal des affaires')
  ) AS v(sous_domaine_libelle, specialite_libelle)
)
INSERT INTO specialite (id_sous_domaine, libelle)
SELECT sd.id, g.specialite_libelle
FROM generated g
JOIN sous_domaine sd ON sd.libelle = g.sous_domaine_libelle
WHERE NOT EXISTS (
  SELECT 1
  FROM specialite s
  WHERE s.id_sous_domaine = sd.id
    AND s.libelle = g.specialite_libelle
);

-- =========================================================
-- D. COLLABORATEURS + PROFILS
-- =========================================================

WITH generated AS (
  SELECT
    g,
    'Agence ' || (((g - 1) % 20) + 1) AS agence_nom,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Avocat'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'Juriste'
      ELSE 'Assistant juridique'
    END AS metier_libelle,
    'Nom' || g AS nom,
    'Prenom' || g AS prenom,
    'user' || g || '@cabinet.fr' AS email,
    '0600' || lpad(g::text, 6, '0') AS telephone,
    DATE '2018-01-01' + (g % 200) AS date_entree
  FROM generate_series(1, 200) AS g
),
resolved AS (
  SELECT
    g.nom,
    g.prenom,
    g.email,
    g.telephone,
    g.date_entree,
    a.id AS id_agence,
    m.id AS id_metier
  FROM generated g
  JOIN agence a ON a.nom = g.agence_nom
  JOIN metier m ON m.libelle = g.metier_libelle
)
INSERT INTO collaborateur (
  id_agence,
  id_metier,
  nom,
  prenom,
  email,
  telephone,
  date_entree,
  actif
)
SELECT
  r.id_agence,
  r.id_metier,
  r.nom,
  r.prenom,
  r.email,
  r.telephone,
  r.date_entree,
  TRUE
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM collaborateur c
  WHERE c.email = r.email
);

WITH generated AS (
  SELECT
    c.id AS id_collaborateur,
    CASE
      WHEN c.user_number = 1 THEN 'Administrateur national'
      WHEN c.user_number BETWEEN 2 AND 21 THEN 'Administrateur agence'
      ELSE 'Collaborateur'
    END AS profil_libelle
  FROM (
    SELECT
      id,
      regexp_replace(email, '^user([0-9]+)@cabinet\\.fr$', '\\1')::int AS user_number
    FROM collaborateur
    WHERE email ~ '^user[0-9]+@cabinet\\.fr$'
  ) AS c
)
INSERT INTO collaborateur_profil (id_collaborateur, id_profil)
SELECT g.id_collaborateur, p.id
FROM generated g
JOIN profil p ON p.libelle = g.profil_libelle
ON CONFLICT (id_collaborateur, id_profil) DO NOTHING;

-- =========================================================
-- E. CLIENTS
-- =========================================================

WITH generated AS (
  SELECT
    g,
    'Agence ' || (((g - 1) % 20) + 1) AS agence_nom,
    'user' || (((g - 1) % 200) + 1) || '@cabinet.fr' AS responsable_email,
    'ClientNom' || g AS nom,
    'ClientPrenom' || g AS prenom,
    'client' || g || '@mail.com' AS email,
    '07' || lpad(g::text, 8, '0') AS telephone
  FROM generate_series(1, 800) AS g
),
resolved AS (
  SELECT
    g.nom,
    g.prenom,
    g.email,
    g.telephone,
    a.id AS id_agence,
    c.id AS id_collaborateur_responsable
  FROM generated g
  JOIN agence a ON a.nom = g.agence_nom
  LEFT JOIN collaborateur c ON c.email = g.responsable_email
)
INSERT INTO client (
  id_agence,
  id_collaborateur_responsable,
  nom,
  prenom,
  email,
  telephone
)
SELECT
  r.id_agence,
  r.id_collaborateur_responsable,
  r.nom,
  r.prenom,
  r.email,
  r.telephone
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM client c
  WHERE c.email = r.email
);

-- =========================================================
-- F. DOSSIERS
-- =========================================================

WITH generated AS (
  SELECT
    g,
    'DOS-' || lpad(g::text, 6, '0') AS reference,
    'Agence ' || (((g - 1) % 20) + 1) AS agence_nom,
    'client' || (((g - 1) % 800) + 1) || '@mail.com' AS client_email,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Contentieux'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'Conseil'
      ELSE 'Transaction'
    END AS type_dossier_libelle,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Ouvert'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'En cours'
      ELSE 'Clos'
    END AS statut_dossier_libelle,
    DATE '2023-01-01' + (g % 365) AS date_ouverture
  FROM generate_series(1, 1500) AS g
),
resolved AS (
  SELECT
    g.reference,
    g.date_ouverture,
    a.id AS id_agence,
    c.id AS id_client,
    td.id AS id_type_dossier,
    sd.id AS id_statut_dossier
  FROM generated g
  JOIN agence a ON a.nom = g.agence_nom
  JOIN client c ON c.email = g.client_email
  JOIN type_dossier td ON td.libelle = g.type_dossier_libelle
  JOIN statut_dossier sd ON sd.libelle = g.statut_dossier_libelle
)
INSERT INTO dossier (
  id_agence,
  id_client,
  id_type_dossier,
  id_statut_dossier,
  reference,
  date_ouverture
)
SELECT
  r.id_agence,
  r.id_client,
  r.id_type_dossier,
  r.id_statut_dossier,
  r.reference,
  r.date_ouverture
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM dossier d
  WHERE d.reference = r.reference
);

-- =========================================================
-- G. PROCEDURES
-- =========================================================

WITH generated AS (
  SELECT
    g,
    'DOS-' || lpad((((g - 1) % 1500) + 1)::text, 6, '0') AS dossier_reference,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Prud''hommes'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'Appel'
      ELSE 'Refere'
    END AS type_procedure_libelle,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Initiee'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'En cours'
      ELSE 'Terminee'
    END AS statut_procedure_libelle,
    DATE '2023-02-01' + (g % 365) AS date_debut
  FROM generate_series(1, 3000) AS g
),
resolved AS (
  SELECT
    d.id AS id_dossier,
    tp.id AS id_type_procedure,
    sp.id AS id_statut_procedure,
    g.date_debut
  FROM generated g
  JOIN dossier d ON d.reference = g.dossier_reference
  JOIN type_procedure tp ON tp.libelle = g.type_procedure_libelle
  JOIN statut_procedure sp ON sp.libelle = g.statut_procedure_libelle
)
INSERT INTO procedure (
  id_dossier,
  id_type_procedure,
  id_statut_procedure,
  date_debut
)
SELECT
  r.id_dossier,
  r.id_type_procedure,
  r.id_statut_procedure,
  r.date_debut
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM procedure p
  WHERE p.id_dossier = r.id_dossier
    AND p.id_type_procedure = r.id_type_procedure
    AND p.id_statut_procedure = r.id_statut_procedure
    AND p.date_debut = r.date_debut
);

-- =========================================================
-- H. INSTANCES
-- =========================================================

WITH procedure_seed AS (
  SELECT
    pidx AS proc_idx,
    'DOS-' || lpad((((pidx - 1) % 1500) + 1)::text, 6, '0') AS dossier_reference,
    CASE
      WHEN ((pidx - 1) % 3) + 1 = 1 THEN 'Prud''hommes'
      WHEN ((pidx - 1) % 3) + 1 = 2 THEN 'Appel'
      ELSE 'Refere'
    END AS type_procedure_libelle,
    CASE
      WHEN ((pidx - 1) % 3) + 1 = 1 THEN 'Initiee'
      WHEN ((pidx - 1) % 3) + 1 = 2 THEN 'En cours'
      ELSE 'Terminee'
    END AS statut_procedure_libelle,
    DATE '2023-02-01' + (pidx % 365) AS date_debut
  FROM generate_series(1, 3000) AS pidx
),
procedure_map AS (
  SELECT
    ps.proc_idx,
    MIN(p.id) AS id_procedure
  FROM procedure_seed ps
  JOIN dossier d ON d.reference = ps.dossier_reference
  JOIN type_procedure tp ON tp.libelle = ps.type_procedure_libelle
  JOIN statut_procedure sp ON sp.libelle = ps.statut_procedure_libelle
  JOIN procedure p
    ON p.id_dossier = d.id
   AND p.id_type_procedure = tp.id
   AND p.id_statut_procedure = sp.id
   AND p.date_debut = ps.date_debut
  GROUP BY ps.proc_idx
),
generated AS (
  SELECT
    g,
    ((g - 1) % 3000) + 1 AS proc_idx,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Audience conciliation'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'Audience jugement'
      ELSE 'Audience mise en etat'
    END AS type_instance_libelle,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Active'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'Suspendue'
      ELSE 'Terminee'
    END AS statut_instance_libelle,
    DATE '2023-03-01' + (g % 365) AS date_debut
  FROM generate_series(1, 4500) AS g
),
resolved AS (
  SELECT
    pm.id_procedure,
    ti.id AS id_type_instance,
    si.id AS id_statut_instance,
    g.date_debut
  FROM generated g
  JOIN procedure_map pm ON pm.proc_idx = g.proc_idx
  JOIN type_instance ti ON ti.libelle = g.type_instance_libelle
  JOIN statut_instance si ON si.libelle = g.statut_instance_libelle
)
INSERT INTO instance_juridique (
  id_procedure,
  id_type_instance,
  id_statut_instance,
  date_debut
)
SELECT
  r.id_procedure,
  r.id_type_instance,
  r.id_statut_instance,
  r.date_debut
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM instance_juridique ij
  WHERE ij.id_procedure = r.id_procedure
    AND ij.id_type_instance = r.id_type_instance
    AND ij.id_statut_instance = r.id_statut_instance
    AND ij.date_debut = r.date_debut
);

-- =========================================================
-- I. DOCUMENTS (respecte le CHECK: un seul parent)
-- =========================================================

WITH dossier_map AS (
  SELECT
    g AS dossier_idx,
    d.id AS id_dossier
  FROM generate_series(1, 1500) AS g
  JOIN dossier d ON d.reference = 'DOS-' || lpad(g::text, 6, '0')
),
procedure_seed AS (
  SELECT
    pidx AS proc_idx,
    'DOS-' || lpad((((pidx - 1) % 1500) + 1)::text, 6, '0') AS dossier_reference,
    CASE
      WHEN ((pidx - 1) % 3) + 1 = 1 THEN 'Prud''hommes'
      WHEN ((pidx - 1) % 3) + 1 = 2 THEN 'Appel'
      ELSE 'Refere'
    END AS type_procedure_libelle,
    CASE
      WHEN ((pidx - 1) % 3) + 1 = 1 THEN 'Initiee'
      WHEN ((pidx - 1) % 3) + 1 = 2 THEN 'En cours'
      ELSE 'Terminee'
    END AS statut_procedure_libelle,
    DATE '2023-02-01' + (pidx % 365) AS date_debut
  FROM generate_series(1, 3000) AS pidx
),
procedure_map AS (
  SELECT
    ps.proc_idx,
    MIN(p.id) AS id_procedure
  FROM procedure_seed ps
  JOIN dossier d ON d.reference = ps.dossier_reference
  JOIN type_procedure tp ON tp.libelle = ps.type_procedure_libelle
  JOIN statut_procedure sp ON sp.libelle = ps.statut_procedure_libelle
  JOIN procedure p
    ON p.id_dossier = d.id
   AND p.id_type_procedure = tp.id
   AND p.id_statut_procedure = sp.id
   AND p.date_debut = ps.date_debut
  GROUP BY ps.proc_idx
),
instance_seed AS (
  SELECT
    iidx AS instance_idx,
    ((iidx - 1) % 3000) + 1 AS proc_idx,
    CASE
      WHEN ((iidx - 1) % 3) + 1 = 1 THEN 'Audience conciliation'
      WHEN ((iidx - 1) % 3) + 1 = 2 THEN 'Audience jugement'
      ELSE 'Audience mise en etat'
    END AS type_instance_libelle,
    CASE
      WHEN ((iidx - 1) % 3) + 1 = 1 THEN 'Active'
      WHEN ((iidx - 1) % 3) + 1 = 2 THEN 'Suspendue'
      ELSE 'Terminee'
    END AS statut_instance_libelle,
    DATE '2023-03-01' + (iidx % 365) AS date_debut
  FROM generate_series(1, 4500) AS iidx
),
instance_map AS (
  SELECT
    isd.instance_idx,
    MIN(ij.id) AS id_instance
  FROM instance_seed isd
  JOIN procedure_map pm ON pm.proc_idx = isd.proc_idx
  JOIN type_instance ti ON ti.libelle = isd.type_instance_libelle
  JOIN statut_instance si ON si.libelle = isd.statut_instance_libelle
  JOIN instance_juridique ij
    ON ij.id_procedure = pm.id_procedure
   AND ij.id_type_instance = ti.id
   AND ij.id_statut_instance = si.id
   AND ij.date_debut = isd.date_debut
  GROUP BY isd.instance_idx
),
generated AS (
  SELECT
    g,
    CASE
      WHEN g % 3 = 1 THEN 'dossier'
      WHEN g % 3 = 2 THEN 'procedure'
      ELSE 'instance'
    END AS parent_type,
    ((g - 1) % 1500) + 1 AS dossier_idx,
    ((g - 1) % 3000) + 1 AS procedure_idx,
    ((g - 1) % 4500) + 1 AS instance_idx,
    CASE
      WHEN ((g - 1) % 4) + 1 = 1 THEN 'Assignation'
      WHEN ((g - 1) % 4) + 1 = 2 THEN 'Conclusions'
      WHEN ((g - 1) % 4) + 1 = 3 THEN 'Courrier'
      ELSE 'Note interne'
    END AS type_document_libelle,
    'user' || (((g - 1) % 200) + 1) || '@cabinet.fr' AS auteur_email,
    '/docs/doc_' || g || '.pdf' AS chemin_fichier,
    NOW() - (g || ' minutes')::interval AS date_creation
  FROM generate_series(1, 6000) AS g
),
resolved AS (
  SELECT
    g.parent_type,
    dm.id_dossier,
    pm.id_procedure,
    im.id_instance,
    td.id AS id_type_document,
    c.id AS id_auteur,
    g.chemin_fichier,
    g.date_creation
  FROM generated g
  LEFT JOIN dossier_map dm ON dm.dossier_idx = g.dossier_idx
  LEFT JOIN procedure_map pm ON pm.proc_idx = g.procedure_idx
  LEFT JOIN instance_map im ON im.instance_idx = g.instance_idx
  JOIN type_document td ON td.libelle = g.type_document_libelle
  JOIN collaborateur c ON c.email = g.auteur_email
)
INSERT INTO document (
  id_type_document,
  id_dossier,
  id_procedure,
  id_instance,
  auteur,
  chemin_fichier,
  date_creation
)
SELECT
  r.id_type_document,
  CASE WHEN r.parent_type = 'dossier' THEN r.id_dossier ELSE NULL END,
  CASE WHEN r.parent_type = 'procedure' THEN r.id_procedure ELSE NULL END,
  CASE WHEN r.parent_type = 'instance' THEN r.id_instance ELSE NULL END,
  r.id_auteur,
  r.chemin_fichier,
  r.date_creation
FROM resolved r
WHERE (r.parent_type <> 'dossier' OR r.id_dossier IS NOT NULL)
  AND (r.parent_type <> 'procedure' OR r.id_procedure IS NOT NULL)
  AND (r.parent_type <> 'instance' OR r.id_instance IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM document d
    WHERE d.chemin_fichier = r.chemin_fichier
  );

-- =========================================================
-- J. MODELES + VERSIONS
-- =========================================================

WITH generated AS (
  SELECT
    g,
    CASE
      WHEN ((g - 1) % 4) + 1 = 1 THEN 'Assignation'
      WHEN ((g - 1) % 4) + 1 = 2 THEN 'Conclusions'
      WHEN ((g - 1) % 4) + 1 = 3 THEN 'Courrier'
      ELSE 'Note interne'
    END AS type_document_libelle,
    'Modele ' || g AS nom_modele,
    'Modele auto ' || g AS description,
    jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object(
          'type', 'heading',
          'attrs', jsonb_build_object('level', 2),
          'content', jsonb_build_array(
            jsonb_build_object('type', 'text', 'text', 'Modele ' || g)
          )
        ),
        jsonb_build_object(
          'type', 'paragraph',
          'content', jsonb_build_array(
            jsonb_build_object('type', 'text', 'text', 'Contenu auto ' || g)
          )
        )
      )
    ) AS contenu_json
  FROM generate_series(1, 150) AS g
),
resolved AS (
  SELECT
    td.id AS id_type_document,
    g.nom_modele,
    g.description,
    g.contenu_json
  FROM generated g
  JOIN type_document td ON td.libelle = g.type_document_libelle
)
INSERT INTO modele_document (id_type_document, nom_modele, description, contenu_json)
SELECT
  r.id_type_document,
  r.nom_modele,
  r.description,
  r.contenu_json
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM modele_document md
  WHERE md.nom_modele = r.nom_modele
);

WITH modeles_cibles AS (
  SELECT
    md.id,
    md.contenu_json
  FROM modele_document md
  WHERE md.nom_modele ~ '^Modele [0-9]+$'
)
INSERT INTO modele_document_version (
  id_modele,
  numero_version,
  contenu_json,
  cree_par
)
SELECT
  m.id,
  v.numero_version,
  m.contenu_json || jsonb_build_object('version', v.numero_version),
  1
FROM modeles_cibles m
CROSS JOIN generate_series(1, 4) AS v(numero_version)
ON CONFLICT (id_modele, numero_version) DO NOTHING;

-- =========================================================
-- K. AFFECTATIONS
-- =========================================================

WITH generated AS (
  SELECT
    g,
    'user' || (((g - 1) % 200) + 1) || '@cabinet.fr' AS collaborateur_email,
    'DOS-' || lpad((((g - 1) % 1500) + 1)::text, 6, '0') AS dossier_reference,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Responsable'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'Second'
      ELSE 'Redacteur'
    END AS role_libelle,
    DATE '2023-01-01' + (g % 365) AS date_debut
  FROM generate_series(1, 6000) AS g
),
resolved AS (
  SELECT
    c.id AS id_collaborateur,
    d.id AS id_dossier,
    ra.id AS id_role,
    g.date_debut
  FROM generated g
  JOIN collaborateur c ON c.email = g.collaborateur_email
  JOIN dossier d ON d.reference = g.dossier_reference
  JOIN role_affectation ra ON ra.libelle = g.role_libelle
)
INSERT INTO affectation_dossier (
  id_collaborateur,
  id_dossier,
  id_role,
  date_debut
)
SELECT
  r.id_collaborateur,
  r.id_dossier,
  r.id_role,
  r.date_debut
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM affectation_dossier ad
  WHERE ad.id_collaborateur = r.id_collaborateur
    AND ad.id_dossier = r.id_dossier
    AND ad.id_role = r.id_role
    AND ad.date_debut = r.date_debut
);

WITH procedure_seed AS (
  SELECT
    pidx AS proc_idx,
    'DOS-' || lpad((((pidx - 1) % 1500) + 1)::text, 6, '0') AS dossier_reference,
    CASE
      WHEN ((pidx - 1) % 3) + 1 = 1 THEN 'Prud''hommes'
      WHEN ((pidx - 1) % 3) + 1 = 2 THEN 'Appel'
      ELSE 'Refere'
    END AS type_procedure_libelle,
    CASE
      WHEN ((pidx - 1) % 3) + 1 = 1 THEN 'Initiee'
      WHEN ((pidx - 1) % 3) + 1 = 2 THEN 'En cours'
      ELSE 'Terminee'
    END AS statut_procedure_libelle,
    DATE '2023-02-01' + (pidx % 365) AS date_debut
  FROM generate_series(1, 3000) AS pidx
),
procedure_map AS (
  SELECT
    ps.proc_idx,
    MIN(p.id) AS id_procedure
  FROM procedure_seed ps
  JOIN dossier d ON d.reference = ps.dossier_reference
  JOIN type_procedure tp ON tp.libelle = ps.type_procedure_libelle
  JOIN statut_procedure sp ON sp.libelle = ps.statut_procedure_libelle
  JOIN procedure p
    ON p.id_dossier = d.id
   AND p.id_type_procedure = tp.id
   AND p.id_statut_procedure = sp.id
   AND p.date_debut = ps.date_debut
  GROUP BY ps.proc_idx
),
generated AS (
  SELECT
    g,
    'user' || (((g - 1) % 200) + 1) || '@cabinet.fr' AS collaborateur_email,
    ((g - 1) % 3000) + 1 AS proc_idx,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Responsable'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'Second'
      ELSE 'Redacteur'
    END AS role_libelle,
    DATE '2023-01-01' + (g % 365) AS date_debut
  FROM generate_series(1, 6000) AS g
),
resolved AS (
  SELECT
    c.id AS id_collaborateur,
    pm.id_procedure,
    ra.id AS id_role,
    g.date_debut
  FROM generated g
  JOIN collaborateur c ON c.email = g.collaborateur_email
  JOIN procedure_map pm ON pm.proc_idx = g.proc_idx
  JOIN role_affectation ra ON ra.libelle = g.role_libelle
)
INSERT INTO affectation_procedure (
  id_collaborateur,
  id_procedure,
  id_role,
  date_debut
)
SELECT
  r.id_collaborateur,
  r.id_procedure,
  r.id_role,
  r.date_debut
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM affectation_procedure ap
  WHERE ap.id_collaborateur = r.id_collaborateur
    AND ap.id_procedure = r.id_procedure
    AND ap.id_role = r.id_role
    AND ap.date_debut = r.date_debut
);

-- =========================================================
-- L. SCENARIO 1: DOSSIER TENTACULAIRE
-- =========================================================

INSERT INTO client (
  id_agence,
  id_collaborateur_responsable,
  nom,
  prenom,
  email,
  telephone
)
SELECT
  a.id,
  c.id,
  'Societe Orion',
  NULL,
  'contact@orion.fr',
  '0188888888'
FROM agence a
LEFT JOIN collaborateur c ON c.email = 'user1@cabinet.fr'
WHERE a.nom = 'Agence 1'
  AND NOT EXISTS (
    SELECT 1
    FROM client cl
    WHERE cl.email = 'contact@orion.fr'
  );

INSERT INTO dossier (
  id_agence,
  id_client,
  id_type_dossier,
  id_statut_dossier,
  reference,
  date_ouverture
)
SELECT
  a.id,
  cl.id,
  td.id,
  sd.id,
  'DOS-TENTACULAIRE-001',
  DATE '2024-01-10'
FROM agence a
JOIN client cl ON cl.email = 'contact@orion.fr'
JOIN type_dossier td ON td.libelle = 'Contentieux'
JOIN statut_dossier sd ON sd.libelle = 'En cours'
WHERE a.nom = 'Agence 1'
  AND NOT EXISTS (
    SELECT 1
    FROM dossier d
    WHERE d.reference = 'DOS-TENTACULAIRE-001'
  );

WITH generated AS (
  SELECT
    g,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Prud''hommes'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'Appel'
      ELSE 'Refere'
    END AS type_procedure_libelle,
    'En cours' AS statut_procedure_libelle,
    DATE '2024-01-15' + (g * 5) AS date_debut
  FROM generate_series(1, 8) AS g
),
resolved AS (
  SELECT
    d.id AS id_dossier,
    tp.id AS id_type_procedure,
    sp.id AS id_statut_procedure,
    g.date_debut
  FROM generated g
  JOIN dossier d ON d.reference = 'DOS-TENTACULAIRE-001'
  JOIN type_procedure tp ON tp.libelle = g.type_procedure_libelle
  JOIN statut_procedure sp ON sp.libelle = g.statut_procedure_libelle
)
INSERT INTO procedure (
  id_dossier,
  id_type_procedure,
  id_statut_procedure,
  date_debut
)
SELECT
  r.id_dossier,
  r.id_type_procedure,
  r.id_statut_procedure,
  r.date_debut
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM procedure p
  WHERE p.id_dossier = r.id_dossier
    AND p.id_type_procedure = r.id_type_procedure
    AND p.id_statut_procedure = r.id_statut_procedure
    AND p.date_debut = r.date_debut
);

WITH proc_base AS (
  SELECT
    p.id,
    row_number() OVER (ORDER BY p.date_debut, p.id) AS rn
  FROM procedure p
  JOIN dossier d ON d.id = p.id_dossier
  WHERE d.reference = 'DOS-TENTACULAIRE-001'
),
generated AS (
  SELECT
    g,
    ((g - 1) % 8) + 1 AS proc_rn,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Audience conciliation'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'Audience jugement'
      ELSE 'Audience mise en etat'
    END AS type_instance_libelle,
    'Active' AS statut_instance_libelle,
    DATE '2024-02-01' + (g * 3) AS date_debut
  FROM generate_series(1, 25) AS g
),
resolved AS (
  SELECT
    pb.id AS id_procedure,
    ti.id AS id_type_instance,
    si.id AS id_statut_instance,
    g.date_debut
  FROM generated g
  JOIN proc_base pb ON pb.rn = g.proc_rn
  JOIN type_instance ti ON ti.libelle = g.type_instance_libelle
  JOIN statut_instance si ON si.libelle = g.statut_instance_libelle
)
INSERT INTO instance_juridique (
  id_procedure,
  id_type_instance,
  id_statut_instance,
  date_debut
)
SELECT
  r.id_procedure,
  r.id_type_instance,
  r.id_statut_instance,
  r.date_debut
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM instance_juridique ij
  WHERE ij.id_procedure = r.id_procedure
    AND ij.id_type_instance = r.id_type_instance
    AND ij.id_statut_instance = r.id_statut_instance
    AND ij.date_debut = r.date_debut
);

WITH inst_base AS (
  SELECT
    ij.id,
    row_number() OVER (ORDER BY ij.date_debut, ij.id) AS rn
  FROM instance_juridique ij
  JOIN procedure p ON p.id = ij.id_procedure
  JOIN dossier d ON d.id = p.id_dossier
  WHERE d.reference = 'DOS-TENTACULAIRE-001'
),
generated AS (
  SELECT
    g,
    ((g - 1) % 25) + 1 AS inst_rn,
    DATE '2024-03-01' + g AS date_audience,
    'Audience ' || g || ' du dossier tentaculaire' AS commentaire
  FROM generate_series(1, 40) AS g
)
INSERT INTO audience (id_instance, date_audience, commentaire)
SELECT
  ib.id,
  g.date_audience,
  g.commentaire
FROM generated g
JOIN inst_base ib ON ib.rn = g.inst_rn
WHERE NOT EXISTS (
  SELECT 1
  FROM audience a
  WHERE a.commentaire = g.commentaire
);

WITH generated AS (
  SELECT
    g,
    'user' || g || '@cabinet.fr' AS collaborateur_email,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Responsable'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'Second'
      ELSE 'Redacteur'
    END AS role_libelle,
    DATE '2024-01-10' AS date_debut
  FROM generate_series(1, 12) AS g
),
resolved AS (
  SELECT
    c.id AS id_collaborateur,
    d.id AS id_dossier,
    ra.id AS id_role,
    g.date_debut
  FROM generated g
  JOIN collaborateur c ON c.email = g.collaborateur_email
  JOIN dossier d ON d.reference = 'DOS-TENTACULAIRE-001'
  JOIN role_affectation ra ON ra.libelle = g.role_libelle
)
INSERT INTO affectation_dossier (
  id_collaborateur,
  id_dossier,
  id_role,
  date_debut
)
SELECT
  r.id_collaborateur,
  r.id_dossier,
  r.id_role,
  r.date_debut
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM affectation_dossier ad
  WHERE ad.id_collaborateur = r.id_collaborateur
    AND ad.id_dossier = r.id_dossier
    AND ad.id_role = r.id_role
    AND ad.date_debut = r.date_debut
);

WITH inst_base AS (
  SELECT
    ij.id,
    row_number() OVER (ORDER BY ij.date_debut, ij.id) AS rn
  FROM instance_juridique ij
  JOIN procedure p ON p.id = ij.id_procedure
  JOIN dossier d ON d.id = p.id_dossier
  WHERE d.reference = 'DOS-TENTACULAIRE-001'
),
generated AS (
  SELECT
    g,
    ((g - 1) % 25) + 1 AS inst_rn,
    CASE
      WHEN ((g - 1) % 4) + 1 = 1 THEN 'Assignation'
      WHEN ((g - 1) % 4) + 1 = 2 THEN 'Conclusions'
      WHEN ((g - 1) % 4) + 1 = 3 THEN 'Courrier'
      ELSE 'Note interne'
    END AS type_document_libelle,
    'user' || (((g - 1) % 12) + 1) || '@cabinet.fr' AS auteur_email,
    '/docs/tentaculaire/doc_' || g || '.pdf' AS chemin_fichier,
    NOW() - (g || ' minutes')::interval AS date_creation
  FROM generate_series(1, 120) AS g
),
resolved AS (
  SELECT
    td.id AS id_type_document,
    ib.id AS id_instance,
    c.id AS id_auteur,
    g.chemin_fichier,
    g.date_creation
  FROM generated g
  JOIN inst_base ib ON ib.rn = g.inst_rn
  JOIN type_document td ON td.libelle = g.type_document_libelle
  JOIN collaborateur c ON c.email = g.auteur_email
)
INSERT INTO document (
  id_type_document,
  id_instance,
  auteur,
  chemin_fichier,
  date_creation
)
SELECT
  r.id_type_document,
  r.id_instance,
  r.id_auteur,
  r.chemin_fichier,
  r.date_creation
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM document d
  WHERE d.chemin_fichier = r.chemin_fichier
);

-- =========================================================
-- M. SCENARIO 2: CONFLIT INTER-AGENCES
-- =========================================================

WITH generated AS (
  SELECT *
  FROM (
    VALUES
      ('DOS-CONFLIT-PARIS', 'Agence 1', 'client1@mail.com', DATE '2024-02-01'),
      ('DOS-CONFLIT-LYON', 'Agence 2', 'client3@mail.com', DATE '2024-02-05'),
      ('DOS-CONFLIT-NANTES', 'Agence 3', 'client4@mail.com', DATE '2024-02-10')
  ) AS v(reference, agence_nom, client_email, date_ouverture)
),
resolved AS (
  SELECT
    g.reference,
    g.date_ouverture,
    a.id AS id_agence,
    c.id AS id_client,
    td.id AS id_type_dossier,
    sd.id AS id_statut_dossier
  FROM generated g
  JOIN agence a ON a.nom = g.agence_nom
  JOIN client c ON c.email = g.client_email
  JOIN type_dossier td ON td.libelle = 'Contentieux'
  JOIN statut_dossier sd ON sd.libelle = 'Ouvert'
)
INSERT INTO dossier (
  id_agence,
  id_client,
  id_type_dossier,
  id_statut_dossier,
  reference,
  date_ouverture
)
SELECT
  r.id_agence,
  r.id_client,
  r.id_type_dossier,
  r.id_statut_dossier,
  r.reference,
  r.date_ouverture
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM dossier d
  WHERE d.reference = r.reference
);

WITH generated AS (
  SELECT *
  FROM (
    VALUES
      ('DOS-CONFLIT-PARIS', DATE '2024-02-15'),
      ('DOS-CONFLIT-LYON', DATE '2024-02-16'),
      ('DOS-CONFLIT-NANTES', DATE '2024-02-17')
  ) AS v(reference, date_debut)
),
resolved AS (
  SELECT
    d.id AS id_dossier,
    tp.id AS id_type_procedure,
    sp.id AS id_statut_procedure,
    g.date_debut
  FROM generated g
  JOIN dossier d ON d.reference = g.reference
  JOIN type_procedure tp ON tp.libelle = 'Prud''hommes'
  JOIN statut_procedure sp ON sp.libelle = 'Initiee'
)
INSERT INTO procedure (
  id_dossier,
  id_type_procedure,
  id_statut_procedure,
  date_debut
)
SELECT
  r.id_dossier,
  r.id_type_procedure,
  r.id_statut_procedure,
  r.date_debut
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM procedure p
  WHERE p.id_dossier = r.id_dossier
    AND p.id_type_procedure = r.id_type_procedure
    AND p.id_statut_procedure = r.id_statut_procedure
    AND p.date_debut = r.date_debut
);

WITH procedure_base AS (
  SELECT
    d.reference,
    MIN(p.id) AS id_procedure
  FROM dossier d
  JOIN procedure p ON p.id_dossier = d.id
  WHERE d.reference IN ('DOS-CONFLIT-PARIS', 'DOS-CONFLIT-LYON', 'DOS-CONFLIT-NANTES')
  GROUP BY d.reference
),
generated AS (
  SELECT *
  FROM (
    VALUES
      ('DOS-CONFLIT-PARIS', DATE '2024-03-01'),
      ('DOS-CONFLIT-LYON', DATE '2024-03-02'),
      ('DOS-CONFLIT-NANTES', DATE '2024-03-03')
  ) AS v(reference, date_debut)
),
resolved AS (
  SELECT
    pb.id_procedure,
    ti.id AS id_type_instance,
    si.id AS id_statut_instance,
    g.date_debut
  FROM generated g
  JOIN procedure_base pb ON pb.reference = g.reference
  JOIN type_instance ti ON ti.libelle = 'Audience conciliation'
  JOIN statut_instance si ON si.libelle = 'Active'
)
INSERT INTO instance_juridique (
  id_procedure,
  id_type_instance,
  id_statut_instance,
  date_debut
)
SELECT
  r.id_procedure,
  r.id_type_instance,
  r.id_statut_instance,
  r.date_debut
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM instance_juridique ij
  WHERE ij.id_procedure = r.id_procedure
    AND ij.id_type_instance = r.id_type_instance
    AND ij.id_statut_instance = r.id_statut_instance
    AND ij.date_debut = r.date_debut
);

WITH generated AS (
  SELECT *
  FROM (
    VALUES
      ('user3@cabinet.fr', 'DOS-CONFLIT-PARIS', 'Responsable', DATE '2024-02-10'),
      ('user5@cabinet.fr', 'DOS-CONFLIT-PARIS', 'Redacteur', DATE '2024-02-12'),
      ('user2@cabinet.fr', 'DOS-CONFLIT-LYON', 'Responsable', DATE '2024-02-11'),
      ('user5@cabinet.fr', 'DOS-CONFLIT-LYON', 'Redacteur', DATE '2024-02-13'),
      ('user2@cabinet.fr', 'DOS-CONFLIT-NANTES', 'Responsable', DATE '2024-02-14'),
      ('user3@cabinet.fr', 'DOS-CONFLIT-NANTES', 'Redacteur', DATE '2024-02-15')
  ) AS v(collaborateur_email, dossier_reference, role_libelle, date_debut)
),
resolved AS (
  SELECT
    c.id AS id_collaborateur,
    d.id AS id_dossier,
    ra.id AS id_role,
    g.date_debut
  FROM generated g
  JOIN collaborateur c ON c.email = g.collaborateur_email
  JOIN dossier d ON d.reference = g.dossier_reference
  JOIN role_affectation ra ON ra.libelle = g.role_libelle
)
INSERT INTO affectation_dossier (
  id_collaborateur,
  id_dossier,
  id_role,
  date_debut
)
SELECT
  r.id_collaborateur,
  r.id_dossier,
  r.id_role,
  r.date_debut
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM affectation_dossier ad
  WHERE ad.id_collaborateur = r.id_collaborateur
    AND ad.id_dossier = r.id_dossier
    AND ad.id_role = r.id_role
    AND ad.date_debut = r.date_debut
);

-- =========================================================
-- N. SCENARIO 3: CLIENT ALPHA MULTI-DOSSIERS
-- =========================================================

INSERT INTO client (
  id_agence,
  id_collaborateur_responsable,
  nom,
  prenom,
  email,
  telephone
)
SELECT
  a.id,
  c.id,
  'Entreprise Alpha',
  NULL,
  'contact@alpha.fr',
  '0144556677'
FROM agence a
LEFT JOIN collaborateur c ON c.email = 'user3@cabinet.fr'
WHERE a.nom = 'Agence 2'
  AND NOT EXISTS (
    SELECT 1
    FROM client cl
    WHERE cl.email = 'contact@alpha.fr'
  );

WITH generated AS (
  SELECT
    g,
    'DOS-ALPHA-' || g AS reference,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Contentieux'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'Conseil'
      ELSE 'Transaction'
    END AS type_dossier_libelle,
    DATE '2024-01-01' + (g * 3) AS date_ouverture
  FROM generate_series(1, 5) AS g
),
resolved AS (
  SELECT
    g.reference,
    a.id AS id_agence,
    cl.id AS id_client,
    td.id AS id_type_dossier,
    sd.id AS id_statut_dossier,
    g.date_ouverture
  FROM generated g
  JOIN agence a ON a.nom = 'Agence 2'
  JOIN client cl ON cl.email = 'contact@alpha.fr'
  JOIN type_dossier td ON td.libelle = g.type_dossier_libelle
  JOIN statut_dossier sd ON sd.libelle = 'Ouvert'
)
INSERT INTO dossier (
  id_agence,
  id_client,
  id_type_dossier,
  id_statut_dossier,
  reference,
  date_ouverture
)
SELECT
  r.id_agence,
  r.id_client,
  r.id_type_dossier,
  r.id_statut_dossier,
  r.reference,
  r.date_ouverture
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM dossier d
  WHERE d.reference = r.reference
);

WITH generated AS (
  SELECT
    g,
    'DOS-ALPHA-' || (((g - 1) % 5) + 1) AS dossier_reference,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Prud''hommes'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'Appel'
      ELSE 'Refere'
    END AS type_procedure_libelle,
    'En cours' AS statut_procedure_libelle,
    DATE '2024-02-01' + (g * 2) AS date_debut
  FROM generate_series(1, 12) AS g
),
resolved AS (
  SELECT
    d.id AS id_dossier,
    tp.id AS id_type_procedure,
    sp.id AS id_statut_procedure,
    g.date_debut
  FROM generated g
  JOIN dossier d ON d.reference = g.dossier_reference
  JOIN type_procedure tp ON tp.libelle = g.type_procedure_libelle
  JOIN statut_procedure sp ON sp.libelle = g.statut_procedure_libelle
)
INSERT INTO procedure (
  id_dossier,
  id_type_procedure,
  id_statut_procedure,
  date_debut
)
SELECT
  r.id_dossier,
  r.id_type_procedure,
  r.id_statut_procedure,
  r.date_debut
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM procedure p
  WHERE p.id_dossier = r.id_dossier
    AND p.id_type_procedure = r.id_type_procedure
    AND p.id_statut_procedure = r.id_statut_procedure
    AND p.date_debut = r.date_debut
);

WITH procedure_base AS (
  SELECT
    p.id,
    row_number() OVER (ORDER BY d.reference, p.date_debut, p.id) AS rn
  FROM procedure p
  JOIN dossier d ON d.id = p.id_dossier
  WHERE d.reference LIKE 'DOS-ALPHA-%'
),
generated AS (
  SELECT
    g,
    ((g - 1) % 12) + 1 AS proc_rn,
    CASE
      WHEN ((g - 1) % 3) + 1 = 1 THEN 'Audience conciliation'
      WHEN ((g - 1) % 3) + 1 = 2 THEN 'Audience jugement'
      ELSE 'Audience mise en etat'
    END AS type_instance_libelle,
    'Active' AS statut_instance_libelle,
    DATE '2024-03-01' + g AS date_debut
  FROM generate_series(1, 30) AS g
),
resolved AS (
  SELECT
    pb.id AS id_procedure,
    ti.id AS id_type_instance,
    si.id AS id_statut_instance,
    g.date_debut
  FROM generated g
  JOIN procedure_base pb ON pb.rn = g.proc_rn
  JOIN type_instance ti ON ti.libelle = g.type_instance_libelle
  JOIN statut_instance si ON si.libelle = g.statut_instance_libelle
)
INSERT INTO instance_juridique (
  id_procedure,
  id_type_instance,
  id_statut_instance,
  date_debut
)
SELECT
  r.id_procedure,
  r.id_type_instance,
  r.id_statut_instance,
  r.date_debut
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM instance_juridique ij
  WHERE ij.id_procedure = r.id_procedure
    AND ij.id_type_instance = r.id_type_instance
    AND ij.id_statut_instance = r.id_statut_instance
    AND ij.date_debut = r.date_debut
);

WITH procedure_base AS (
  SELECT
    p.id,
    row_number() OVER (ORDER BY d.reference, p.date_debut, p.id) AS rn
  FROM procedure p
  JOIN dossier d ON d.id = p.id_dossier
  WHERE d.reference LIKE 'DOS-ALPHA-%'
),
generated AS (
  SELECT
    g,
    ((g - 1) % 12) + 1 AS proc_rn,
    CASE
      WHEN ((g - 1) % 4) + 1 = 1 THEN 'Assignation'
      WHEN ((g - 1) % 4) + 1 = 2 THEN 'Conclusions'
      WHEN ((g - 1) % 4) + 1 = 3 THEN 'Courrier'
      ELSE 'Note interne'
    END AS type_document_libelle,
    'user' || (((g - 1) % 200) + 1) || '@cabinet.fr' AS auteur_email,
    '/docs/alpha/doc_' || g || '.pdf' AS chemin_fichier,
    NOW() - (g || ' minutes')::interval AS date_creation
  FROM generate_series(1, 80) AS g
),
resolved AS (
  SELECT
    td.id AS id_type_document,
    pb.id AS id_procedure,
    c.id AS id_auteur,
    g.chemin_fichier,
    g.date_creation
  FROM generated g
  JOIN procedure_base pb ON pb.rn = g.proc_rn
  JOIN type_document td ON td.libelle = g.type_document_libelle
  JOIN collaborateur c ON c.email = g.auteur_email
)
INSERT INTO document (
  id_type_document,
  id_procedure,
  auteur,
  chemin_fichier,
  date_creation
)
SELECT
  r.id_type_document,
  r.id_procedure,
  r.id_auteur,
  r.chemin_fichier,
  r.date_creation
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM document d
  WHERE d.chemin_fichier = r.chemin_fichier
);

COMMIT;
