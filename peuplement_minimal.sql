-- Script de peuplement minimal idempotent (tests e2e / smoke)
-- Compatible avec schema_complet.sql

BEGIN;

-- =========================================================
-- A. REFERENTIELS
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
  SELECT 1 FROM profil p WHERE p.libelle = v.libelle
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
  SELECT 1 FROM metier m WHERE m.libelle = v.libelle
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
  SELECT 1 FROM type_dossier td WHERE td.libelle = v.libelle
);

INSERT INTO statut_dossier (libelle)
SELECT v.libelle
FROM (
  VALUES
    ('Ouvert'),
    ('En cours'),
    ('Clos')
) AS v(libelle)
WHERE NOT EXISTS (
  SELECT 1 FROM statut_dossier sd WHERE sd.libelle = v.libelle
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
  SELECT 1 FROM type_procedure tp WHERE tp.libelle = v.libelle
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
  SELECT 1 FROM statut_procedure sp WHERE sp.libelle = v.libelle
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
  SELECT 1 FROM type_instance ti WHERE ti.libelle = v.libelle
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
  SELECT 1 FROM statut_instance si WHERE si.libelle = v.libelle
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
  SELECT 1 FROM type_document td WHERE td.libelle = v.libelle
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
  SELECT 1 FROM role_affectation ra WHERE ra.libelle = v.libelle
);

-- =========================================================
-- B. AGENCES + COLLABORATEURS + PROFILS
-- =========================================================

INSERT INTO agence (nom, adresse, ville, code_postal)
SELECT v.nom, v.adresse, v.ville, v.code_postal
FROM (
  VALUES
    ('Agence 1', '1 rue Exemple', 'Paris', '75001'),
    ('Agence 2', '2 rue Exemple', 'Lyon', '69001')
) AS v(nom, adresse, ville, code_postal)
WHERE NOT EXISTS (
  SELECT 1
  FROM agence a
  WHERE a.nom = v.nom
);

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('user.min1@cabinet.fr', 'Minot', 'Alice', 'Avocat', 'Agence 1', '0601000001', DATE '2026-01-02', 'Administrateur agence'),
      ('user.min2@cabinet.fr', 'Petit', 'Bob', 'Juriste', 'Agence 2', '0601000002', DATE '2026-01-03', 'Collaborateur')
  ) AS v(email, nom, prenom, metier_libelle, agence_nom, telephone, date_entree, profil_libelle)
),
resolved AS (
  SELECT
    s.email,
    s.nom,
    s.prenom,
    s.telephone,
    s.date_entree,
    s.profil_libelle,
    a.id AS id_agence,
    m.id AS id_metier
  FROM source_rows s
  JOIN agence a ON a.nom = s.agence_nom
  JOIN metier m ON m.libelle = s.metier_libelle
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

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('user.min1@cabinet.fr', 'Administrateur agence'),
      ('user.min2@cabinet.fr', 'Collaborateur')
  ) AS v(email, profil_libelle)
)
INSERT INTO collaborateur_profil (id_collaborateur, id_profil)
SELECT c.id, p.id
FROM source_rows s
JOIN collaborateur c ON c.email = s.email
JOIN profil p ON p.libelle = s.profil_libelle
ON CONFLICT (id_collaborateur, id_profil) DO NOTHING;

-- =========================================================
-- C. CLIENTS + DOSSIERS + FACTURES
-- =========================================================

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('client.min1@mail.com', 'Durand', 'Eve', '0612000001', 'Agence 1', 'user.min1@cabinet.fr'),
      ('client.min2@mail.com', 'Martin', 'Leo', '0612000002', 'Agence 2', 'user.min2@cabinet.fr')
  ) AS v(email, nom, prenom, telephone, agence_nom, responsable_email)
),
resolved AS (
  SELECT
    s.email,
    s.nom,
    s.prenom,
    s.telephone,
    a.id AS id_agence,
    c.id AS id_collaborateur_responsable
  FROM source_rows s
  JOIN agence a ON a.nom = s.agence_nom
  LEFT JOIN collaborateur c ON c.email = s.responsable_email
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

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('DOS-MIN-0001', 'Agence 1', 'client.min1@mail.com', 'Contentieux', 'En cours', DATE '2026-02-01', NULL::date),
      ('DOS-MIN-0002', 'Agence 2', 'client.min2@mail.com', 'Conseil', 'Ouvert', DATE '2026-02-05', NULL::date)
  ) AS v(reference, agence_nom, client_email, type_libelle, statut_libelle, date_ouverture, date_cloture)
),
resolved AS (
  SELECT
    s.reference,
    s.date_ouverture,
    s.date_cloture,
    a.id AS id_agence,
    c.id AS id_client,
    td.id AS id_type_dossier,
    sd.id AS id_statut_dossier
  FROM source_rows s
  JOIN agence a ON a.nom = s.agence_nom
  JOIN client c ON c.email = s.client_email
  JOIN type_dossier td ON td.libelle = s.type_libelle
  JOIN statut_dossier sd ON sd.libelle = s.statut_libelle
)
INSERT INTO dossier (
  id_agence,
  id_client,
  id_type_dossier,
  id_statut_dossier,
  reference,
  date_ouverture,
  date_cloture
)
SELECT
  r.id_agence,
  r.id_client,
  r.id_type_dossier,
  r.id_statut_dossier,
  r.reference,
  r.date_ouverture,
  r.date_cloture
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM dossier d
  WHERE d.reference = r.reference
);

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('DOS-MIN-0001', 850.00, DATE '2026-02-10', 'Brouillon'),
      ('DOS-MIN-0002', 1200.00, DATE '2026-02-12', 'Emise')
  ) AS v(dossier_reference, montant, date_emission, statut)
),
resolved AS (
  SELECT d.id AS id_dossier, s.montant, s.date_emission, s.statut
  FROM source_rows s
  JOIN dossier d ON d.reference = s.dossier_reference
)
INSERT INTO facture (id_dossier, montant, date_emission, statut)
SELECT r.id_dossier, r.montant, r.date_emission, r.statut
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM facture f
  WHERE f.id_dossier = r.id_dossier
    AND f.date_emission = r.date_emission
    AND f.montant = r.montant
);

-- =========================================================
-- D. PROCEDURES + INSTANCES + AUDIENCES
-- =========================================================

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('PR-MIN-001', 'DOS-MIN-0001', 'Prud''hommes', 'En cours', DATE '2026-02-11'),
      ('PR-MIN-002', 'DOS-MIN-0002', 'Refere', 'Initiee', DATE '2026-02-13')
  ) AS v(code, dossier_reference, type_libelle, statut_libelle, date_debut)
),
resolved AS (
  SELECT
    s.code,
    d.id AS id_dossier,
    tp.id AS id_type_procedure,
    sp.id AS id_statut_procedure,
    s.date_debut
  FROM source_rows s
  JOIN dossier d ON d.reference = s.dossier_reference
  JOIN type_procedure tp ON tp.libelle = s.type_libelle
  JOIN statut_procedure sp ON sp.libelle = s.statut_libelle
)
INSERT INTO procedure (id_dossier, id_type_procedure, id_statut_procedure, date_debut)
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

WITH procedure_source AS (
  SELECT *
  FROM (
    VALUES
      ('PR-MIN-001', 'DOS-MIN-0001', 'Prud''hommes', 'En cours', DATE '2026-02-11'),
      ('PR-MIN-002', 'DOS-MIN-0002', 'Refere', 'Initiee', DATE '2026-02-13')
  ) AS v(code, dossier_reference, type_libelle, statut_libelle, date_debut)
),
procedure_map AS (
  SELECT
    s.code,
    MIN(p.id) AS id_procedure
  FROM procedure_source s
  JOIN dossier d ON d.reference = s.dossier_reference
  JOIN type_procedure tp ON tp.libelle = s.type_libelle
  JOIN statut_procedure sp ON sp.libelle = s.statut_libelle
  JOIN procedure p
    ON p.id_dossier = d.id
   AND p.id_type_procedure = tp.id
   AND p.id_statut_procedure = sp.id
   AND p.date_debut = s.date_debut
  GROUP BY s.code
),
instance_source AS (
  SELECT *
  FROM (
    VALUES
      ('IN-MIN-001', 'PR-MIN-001', 'Audience conciliation', 'Active', DATE '2026-02-18'),
      ('IN-MIN-002', 'PR-MIN-002', 'Audience jugement', 'Active', DATE '2026-02-20')
  ) AS v(code, procedure_code, type_libelle, statut_libelle, date_debut)
),
resolved AS (
  SELECT
    i.code,
    pm.id_procedure,
    ti.id AS id_type_instance,
    si.id AS id_statut_instance,
    i.date_debut
  FROM instance_source i
  JOIN procedure_map pm ON pm.code = i.procedure_code
  JOIN type_instance ti ON ti.libelle = i.type_libelle
  JOIN statut_instance si ON si.libelle = i.statut_libelle
)
INSERT INTO instance_juridique (id_procedure, id_type_instance, id_statut_instance, date_debut)
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

WITH procedure_source AS (
  SELECT *
  FROM (
    VALUES
      ('PR-MIN-001', 'DOS-MIN-0001', 'Prud''hommes', 'En cours', DATE '2026-02-11'),
      ('PR-MIN-002', 'DOS-MIN-0002', 'Refere', 'Initiee', DATE '2026-02-13')
  ) AS v(code, dossier_reference, type_libelle, statut_libelle, date_debut)
),
procedure_map AS (
  SELECT
    s.code,
    MIN(p.id) AS id_procedure
  FROM procedure_source s
  JOIN dossier d ON d.reference = s.dossier_reference
  JOIN type_procedure tp ON tp.libelle = s.type_libelle
  JOIN statut_procedure sp ON sp.libelle = s.statut_libelle
  JOIN procedure p
    ON p.id_dossier = d.id
   AND p.id_type_procedure = tp.id
   AND p.id_statut_procedure = sp.id
   AND p.date_debut = s.date_debut
  GROUP BY s.code
),
instance_source AS (
  SELECT *
  FROM (
    VALUES
      ('IN-MIN-001', 'PR-MIN-001', 'Audience conciliation', 'Active', DATE '2026-02-18'),
      ('IN-MIN-002', 'PR-MIN-002', 'Audience jugement', 'Active', DATE '2026-02-20')
  ) AS v(code, procedure_code, type_libelle, statut_libelle, date_debut)
),
instance_map AS (
  SELECT
    i.code,
    MIN(ij.id) AS id_instance
  FROM instance_source i
  JOIN procedure_map pm ON pm.code = i.procedure_code
  JOIN type_instance ti ON ti.libelle = i.type_libelle
  JOIN statut_instance si ON si.libelle = i.statut_libelle
  JOIN instance_juridique ij
    ON ij.id_procedure = pm.id_procedure
   AND ij.id_type_instance = ti.id
   AND ij.id_statut_instance = si.id
   AND ij.date_debut = i.date_debut
  GROUP BY i.code
),
audience_source AS (
  SELECT *
  FROM (
    VALUES
      ('IN-MIN-001', DATE '2026-02-25', 'AUD-MIN-001 - audience initiale'),
      ('IN-MIN-002', DATE '2026-02-27', 'AUD-MIN-002 - audience suivi')
  ) AS v(instance_code, date_audience, commentaire)
)
INSERT INTO audience (id_instance, date_audience, commentaire)
SELECT im.id_instance, a.date_audience, a.commentaire
FROM audience_source a
JOIN instance_map im ON im.code = a.instance_code
WHERE NOT EXISTS (
  SELECT 1
  FROM audience au
  WHERE au.commentaire = a.commentaire
);

-- =========================================================
-- E. DOCUMENTS (CHECK parent unique respecte)
-- =========================================================

-- E1. Document dossier
WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('/docs/min/dossier_001.pdf', 'DOS-MIN-0001', 'Assignation', 'user.min1@cabinet.fr', TIMESTAMP '2026-02-21 09:00:00')
  ) AS v(chemin_fichier, dossier_reference, type_libelle, auteur_email, date_creation)
),
resolved AS (
  SELECT
    td.id AS id_type_document,
    d.id AS id_dossier,
    c.id AS id_auteur,
    s.chemin_fichier,
    s.date_creation
  FROM source_rows s
  JOIN dossier d ON d.reference = s.dossier_reference
  JOIN type_document td ON td.libelle = s.type_libelle
  JOIN collaborateur c ON c.email = s.auteur_email
)
INSERT INTO document (
  id_type_document,
  id_dossier,
  auteur,
  chemin_fichier,
  date_creation
)
SELECT
  r.id_type_document,
  r.id_dossier,
  r.id_auteur,
  r.chemin_fichier,
  r.date_creation
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1
  FROM document d
  WHERE d.chemin_fichier = r.chemin_fichier
);

-- E2. Document procedure
WITH procedure_source AS (
  SELECT *
  FROM (
    VALUES
      ('PR-MIN-001', 'DOS-MIN-0001', 'Prud''hommes', 'En cours', DATE '2026-02-11')
  ) AS v(code, dossier_reference, type_libelle, statut_libelle, date_debut)
),
procedure_map AS (
  SELECT
    s.code,
    MIN(p.id) AS id_procedure
  FROM procedure_source s
  JOIN dossier d ON d.reference = s.dossier_reference
  JOIN type_procedure tp ON tp.libelle = s.type_libelle
  JOIN statut_procedure sp ON sp.libelle = s.statut_libelle
  JOIN procedure p
    ON p.id_dossier = d.id
   AND p.id_type_procedure = tp.id
   AND p.id_statut_procedure = sp.id
   AND p.date_debut = s.date_debut
  GROUP BY s.code
),
source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('/docs/min/procedure_001.pdf', 'PR-MIN-001', 'Conclusions', 'user.min1@cabinet.fr', TIMESTAMP '2026-02-21 10:00:00')
  ) AS v(chemin_fichier, procedure_code, type_libelle, auteur_email, date_creation)
),
resolved AS (
  SELECT
    td.id AS id_type_document,
    pm.id_procedure,
    c.id AS id_auteur,
    s.chemin_fichier,
    s.date_creation
  FROM source_rows s
  JOIN procedure_map pm ON pm.code = s.procedure_code
  JOIN type_document td ON td.libelle = s.type_libelle
  JOIN collaborateur c ON c.email = s.auteur_email
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

-- E3. Document instance
WITH procedure_source AS (
  SELECT *
  FROM (
    VALUES
      ('PR-MIN-002', 'DOS-MIN-0002', 'Refere', 'Initiee', DATE '2026-02-13')
  ) AS v(code, dossier_reference, type_libelle, statut_libelle, date_debut)
),
procedure_map AS (
  SELECT
    s.code,
    MIN(p.id) AS id_procedure
  FROM procedure_source s
  JOIN dossier d ON d.reference = s.dossier_reference
  JOIN type_procedure tp ON tp.libelle = s.type_libelle
  JOIN statut_procedure sp ON sp.libelle = s.statut_libelle
  JOIN procedure p
    ON p.id_dossier = d.id
   AND p.id_type_procedure = tp.id
   AND p.id_statut_procedure = sp.id
   AND p.date_debut = s.date_debut
  GROUP BY s.code
),
instance_source AS (
  SELECT *
  FROM (
    VALUES
      ('IN-MIN-002', 'PR-MIN-002', 'Audience jugement', 'Active', DATE '2026-02-20')
  ) AS v(code, procedure_code, type_libelle, statut_libelle, date_debut)
),
instance_map AS (
  SELECT
    i.code,
    MIN(ij.id) AS id_instance
  FROM instance_source i
  JOIN procedure_map pm ON pm.code = i.procedure_code
  JOIN type_instance ti ON ti.libelle = i.type_libelle
  JOIN statut_instance si ON si.libelle = i.statut_libelle
  JOIN instance_juridique ij
    ON ij.id_procedure = pm.id_procedure
   AND ij.id_type_instance = ti.id
   AND ij.id_statut_instance = si.id
   AND ij.date_debut = i.date_debut
  GROUP BY i.code
),
source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('/docs/min/instance_001.pdf', 'IN-MIN-002', 'Note interne', 'user.min2@cabinet.fr', TIMESTAMP '2026-02-21 11:00:00')
  ) AS v(chemin_fichier, instance_code, type_libelle, auteur_email, date_creation)
),
resolved AS (
  SELECT
    td.id AS id_type_document,
    im.id_instance,
    c.id AS id_auteur,
    s.chemin_fichier,
    s.date_creation
  FROM source_rows s
  JOIN instance_map im ON im.code = s.instance_code
  JOIN type_document td ON td.libelle = s.type_libelle
  JOIN collaborateur c ON c.email = s.auteur_email
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
-- F. AFFECTATIONS
-- =========================================================

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('user.min1@cabinet.fr', 'DOS-MIN-0001', 'Responsable', DATE '2026-02-01'),
      ('user.min2@cabinet.fr', 'DOS-MIN-0002', 'Responsable', DATE '2026-02-05')
  ) AS v(collaborateur_email, dossier_reference, role_libelle, date_debut)
),
resolved AS (
  SELECT
    c.id AS id_collaborateur,
    d.id AS id_dossier,
    ra.id AS id_role,
    s.date_debut
  FROM source_rows s
  JOIN collaborateur c ON c.email = s.collaborateur_email
  JOIN dossier d ON d.reference = s.dossier_reference
  JOIN role_affectation ra ON ra.libelle = s.role_libelle
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

WITH procedure_source AS (
  SELECT *
  FROM (
    VALUES
      ('PR-MIN-001', 'DOS-MIN-0001', 'Prud''hommes', 'En cours', DATE '2026-02-11'),
      ('PR-MIN-002', 'DOS-MIN-0002', 'Refere', 'Initiee', DATE '2026-02-13')
  ) AS v(code, dossier_reference, type_libelle, statut_libelle, date_debut)
),
procedure_map AS (
  SELECT
    s.code,
    MIN(p.id) AS id_procedure
  FROM procedure_source s
  JOIN dossier d ON d.reference = s.dossier_reference
  JOIN type_procedure tp ON tp.libelle = s.type_libelle
  JOIN statut_procedure sp ON sp.libelle = s.statut_libelle
  JOIN procedure p
    ON p.id_dossier = d.id
   AND p.id_type_procedure = tp.id
   AND p.id_statut_procedure = sp.id
   AND p.date_debut = s.date_debut
  GROUP BY s.code
),
source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('user.min1@cabinet.fr', 'PR-MIN-001', 'Responsable', DATE '2026-02-11'),
      ('user.min2@cabinet.fr', 'PR-MIN-002', 'Second', DATE '2026-02-13')
  ) AS v(collaborateur_email, procedure_code, role_libelle, date_debut)
),
resolved AS (
  SELECT
    c.id AS id_collaborateur,
    pm.id_procedure,
    ra.id AS id_role,
    s.date_debut
  FROM source_rows s
  JOIN collaborateur c ON c.email = s.collaborateur_email
  JOIN procedure_map pm ON pm.code = s.procedure_code
  JOIN role_affectation ra ON ra.libelle = s.role_libelle
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

COMMIT;
