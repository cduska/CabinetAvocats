-- Script de peuplement rapide idempotent (dev / CI)
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

INSERT INTO agence (nom, adresse, ville, code_postal)
SELECT v.nom, v.adresse, v.ville, v.code_postal
FROM (
  VALUES
    ('Agence 1', '10 rue de Paris', 'Paris', '75001'),
    ('Agence 2', '22 avenue des Docks', 'Lyon', '69002'),
    ('Agence 3', '5 quai Atlantique', 'Nantes', '44000')
) AS v(nom, adresse, ville, code_postal)
WHERE NOT EXISTS (
  SELECT 1
  FROM agence a
  WHERE a.nom = v.nom
);

-- =========================================================
-- C. DOMAINES / SOUS-DOMAINES / SPECIALITES
-- =========================================================

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('Droit du travail', 'Licenciement'),
      ('Droit du travail', 'Harcelement'),
      ('Droit des affaires', 'Contrats commerciaux'),
      ('Droit penal', 'Infractions financieres')
  ) AS v(domaine_libelle, sous_domaine_libelle)
)
INSERT INTO sous_domaine (id_domaine, libelle)
SELECT dj.id, s.sous_domaine_libelle
FROM source_rows s
JOIN domaine_juridique dj ON dj.libelle = s.domaine_libelle
WHERE NOT EXISTS (
  SELECT 1
  FROM sous_domaine sd
  WHERE sd.id_domaine = dj.id
    AND sd.libelle = s.sous_domaine_libelle
);

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('Licenciement', 'Contentieux licenciement'),
      ('Harcelement', 'Contentieux harcelement'),
      ('Contrats commerciaux', 'Redaction contrats'),
      ('Infractions financieres', 'Droit penal des affaires')
  ) AS v(sous_domaine_libelle, specialite_libelle)
)
INSERT INTO specialite (id_sous_domaine, libelle)
SELECT sd.id, s.specialite_libelle
FROM source_rows s
JOIN sous_domaine sd ON sd.libelle = s.sous_domaine_libelle
WHERE NOT EXISTS (
  SELECT 1
  FROM specialite sp
  WHERE sp.id_sous_domaine = sd.id
    AND sp.libelle = s.specialite_libelle
);

-- =========================================================
-- D. COLLABORATEURS
-- =========================================================

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('user1@cabinet.fr', 'Martin', 'Claire', 'Avocat', 'Agence 1', '0600000001', DATE '2022-01-03'),
      ('user2@cabinet.fr', 'Dubois', 'Hugo', 'Juriste', 'Agence 1', '0600000002', DATE '2022-02-07'),
      ('user3@cabinet.fr', 'Perez', 'Lina', 'Avocat', 'Agence 2', '0600000003', DATE '2022-03-14'),
      ('user4@cabinet.fr', 'Roux', 'Nora', 'Assistant juridique', 'Agence 2', '0600000004', DATE '2022-04-11'),
      ('user5@cabinet.fr', 'Bernard', 'Leo', 'Avocat', 'Agence 3', '0600000005', DATE '2022-05-09'),
      ('user6@cabinet.fr', 'Faure', 'Jade', 'Juriste', 'Agence 3', '0600000006', DATE '2022-06-06'),
      ('user7@cabinet.fr', 'Noel', 'Sam', 'Assistant juridique', 'Agence 1', '0600000007', DATE '2022-07-04'),
      ('user8@cabinet.fr', 'Garnier', 'Iris', 'Avocat', 'Agence 2', '0600000008', DATE '2022-08-08')
  ) AS v(email, nom, prenom, metier_libelle, agence_nom, telephone, date_entree)
),
resolved AS (
  SELECT
    s.email,
    s.nom,
    s.prenom,
    s.telephone,
    s.date_entree,
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
      ('user1@cabinet.fr', 'Administrateur national'),
      ('user2@cabinet.fr', 'Administrateur agence'),
      ('user3@cabinet.fr', 'Administrateur agence'),
      ('user4@cabinet.fr', 'Collaborateur'),
      ('user5@cabinet.fr', 'Collaborateur'),
      ('user6@cabinet.fr', 'Collaborateur'),
      ('user7@cabinet.fr', 'Collaborateur'),
      ('user8@cabinet.fr', 'Collaborateur')
  ) AS v(email, profil_libelle)
)
INSERT INTO collaborateur_profil (id_collaborateur, id_profil)
SELECT c.id, p.id
FROM source_rows s
JOIN collaborateur c ON c.email = s.email
JOIN profil p ON p.libelle = s.profil_libelle
ON CONFLICT (id_collaborateur, id_profil) DO NOTHING;

-- =========================================================
-- E. CLIENTS
-- =========================================================

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('client.fast1@mail.com', 'Durand', 'Emma', '0611111111', 'Agence 1', 'user1@cabinet.fr'),
      ('client.fast2@mail.com', 'Leroy', 'Noah', '0611111112', 'Agence 1', 'user2@cabinet.fr'),
      ('client.fast3@mail.com', 'Moreau', 'Ines', '0611111113', 'Agence 2', 'user3@cabinet.fr'),
      ('client.fast4@mail.com', 'Simon', 'Malo', '0611111114', 'Agence 2', 'user4@cabinet.fr'),
      ('client.fast5@mail.com', 'Michel', 'Lina', '0611111115', 'Agence 3', 'user5@cabinet.fr'),
      ('client.fast6@mail.com', 'Garcia', 'Theo', '0611111116', 'Agence 3', 'user6@cabinet.fr'),
      ('client.fast7@mail.com', 'Renaud', 'Nina', '0611111117', 'Agence 1', 'user7@cabinet.fr'),
      ('client.fast8@mail.com', 'Petit', 'Ilyes', '0611111118', 'Agence 2', 'user8@cabinet.fr')
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

-- =========================================================
-- F. DOSSIERS
-- =========================================================

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('DOS-FAST-0001', 'Agence 1', 'client.fast1@mail.com', 'Contentieux', 'En cours', DATE '2026-01-10', NULL),
      ('DOS-FAST-0002', 'Agence 1', 'client.fast2@mail.com', 'Conseil', 'Ouvert', DATE '2026-01-14', NULL),
      ('DOS-FAST-0003', 'Agence 2', 'client.fast3@mail.com', 'Transaction', 'Ouvert', DATE '2026-01-20', NULL),
      ('DOS-FAST-0004', 'Agence 2', 'client.fast4@mail.com', 'Contentieux', 'Clos', DATE '2026-01-08', DATE '2026-02-20'),
      ('DOS-FAST-0005', 'Agence 3', 'client.fast5@mail.com', 'Contentieux', 'En cours', DATE '2026-02-02', NULL),
      ('DOS-FAST-0006', 'Agence 3', 'client.fast6@mail.com', 'Conseil', 'Ouvert', DATE '2026-02-08', NULL),
      ('DOS-FAST-0007', 'Agence 1', 'client.fast7@mail.com', 'Transaction', 'En cours', DATE '2026-02-12', NULL),
      ('DOS-FAST-0008', 'Agence 2', 'client.fast8@mail.com', 'Contentieux', 'Ouvert', DATE '2026-02-18', NULL)
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

-- =========================================================
-- G. FACTURES
-- =========================================================

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('DOS-FAST-0001', 1200.00, DATE '2026-01-21', 'Emise'),
      ('DOS-FAST-0002', 900.00, DATE '2026-01-28', 'Brouillon'),
      ('DOS-FAST-0003', 1500.00, DATE '2026-02-04', 'Emise'),
      ('DOS-FAST-0005', 2200.00, DATE '2026-02-16', 'Emise'),
      ('DOS-FAST-0006', 800.00, DATE '2026-02-20', 'Brouillon'),
      ('DOS-FAST-0008', 1750.00, DATE '2026-03-03', 'Emise')
  ) AS v(dossier_reference, montant, date_emission, statut)
),
resolved AS (
  SELECT
    d.id AS id_dossier,
    s.montant,
    s.date_emission,
    s.statut
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
-- H. PROCEDURES
-- =========================================================

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('PR-FAST-001', 'DOS-FAST-0001', 'Prud''hommes', 'En cours', DATE '2026-01-15'),
      ('PR-FAST-002', 'DOS-FAST-0001', 'Refere', 'Initiee', DATE '2026-01-18'),
      ('PR-FAST-003', 'DOS-FAST-0002', 'Appel', 'Initiee', DATE '2026-01-25'),
      ('PR-FAST-004', 'DOS-FAST-0003', 'Prud''hommes', 'En cours', DATE '2026-02-02'),
      ('PR-FAST-005', 'DOS-FAST-0004', 'Appel', 'Terminee', DATE '2026-01-12'),
      ('PR-FAST-006', 'DOS-FAST-0005', 'Refere', 'En cours', DATE '2026-02-10'),
      ('PR-FAST-007', 'DOS-FAST-0006', 'Prud''hommes', 'Initiee', DATE '2026-02-17'),
      ('PR-FAST-008', 'DOS-FAST-0007', 'Appel', 'En cours', DATE '2026-02-22'),
      ('PR-FAST-009', 'DOS-FAST-0008', 'Refere', 'Initiee', DATE '2026-02-25'),
      ('PR-FAST-010', 'DOS-FAST-0008', 'Prud''hommes', 'En cours', DATE '2026-03-01')
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

-- =========================================================
-- I. INSTANCES
-- =========================================================

WITH procedure_source AS (
  SELECT *
  FROM (
    VALUES
      ('PR-FAST-001', 'DOS-FAST-0001', 'Prud''hommes', 'En cours', DATE '2026-01-15'),
      ('PR-FAST-002', 'DOS-FAST-0001', 'Refere', 'Initiee', DATE '2026-01-18'),
      ('PR-FAST-003', 'DOS-FAST-0002', 'Appel', 'Initiee', DATE '2026-01-25'),
      ('PR-FAST-004', 'DOS-FAST-0003', 'Prud''hommes', 'En cours', DATE '2026-02-02'),
      ('PR-FAST-005', 'DOS-FAST-0004', 'Appel', 'Terminee', DATE '2026-01-12'),
      ('PR-FAST-006', 'DOS-FAST-0005', 'Refere', 'En cours', DATE '2026-02-10'),
      ('PR-FAST-007', 'DOS-FAST-0006', 'Prud''hommes', 'Initiee', DATE '2026-02-17'),
      ('PR-FAST-008', 'DOS-FAST-0007', 'Appel', 'En cours', DATE '2026-02-22'),
      ('PR-FAST-009', 'DOS-FAST-0008', 'Refere', 'Initiee', DATE '2026-02-25'),
      ('PR-FAST-010', 'DOS-FAST-0008', 'Prud''hommes', 'En cours', DATE '2026-03-01')
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
      ('IN-FAST-001', 'PR-FAST-001', 'Audience conciliation', 'Active', DATE '2026-01-22'),
      ('IN-FAST-002', 'PR-FAST-002', 'Audience jugement', 'Active', DATE '2026-01-29'),
      ('IN-FAST-003', 'PR-FAST-003', 'Audience mise en etat', 'Suspendue', DATE '2026-02-05'),
      ('IN-FAST-004', 'PR-FAST-004', 'Audience conciliation', 'Active', DATE '2026-02-11'),
      ('IN-FAST-005', 'PR-FAST-005', 'Audience jugement', 'Terminee', DATE '2026-02-16'),
      ('IN-FAST-006', 'PR-FAST-006', 'Audience mise en etat', 'Active', DATE '2026-02-20'),
      ('IN-FAST-007', 'PR-FAST-007', 'Audience conciliation', 'Active', DATE '2026-02-24'),
      ('IN-FAST-008', 'PR-FAST-008', 'Audience jugement', 'Suspendue', DATE '2026-03-03'),
      ('IN-FAST-009', 'PR-FAST-009', 'Audience mise en etat', 'Active', DATE '2026-03-07'),
      ('IN-FAST-010', 'PR-FAST-010', 'Audience conciliation', 'Active', DATE '2026-03-10'),
      ('IN-FAST-011', 'PR-FAST-006', 'Audience jugement', 'Active', DATE '2026-03-12'),
      ('IN-FAST-012', 'PR-FAST-004', 'Audience mise en etat', 'Active', DATE '2026-03-15')
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

-- =========================================================
-- J. AUDIENCES
-- =========================================================

WITH procedure_source AS (
  SELECT *
  FROM (
    VALUES
      ('PR-FAST-001', 'DOS-FAST-0001', 'Prud''hommes', 'En cours', DATE '2026-01-15'),
      ('PR-FAST-002', 'DOS-FAST-0001', 'Refere', 'Initiee', DATE '2026-01-18'),
      ('PR-FAST-003', 'DOS-FAST-0002', 'Appel', 'Initiee', DATE '2026-01-25'),
      ('PR-FAST-004', 'DOS-FAST-0003', 'Prud''hommes', 'En cours', DATE '2026-02-02'),
      ('PR-FAST-005', 'DOS-FAST-0004', 'Appel', 'Terminee', DATE '2026-01-12'),
      ('PR-FAST-006', 'DOS-FAST-0005', 'Refere', 'En cours', DATE '2026-02-10'),
      ('PR-FAST-007', 'DOS-FAST-0006', 'Prud''hommes', 'Initiee', DATE '2026-02-17'),
      ('PR-FAST-008', 'DOS-FAST-0007', 'Appel', 'En cours', DATE '2026-02-22'),
      ('PR-FAST-009', 'DOS-FAST-0008', 'Refere', 'Initiee', DATE '2026-02-25'),
      ('PR-FAST-010', 'DOS-FAST-0008', 'Prud''hommes', 'En cours', DATE '2026-03-01')
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
      ('IN-FAST-001', 'PR-FAST-001', 'Audience conciliation', 'Active', DATE '2026-01-22'),
      ('IN-FAST-002', 'PR-FAST-002', 'Audience jugement', 'Active', DATE '2026-01-29'),
      ('IN-FAST-003', 'PR-FAST-003', 'Audience mise en etat', 'Suspendue', DATE '2026-02-05'),
      ('IN-FAST-004', 'PR-FAST-004', 'Audience conciliation', 'Active', DATE '2026-02-11'),
      ('IN-FAST-005', 'PR-FAST-005', 'Audience jugement', 'Terminee', DATE '2026-02-16'),
      ('IN-FAST-006', 'PR-FAST-006', 'Audience mise en etat', 'Active', DATE '2026-02-20'),
      ('IN-FAST-007', 'PR-FAST-007', 'Audience conciliation', 'Active', DATE '2026-02-24'),
      ('IN-FAST-008', 'PR-FAST-008', 'Audience jugement', 'Suspendue', DATE '2026-03-03'),
      ('IN-FAST-009', 'PR-FAST-009', 'Audience mise en etat', 'Active', DATE '2026-03-07'),
      ('IN-FAST-010', 'PR-FAST-010', 'Audience conciliation', 'Active', DATE '2026-03-10'),
      ('IN-FAST-011', 'PR-FAST-006', 'Audience jugement', 'Active', DATE '2026-03-12'),
      ('IN-FAST-012', 'PR-FAST-004', 'Audience mise en etat', 'Active', DATE '2026-03-15')
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
      ('IN-FAST-001', DATE '2026-01-27', 'AUD-FAST-001 - suivi initial'),
      ('IN-FAST-002', DATE '2026-02-03', 'AUD-FAST-002 - premiere audience'),
      ('IN-FAST-003', DATE '2026-02-10', 'AUD-FAST-003 - mise en etat'),
      ('IN-FAST-004', DATE '2026-02-18', 'AUD-FAST-004 - conciliation'),
      ('IN-FAST-005', DATE '2026-02-24', 'AUD-FAST-005 - cloture'),
      ('IN-FAST-006', DATE '2026-03-02', 'AUD-FAST-006 - etat du dossier'),
      ('IN-FAST-007', DATE '2026-03-06', 'AUD-FAST-007 - arbitrage'),
      ('IN-FAST-008', DATE '2026-03-12', 'AUD-FAST-008 - renvoi'),
      ('IN-FAST-009', DATE '2026-03-16', 'AUD-FAST-009 - deliberation'),
      ('IN-FAST-010', DATE '2026-03-20', 'AUD-FAST-010 - suivi final'),
      ('IN-FAST-011', DATE '2026-03-22', 'AUD-FAST-011 - urgence'),
      ('IN-FAST-012', DATE '2026-03-25', 'AUD-FAST-012 - synthese')
  ) AS v(instance_code, date_audience, commentaire)
)
INSERT INTO audience (id_instance, date_audience, commentaire)
SELECT im.id_instance, a.date_audience, a.commentaire
FROM audience_source a
JOIN instance_map im ON im.code = a.instance_code
WHERE NOT EXISTS (
  SELECT 1
  FROM audience aud
  WHERE aud.commentaire = a.commentaire
);

-- =========================================================
-- K. DOCUMENTS (un seul parent non null)
-- =========================================================

-- K1. Documents attaches au dossier
WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('/docs/fast/dossier_001.pdf', 'DOS-FAST-0001', 'Assignation', 'user1@cabinet.fr', TIMESTAMP '2026-02-01 09:00:00'),
      ('/docs/fast/dossier_002.pdf', 'DOS-FAST-0002', 'Conclusions', 'user2@cabinet.fr', TIMESTAMP '2026-02-01 10:00:00'),
      ('/docs/fast/dossier_003.pdf', 'DOS-FAST-0003', 'Courrier', 'user3@cabinet.fr', TIMESTAMP '2026-02-01 11:00:00'),
      ('/docs/fast/dossier_004.pdf', 'DOS-FAST-0005', 'Note interne', 'user5@cabinet.fr', TIMESTAMP '2026-02-01 12:00:00'),
      ('/docs/fast/dossier_005.pdf', 'DOS-FAST-0007', 'Assignation', 'user7@cabinet.fr', TIMESTAMP '2026-02-01 13:00:00'),
      ('/docs/fast/dossier_006.pdf', 'DOS-FAST-0008', 'Conclusions', 'user8@cabinet.fr', TIMESTAMP '2026-02-01 14:00:00')
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

-- K2. Documents attaches a la procedure
WITH procedure_source AS (
  SELECT *
  FROM (
    VALUES
      ('PR-FAST-001', 'DOS-FAST-0001', 'Prud''hommes', 'En cours', DATE '2026-01-15'),
      ('PR-FAST-002', 'DOS-FAST-0001', 'Refere', 'Initiee', DATE '2026-01-18'),
      ('PR-FAST-003', 'DOS-FAST-0002', 'Appel', 'Initiee', DATE '2026-01-25'),
      ('PR-FAST-004', 'DOS-FAST-0003', 'Prud''hommes', 'En cours', DATE '2026-02-02'),
      ('PR-FAST-005', 'DOS-FAST-0004', 'Appel', 'Terminee', DATE '2026-01-12'),
      ('PR-FAST-006', 'DOS-FAST-0005', 'Refere', 'En cours', DATE '2026-02-10'),
      ('PR-FAST-007', 'DOS-FAST-0006', 'Prud''hommes', 'Initiee', DATE '2026-02-17'),
      ('PR-FAST-008', 'DOS-FAST-0007', 'Appel', 'En cours', DATE '2026-02-22'),
      ('PR-FAST-009', 'DOS-FAST-0008', 'Refere', 'Initiee', DATE '2026-02-25'),
      ('PR-FAST-010', 'DOS-FAST-0008', 'Prud''hommes', 'En cours', DATE '2026-03-01')
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
      ('/docs/fast/procedure_001.pdf', 'PR-FAST-001', 'Courrier', 'user1@cabinet.fr', TIMESTAMP '2026-02-02 09:30:00'),
      ('/docs/fast/procedure_002.pdf', 'PR-FAST-003', 'Assignation', 'user2@cabinet.fr', TIMESTAMP '2026-02-02 10:30:00'),
      ('/docs/fast/procedure_003.pdf', 'PR-FAST-004', 'Conclusions', 'user3@cabinet.fr', TIMESTAMP '2026-02-02 11:30:00'),
      ('/docs/fast/procedure_004.pdf', 'PR-FAST-006', 'Note interne', 'user5@cabinet.fr', TIMESTAMP '2026-02-02 12:30:00'),
      ('/docs/fast/procedure_005.pdf', 'PR-FAST-008', 'Assignation', 'user7@cabinet.fr', TIMESTAMP '2026-02-02 13:30:00'),
      ('/docs/fast/procedure_006.pdf', 'PR-FAST-010', 'Conclusions', 'user8@cabinet.fr', TIMESTAMP '2026-02-02 14:30:00')
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

-- K3. Documents attaches a l'instance
WITH procedure_source AS (
  SELECT *
  FROM (
    VALUES
      ('PR-FAST-001', 'DOS-FAST-0001', 'Prud''hommes', 'En cours', DATE '2026-01-15'),
      ('PR-FAST-002', 'DOS-FAST-0001', 'Refere', 'Initiee', DATE '2026-01-18'),
      ('PR-FAST-003', 'DOS-FAST-0002', 'Appel', 'Initiee', DATE '2026-01-25'),
      ('PR-FAST-004', 'DOS-FAST-0003', 'Prud''hommes', 'En cours', DATE '2026-02-02'),
      ('PR-FAST-005', 'DOS-FAST-0004', 'Appel', 'Terminee', DATE '2026-01-12'),
      ('PR-FAST-006', 'DOS-FAST-0005', 'Refere', 'En cours', DATE '2026-02-10'),
      ('PR-FAST-007', 'DOS-FAST-0006', 'Prud''hommes', 'Initiee', DATE '2026-02-17'),
      ('PR-FAST-008', 'DOS-FAST-0007', 'Appel', 'En cours', DATE '2026-02-22'),
      ('PR-FAST-009', 'DOS-FAST-0008', 'Refere', 'Initiee', DATE '2026-02-25'),
      ('PR-FAST-010', 'DOS-FAST-0008', 'Prud''hommes', 'En cours', DATE '2026-03-01')
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
      ('IN-FAST-001', 'PR-FAST-001', 'Audience conciliation', 'Active', DATE '2026-01-22'),
      ('IN-FAST-002', 'PR-FAST-002', 'Audience jugement', 'Active', DATE '2026-01-29'),
      ('IN-FAST-003', 'PR-FAST-003', 'Audience mise en etat', 'Suspendue', DATE '2026-02-05'),
      ('IN-FAST-004', 'PR-FAST-004', 'Audience conciliation', 'Active', DATE '2026-02-11'),
      ('IN-FAST-005', 'PR-FAST-005', 'Audience jugement', 'Terminee', DATE '2026-02-16'),
      ('IN-FAST-006', 'PR-FAST-006', 'Audience mise en etat', 'Active', DATE '2026-02-20'),
      ('IN-FAST-007', 'PR-FAST-007', 'Audience conciliation', 'Active', DATE '2026-02-24'),
      ('IN-FAST-008', 'PR-FAST-008', 'Audience jugement', 'Suspendue', DATE '2026-03-03'),
      ('IN-FAST-009', 'PR-FAST-009', 'Audience mise en etat', 'Active', DATE '2026-03-07'),
      ('IN-FAST-010', 'PR-FAST-010', 'Audience conciliation', 'Active', DATE '2026-03-10'),
      ('IN-FAST-011', 'PR-FAST-006', 'Audience jugement', 'Active', DATE '2026-03-12'),
      ('IN-FAST-012', 'PR-FAST-004', 'Audience mise en etat', 'Active', DATE '2026-03-15')
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
      ('/docs/fast/instance_001.pdf', 'IN-FAST-001', 'Note interne', 'user1@cabinet.fr', TIMESTAMP '2026-02-03 09:45:00'),
      ('/docs/fast/instance_002.pdf', 'IN-FAST-002', 'Courrier', 'user2@cabinet.fr', TIMESTAMP '2026-02-03 10:45:00'),
      ('/docs/fast/instance_003.pdf', 'IN-FAST-003', 'Assignation', 'user3@cabinet.fr', TIMESTAMP '2026-02-03 11:45:00'),
      ('/docs/fast/instance_004.pdf', 'IN-FAST-006', 'Conclusions', 'user5@cabinet.fr', TIMESTAMP '2026-02-03 12:45:00'),
      ('/docs/fast/instance_005.pdf', 'IN-FAST-010', 'Courrier', 'user7@cabinet.fr', TIMESTAMP '2026-02-03 13:45:00'),
      ('/docs/fast/instance_006.pdf', 'IN-FAST-012', 'Note interne', 'user8@cabinet.fr', TIMESTAMP '2026-02-03 14:45:00')
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
-- L. MODELES + VERSIONS
-- =========================================================

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('FAST-MODELE-001', 'Assignation', 'Modele rapide assignation', jsonb_build_object('type', 'doc', 'content', jsonb_build_array())),
      ('FAST-MODELE-002', 'Conclusions', 'Modele rapide conclusions', jsonb_build_object('type', 'doc', 'content', jsonb_build_array())),
      ('FAST-MODELE-003', 'Courrier', 'Modele rapide courrier', jsonb_build_object('type', 'doc', 'content', jsonb_build_array()))
  ) AS v(nom_modele, type_libelle, description, contenu_json)
),
resolved AS (
  SELECT
    td.id AS id_type_document,
    s.nom_modele,
    s.description,
    s.contenu_json
  FROM source_rows s
  JOIN type_document td ON td.libelle = s.type_libelle
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

WITH modeles_fast AS (
  SELECT id, contenu_json
  FROM modele_document
  WHERE nom_modele IN ('FAST-MODELE-001', 'FAST-MODELE-002', 'FAST-MODELE-003')
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
FROM modeles_fast m
CROSS JOIN generate_series(1, 2) AS v(numero_version)
ON CONFLICT (id_modele, numero_version) DO NOTHING;

-- =========================================================
-- M. AFFECTATIONS
-- =========================================================

WITH source_rows AS (
  SELECT *
  FROM (
    VALUES
      ('user1@cabinet.fr', 'DOS-FAST-0001', 'Responsable', DATE '2026-01-10'),
      ('user2@cabinet.fr', 'DOS-FAST-0001', 'Second', DATE '2026-01-10'),
      ('user3@cabinet.fr', 'DOS-FAST-0003', 'Responsable', DATE '2026-01-20'),
      ('user4@cabinet.fr', 'DOS-FAST-0004', 'Redacteur', DATE '2026-01-08'),
      ('user5@cabinet.fr', 'DOS-FAST-0005', 'Responsable', DATE '2026-02-02'),
      ('user6@cabinet.fr', 'DOS-FAST-0006', 'Second', DATE '2026-02-08'),
      ('user7@cabinet.fr', 'DOS-FAST-0007', 'Responsable', DATE '2026-02-12'),
      ('user8@cabinet.fr', 'DOS-FAST-0008', 'Second', DATE '2026-02-18')
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
      ('PR-FAST-001', 'DOS-FAST-0001', 'Prud''hommes', 'En cours', DATE '2026-01-15'),
      ('PR-FAST-002', 'DOS-FAST-0001', 'Refere', 'Initiee', DATE '2026-01-18'),
      ('PR-FAST-003', 'DOS-FAST-0002', 'Appel', 'Initiee', DATE '2026-01-25'),
      ('PR-FAST-004', 'DOS-FAST-0003', 'Prud''hommes', 'En cours', DATE '2026-02-02'),
      ('PR-FAST-005', 'DOS-FAST-0004', 'Appel', 'Terminee', DATE '2026-01-12'),
      ('PR-FAST-006', 'DOS-FAST-0005', 'Refere', 'En cours', DATE '2026-02-10'),
      ('PR-FAST-007', 'DOS-FAST-0006', 'Prud''hommes', 'Initiee', DATE '2026-02-17'),
      ('PR-FAST-008', 'DOS-FAST-0007', 'Appel', 'En cours', DATE '2026-02-22'),
      ('PR-FAST-009', 'DOS-FAST-0008', 'Refere', 'Initiee', DATE '2026-02-25'),
      ('PR-FAST-010', 'DOS-FAST-0008', 'Prud''hommes', 'En cours', DATE '2026-03-01')
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
      ('user1@cabinet.fr', 'PR-FAST-001', 'Responsable', DATE '2026-01-15'),
      ('user2@cabinet.fr', 'PR-FAST-002', 'Second', DATE '2026-01-18'),
      ('user3@cabinet.fr', 'PR-FAST-004', 'Responsable', DATE '2026-02-02'),
      ('user5@cabinet.fr', 'PR-FAST-006', 'Responsable', DATE '2026-02-10'),
      ('user7@cabinet.fr', 'PR-FAST-008', 'Second', DATE '2026-02-22'),
      ('user8@cabinet.fr', 'PR-FAST-010', 'Redacteur', DATE '2026-03-01')
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
