-- Migration: GRANT SELECT pour les roles Neon Data API (PostgREST)
-- ------------------------------------------------------------------
-- La Neon Data API utilise PostgREST avec deux roles standard :
--   - authenticated : role injecte par le JWT Neon Auth (utilisateurs
--                     connectes ET tokens anonymes via allowAnonymous)
--   - anon          : role utilise si aucun JWT n'est fourni
--
-- Ces roles existent dans la base Neon apres provisionnement via
-- `mcp_neon_provision_neon_data_api` ou la console Neon.
-- Sans GRANT explicite, toute requete via la Data API renvoie HTTP 403
-- "permission denied for table ...".
--
-- Ce fichier doit etre execute UNE SEULE FOIS sur la base Neon prod,
-- par example via la console SQL de Neon ou `psql`.
-- ------------------------------------------------------------------

-- 1. Acces au schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- 2. SELECT sur toutes les tables existantes
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- 3. Usage des sequences (utile pour les RETURNING id)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 4. Privileges par defaut pour les futures tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
