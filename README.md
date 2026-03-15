# CabinetAvocats - Intranet Vue + PostgreSQL

Application intranet Vue 3 (Vite + TypeScript) pour la gestion d'un cabinet d'avocats.

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

## Demarrage (2 terminaux)

Terminal 1 (API PostgreSQL):

```bash
npm run api:dev
```

Terminal 2 (front Vue):

```bash
npm run dev
```

L'application est disponible sur `http://localhost:5173`.

## Build

```bash
npm run build
```

## Tests Cypress

```bash
npx cypress run --browser electron
```