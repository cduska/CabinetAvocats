# Intégration Neon (Auth + Data API)

Ce document decrit l'architecture d'authentification et d'acces aux donnees en production (GitHub Pages).

---

## Architecture generale

```
Navigateur (GitHub Pages SPA)
        |
        | 1. createInternalNeonAuth(url, { allowAnonymous: true })
        |    → GET /neondb/auth/token/anonymous
        |    → JWT signé (role: authenticated)
        v
Neon Data API  (PostgREST)
  https://<host>.apirest.<region>.aws.neon.tech/neondb/rest/v1
        |
        | Authorization: Bearer <JWT>
        | → PostgREST vérifie le JWT, extrait role=authenticated
        | → exécute la requête SQL avec ce rôle
        v
Base de données Neon PostgreSQL 18
  Schéma: public
```

---

## Variables d'environnement

### Frontend (préfixe `VITE_`)

| Variable | Exemple | Rôle |
|---|---|---|
| `VITE_NEON_AUTH_URL` | `https://ep-xxx.neonauth.eu-west-2.aws.neon.tech/neondb/auth` | URL Neon Auth **avec** `/neondb/auth` |
| `VITE_NEON_DATA_API_URL` | `https://ep-xxx.apirest.eu-west-2.aws.neon.tech/neondb/rest/v1` | URL base PostgREST |
| `VITE_USE_NEON_DATA_API` | `true` | Active le mode Data API |
| `VITE_NEON_AUTO_JWT` | `true` | Recupere un JWT automatiquement au demarrage |
| `VITE_NEON_AUTH_BEARER` | `eyJ...` | Token statique (fallback dev uniquement) |

### Backend Express (serveur local)

| Variable | Rôle |
|---|---|
| `NEON_AUTH_BASE_URL` | URL Neon Auth pour valider les JWT entrants (optionnel) |

---

## Flux d'authentification

Le SDK est initialisé dans `src/services/neonAuth.ts` :

```ts
createInternalNeonAuth(VITE_NEON_AUTH_URL, { allowAnonymous: true })
```

Au chargement de la page (`main.ts` → `bootstrapNeonAuthToken()`):

1. `getJWTToken()` vérifie s'il existe une session utilisateur authentifiée
2. Si non → appel `GET /neondb/auth/token/anonymous`
3. Le JWT retourné est stocké dans `localStorage['cabinet.neon.jwt']`
4. Toutes les requêtes Data API lisent cette clé via `ensureNeonAuthToken()`

Aucune action utilisateur n'est requise : les données sont accessibles dès l'arrivée sur la page.

### Point critique : format de l'URL

`VITE_NEON_AUTH_URL` **doit** inclure le chemin `/neondb/auth`.  
Better Auth (`createInternalNeonAuth`) inspecte le path de l'URL :
- avec `/neondb/auth` → utilise l'URL telle quelle → endpoints corrects
- sans path → ajoute automatiquement `/api/auth` → **HTTP 400** sur tous les appels

---

## Permissions PostgreSQL (PostgREST)

Neon Data API utilise PostgREST avec les rôles suivants :

| Rôle | Usage |
|---|---|
| `authenticated` | Rôle injecté par le JWT (utilisateurs connectés **et** tokens anonymes) |
| `anonymous` | Rôle sans JWT (accès minimal, non utilisé activement) |
| `authenticator` | Rôle de connexion PostgREST (besoin de `USAGE` sur le schéma) |

Les GRANTs nécessaires ont été appliqués via la migration
[`scripts/migrations/2026-04-neon-data-api-grants.sql`](../scripts/migrations/2026-04-neon-data-api-grants.sql) :

```sql
GRANT USAGE ON SCHEMA public TO authenticated, anonymous, authenticator;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated, anonymous;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anonymous;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated, anonymous;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated, anonymous;
```

> Sans ces GRANTs, toute requête Data API retourne `HTTP 403 - permission denied for table ...` (code PostgreSQL `42501`).

---

## Couche API front (`src/services/api/`)

Chaque fichier API expose deux modes via le flag `isNeonDataApiEnabled()` :

| Mode | Condition | Destination |
|---|---|---|
| **Neon Data API** | `VITE_USE_NEON_DATA_API=true` (prod) | `requestNeonRest()` → PostgREST |
| **Express local** | dev / CI | `requestJson()` → `/api/...` backend |

### Fichiers couverts par le mode Neon

| Fichier | Tables Neon accédées |
|---|---|
| `dossiersApi.ts` | `dossier`, `client`, `type_dossier`, `statut_dossier`, `agence`, `facture` |
| `clientsApi.ts` | `client`, `agence`, `collaborateur` |
| `audiencesApi.ts` | `audience`, `instance_juridique`, `type_instance`, `procedure`, `type_procedure`, `statut_procedure`, `dossier`, `type_dossier`, `agence` |
| `documentsApi.ts` | `document`, `type_document`, `collaborateur`, `dossier`, `procedure`, `instance_juridique`, `agence` |
| `modelesApi.ts` | `modele_document`, `type_document`, `modele_document_version`, `modele_sous_domaine`, `paragraphe_predefini` |
| `dashboardApi.ts` | `dossier`, `procedure`, `audience`, `document`, `statut_dossier`, `agence` (counts via `Prefer: count=exact`) |
| `referenceApi.ts` | `statut_dossier`, `statut_procedure`, `type_procedure`, `type_document`, `type_instance`, `statut_instance`, `type_dossier`, `agence` |
| `proceduresApi.ts` | `procedure`, `type_procedure`, `statut_procedure`, `dossier`, `agence` |
| `collaborateursApi.ts` | `collaborateur`, `metier`, `agence` (backend Express uniquement) |

> **Opérations d'écriture (POST / PUT / DELETE)** : quelle que soit la valeur de `VITE_USE_NEON_DATA_API`, les mutations (création, modification, suppression) passent **toujours** par le backend Express local (`/api/...`). Neon Data API (PostgREST) n'est utilisé qu'en **lecture**. En production (GitHub Pages), les fonctions de création/édition ne sont donc pas disponibles sans accès au backend.

### Syntaxe de filtre d'agence (PostgREST)

Pour filtrer sur une table embarquée, utiliser `table.or=(col.ilike.*val*)` :

```
✅  agence.or=(nom.ilike.*lyon*,ville.ilike.*lyon*)
❌  or=(agence.nom.ilike.*lyon*,agence.ville.ilike.*lyon*)   → PGRST100
```

---

## Gestion de l'expiry du JWT

Le JWT anonyme/utilisateur a une durée de vie limitée (champ `exp`). La logique de renouvellement est centralisée dans `buildNeonHeaders()` (`src/services/api/utils.ts`) :

1. **Token valide** → utilisé directement.
2. **Token expiré + SDK disponible** (`VITE_NEON_AUTH_URL` configuré) → `fetchJwtFromNeonSdk()` est appelé, le nouveau token est stocké dans `localStorage`.
3. **Token expiré + SDK indisponible** → le token périmé est renvoyé tel quel pour que le serveur retourne une erreur descriptive (`JWT expired`) plutôt que `missing credentials`.
4. **Réponse HTTP 401 reçue** (token refusé) → clear du localStorage, `neonTokenLastMissAt` remis à zéro, nouveau token tenté via SDK, requête rejouée une seule fois.

### Comportement visible

| Situation | Affiché dans l'UI |
|---|---|
| Renouvellement automatique réussi | Rien (transparent) |
| SDK absent / JWT non renouvelable | Erreur `JWT token has expired` |
| Aucun token stocké | `Token Neon manquant` |

---

## Diagnostic en production

Le bandeau de la topbar affiche l'état du token :

| Badge | Signification |
|---|---|
| `Token anonyme` | JWT anonyme présent, données accessibles |
| `Connecte` | Session utilisateur authentifiée |
| `Token Neon manquant` | Pas de JWT → requêtes Data API échoueront |

Le panneau de diagnostic (icône `ⓘ`) détaille :
- Source du token (`localStorage` / `env` / `manquant`)
- État de la session utilisateur Neon Auth
- État de la session applicative (cabinet)
