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
-- Ce fichier a ete execute directement via MCP Neon le 2026-03-29.
-- Il peut etre rejoue sans risque (idempotent sur les GRANT).
-- ------------------------------------------------------------------
-- Roles Neon provisiones par la Data API :
--   - authenticated : role JWT pour les utilisateurs connectes ET tokens anonymes
--   - anonymous     : role fallback sans JWT (pas "anon" comme dans PostgREST vanilla)
--   - authenticator : role de connexion PostgREST (besoin de USAGE schema)
-- ------------------------------------------------------------------

-- 1. Acces au schema
GRANT USAGE ON SCHEMA public TO authenticated, anonymous, authenticator;

-- 2. SELECT sur toutes les tables existantes
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated, anonymous;

-- 3. Usage des sequences (utile pour les RETURNING id)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anonymous;

-- 4. Privileges par defaut pour les futures tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO authenticated, anonymous;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, anonymous;
