# CabinetAvocats - Intranet Vue + PostgreSQL

Application intranet Vue 3 (Vite + TypeScript) pour la gestion d'un cabinet d'avocats.

[![CI](https://github.com/cduska/CabinetAvocats/actions/workflows/ci.yml/badge.svg)](https://github.com/cduska/CabinetAvocats/actions/workflows/ci.yml)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=cduska_CabinetAvocats&metric=alert_status)](https://sonarcloud.io/dashboard?id=cduska_CabinetAvocats)

[Voir les runs Cypress Cloud (connexion requise)](https://cloud.cypress.io/projects/1hszcb/runs)

## Documentation metier

- [Politique de couleurs des statuts](docs/status-colors.md)
- [Gestion des modeles et documents](docs/modeles-documents.md)

## Stack technique (resume)

- Frontend: Vue 3 + Vue Router + Vite + TypeScript
- Backend: Node.js + Express (API REST)
- Base de donnees: PostgreSQL (driver `pg`)
- Configuration: `.env` via `dotenv`, centralisee dans `server/db-config.js`
- Build: `npm run build` (`vue-tsc` + `vite build`)
- Dev local: `npm run dev` (API + front en parallele)
- Tests E2E: Cypress (local + Cypress Cloud en CI)
- CI/CD: GitHub Actions (build, Sonar, Cypress, deploy)

## Prerequis

- Node.js 20+
- PostgreSQL local

## Configuration PostgreSQL locale

1. Creer une base locale (exemple):

```sql
CREATE DATABASE cabinet_avocats;
```

2. Initialiser la base avec le schema:

```bash
psql -U postgres -d cabinet_avocats -f schema_complet.sql
```

3. Creer un fichier `.env` a la racine (base sur `.env.example`):

```env
API_PORT=8787
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=postgres
PGUSER=postgres
PGPASSWORD=postgres
PGPOOL_MAX=10
```

Si votre schema est charge dans une autre base (ex: cabinet_avocats), remplacez simplement PGDATABASE.

## Configuration DB mutualisee

La configuration PostgreSQL est centralisee dans `server/db-config.js`.

Ce module:

- charge automatiquement les variables `.env` via `dotenv`
- gere `DATABASE_URL` en priorite si defini
- sinon utilise `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- applique les options de pool (`PGPOOL_MAX`, timeouts) pour l'API

Cette centralisation evite la duplication et garantit un comportement coherent entre:

- API Express (`server/db.js`)
- scripts SQL (`scripts/run-sql-file.mjs`)
- attente PostgreSQL en CI/local (`scripts/wait-for-pg.mjs`)

Commande utile pour attendre la disponibilite de PostgreSQL:

```bash
npm run db:wait
```

Variables optionnelles pour `db:wait`:

- `PG_WAIT_TIMEOUT_MS` (defaut: `120000`)
- `PG_WAIT_INTERVAL_MS` (defaut: `2000`)

### Table des variables d'environnement DB

| Variable | Defaut | Role |
|---|---|---|
| `DATABASE_URL` | vide | Chaine de connexion complete PostgreSQL (prioritaire si renseignee) |
| `PGHOST` | `127.0.0.1` | Hote PostgreSQL (utilise si `DATABASE_URL` est vide) |
| `PGPORT` | `5432` | Port PostgreSQL |
| `PGDATABASE` | `postgres` | Nom de la base PostgreSQL |
| `PGUSER` | `postgres` | Utilisateur PostgreSQL |
| `PGPASSWORD` | `postgres` | Mot de passe PostgreSQL |
| `PGPOOL_MAX` | `10` | Taille max du pool de connexions API |
| `PG_WAIT_TIMEOUT_MS` | `120000` | Timeout global d'attente PostgreSQL pour `npm run db:wait` |
| `PG_WAIT_INTERVAL_MS` | `2000` | Intervalle entre tentatives de connexion pour `npm run db:wait` |

## Peuplement de donnees

Les scripts de seed sont idempotents: vous pouvez les relancer sans dupliquer les memes enregistrements cibles.

Commande npm par defaut (seed rapide):

```bash
npm run db:seed
```

Seed minimal (smoke / e2e tres rapide):

```bash
npm run db:seed:minimal
```

Seed rapide (dev / CI):

```bash
npm run db:seed:quick
```

Seed massif (jeu de donnees large):

```bash
npm run db:seed:massive
```

Equivalent avec `psql` si vous preferez:

```bash
psql -U postgres -d postgres -f peuplement_rapide.sql
```

```bash
psql -U postgres -d postgres -f peuplement_minimal.sql
```

```bash
psql -U postgres -d postgres -f peuplement_massif.sql
```

Note:

Si `psql` n'est pas disponible, les commandes npm ci-dessus utilisent `node + pg` et fonctionnent sans client PostgreSQL externe.

## Installation

```bash
npm install
```

## Demarrage (recommande)

```bash
npm run dev
```

Cette commande lance l'API sur `http://127.0.0.1:8787` et le front Vite sur `http://localhost:5173`.

Si vous voyez dans le terminal front:

```text
[vite] http proxy error: /api/dashboard
Error: connect ECONNREFUSED 127.0.0.1:8787
```

cela signifie en pratique que l'API n'est pas demarree sur le port `8787`.

## Demarrage (2 terminaux)

Terminal 1 (API PostgreSQL):

```bash
npm run api:dev
```

Terminal 2 (front Vue):

```bash
npm run dev:web
```

L'application est disponible sur `http://localhost:5173`.

## Build

```bash
npm run build
```

## Deploiement GitHub Pages (front statique)

Le workflow CI publie automatiquement le front sur GitHub Pages lors des push sur `main`.

Comportement environnement:

- Dev local: conserve les appels API en relatif (`/api`) avec proxy Vite vers `localhost`.
- Prod GitHub Pages: active le mode Neon Data API avec `VITE_USE_NEON_DATA_API=true` et `VITE_NEON_DATA_API_URL_PROD`.

Secrets GitHub requis:

- `VITE_NEON_DATA_API_URL_PROD`: URL Neon Data API prod (ex: `https://<host>.apirest.<region>.aws.neon.tech/neondb/rest/v1`)

### JWT Neon Auth (mode front direct)

En mode Neon Data API, le front doit envoyer un JWT Neon Auth.

Pour un test rapide local, stockez le token dans le navigateur:

```js
localStorage.setItem('cabinet.neon.jwt', '<votre_jwt_neon_auth>')
```

Le front lira automatiquement cette cle.

## Analyse des librairies utilisees

### Dependances runtime

| Librairie | Role dans l'application | Utilite |
|---|---|---|
| `vue` | Framework UI principal du front | Essentielle |
| `vue-router` | Navigation entre pages (`dashboard`, `clients`, `dossiers`, etc.) | Essentielle |
| `express` | Serveur API HTTP (routes `/api`, `/healthz`, service du `dist`) | Essentielle |
| `pg` | Acces PostgreSQL (API + scripts SQL + attente DB) | Essentielle |
| `dotenv` | Chargement des variables `.env` (via module mutualise DB) | Essentielle |

### Dependances dev/build/test

| Librairie | Role dans l'application | Utilite |
|---|---|---|
| `vite` | Serveur dev front + bundling production | Essentielle |
| `@vitejs/plugin-vue` | Support SFC Vue (`.vue`) dans Vite | Essentielle |
| `typescript` | Typage statique front/config | Essentielle |
| `vue-tsc` | Type-check specifique Vue au build | Essentielle |
| `@vue/tsconfig` | Base de configuration TypeScript recommandee Vue | Essentielle |
| `@types/node` | Types Node pour scripts/config | Essentielle |
| `cypress` | Tests E2E locaux et CI (Cypress Cloud) | Essentielle |
| `concurrently` | Lancement parallele API + front (`dev`, `dev:full`, `dev:ci`) | Essentielle |

### Conclusion audit dependances

- Etat actuel: aucune dependance inutile detectee apres suppression de `wait-on`.
- Factorisation en place: configuration PostgreSQL centralisee dans `server/db-config.js`, consommee par l'API et les scripts.
- Benefice: moins de duplication, moins de dette technique, meme comportement local/CI pour la couche DB.

## Tests Cypress

```bash
npx cypress run --browser electron
```

## Analyse Sonar

Le pipeline GitHub Actions peut lancer une analyse SonarCloud si le secret `SONAR_TOKEN` est configure.

Configuration recommandee dans GitHub:

- Secret: `SONAR_TOKEN`

Comportement par defaut:

- le workflow cible `https://sonarcloud.io`
- la cle projet est calculee comme `<owner>_<repo>`
- l'organisation SonarCloud utilise le owner GitHub

Quand Sonar est active, l'analyse devient bloquante pour la CD: le deploy GitHub Pages et le push d'image Docker n'ont lieu que si le quality gate Sonar passe.

Si vous utilisez un SonarQube auto-heberge au lieu de SonarCloud, adaptez le job `sonar` dans [.github/workflows/ci.yml](.github/workflows/ci.yml).