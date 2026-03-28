# Pipeline CI/CD - Cabinet Avocats

## Vue d'ensemble

Le pipeline est defini dans `.github/workflows/ci.yml` et se declenche sur chaque **push** ou **pull request** vers `main`.

---

## Ordonnancement des jobs

```
push / pull_request -> main
          |
     +----v----+
     |  build  |  <- install · lint · tests unitaires · build Vite
     +----+----+
          | (en parallele)
    +-----+------+
    v            v
+-------+  +------------+
| sonar |  | cypress-run|
+---+---+  +------+-----+
    |    (les deux termines)
    +------+------+
           | (en parallele, push main seulement)
     +-----+------+
     v            v
+--------------+  +-------------+
|publish-image |  | deploy_pages |
|   (GHCR)     |  |(GitHub Pages)|
+--------------+  +-------------+
              |
              v
         +-----------+
         |  notify   |  <- rapport email (toujours, succes ou echec)
         +-----------+
```

---

## Description des jobs

| Job | Dependances | Declencheur | Role |
|-----|-------------|-------------|------|
| `build` | - | push + PR | Install npm, lint, tests unitaires, build Vite |
| `sonar` | `build` | push + PR | Analyse qualite SonarCloud + Quality Gate |
| `cypress-run` | `build` | push + PR | Tests E2E Cypress Cloud (Chrome, record, parallel x2) |
| `publish-image` | `build`, `sonar`, `cypress-run` | push main uniquement | Build + push image Docker vers GHCR |
| `deploy_pages` | `build`, `sonar`, `cypress-run` | push main uniquement | Build front + publication GitHub Pages |
| `notify` | tous les jobs ci-dessus | toujours (succes ou echec) | Envoi email de compte rendu |

> `publish-image` et `deploy_pages` sont bloques si `build` ou `cypress-run` echouent. `sonar` peut etre ignore (skipped) si `SONAR_TOKEN` n'est pas configure.

---

## Detail des jobs

### `build`
- Checkout du code
- Setup Node.js 20
- `npm ci`
- `npm run lint` (si present)
- `npm run build` (Vite -> `dist/`)
- `npm test` (si present)

### `sonar`
1. Verifie l'existence du projet SonarCloud
2. Cree le projet si absent
3. Aligne la branche principale sur `main`
4. Lance le scanner SonarQube avec `sonar.qualitygate.wait=true`
5. Echoue si le Quality Gate est rouge

> Le job est ignore si le secret `SONAR_TOKEN` est absent.

### `cypress-run`
- Execution en matrice sur 2 conteneurs (`containers: [1, 2]`)
- Demarre un service PostgreSQL ephemere (`postgres:16`)
- Attend la disponibilite PostgreSQL via `npm run db:wait`
- Initialise la base de test (`schema_complet.sql` + `peuplement_minimal.sql`)
- Demarre l'API + le front (`npm run dev:ci`)
- Attend que le front (`5173`) et l'API (`8787/healthz`) repondent
- Lance les tests Cypress en mode headless (Chrome)
- Enregistre les runs sur Cypress Cloud (`record: true`, `parallel: true`)

### `publish-image`
- Build de l'image Docker
- Login sur `ghcr.io`
- Tag + push `ghcr.io/cduska/cabinet-avocats:latest`

### `deploy_pages`
- Build du front via `npm run build`
- Active `VITE_USE_NEON_DATA_API=true`
- Active `VITE_NEON_AUTO_JWT=true`
- Injecte `VITE_NEON_DATA_API_URL` depuis `VITE_NEON_DATA_API_URL_PROD`
- Injecte `VITE_NEON_AUTH_URL` depuis `VITE_NEON_AUTH_URL_PROD`
- Publie `dist/` avec `actions/deploy-pages`
- Le front en prod consomme Neon Data API directement (JWT Neon Auth requis)

### `notify`
- Construit un resume HTML de tous les jobs
- Affiche les statuts Sonar + Cypress en texte
- Ajoute des liens directs vers SonarCloud, Cypress Cloud, le run GitHub et GitHub Pages
- Envoie l'email via SMTP (si secrets configures)
- S'execute toujours, meme en cas d'echec en amont

---

## Secrets GitHub requis

| Secret | Obligatoire | Description |
|--------|-------------|-------------|
| `SONAR_TOKEN` | Recommande | Token d'analyse SonarCloud |
| `CYPRESS_RECORD_KEY` | Pour Cypress Cloud | Cle d'enregistrement Cypress Cloud |
| `MAIL_SERVER` | Pour notify | Serveur SMTP |
| `MAIL_PORT` | Pour notify | Port SMTP |
| `MAIL_USERNAME` | Pour notify | Adresse email expediteur |
| `MAIL_PASSWORD` | Pour notify | Mot de passe ou App Password |
| `MAIL_TO` | Pour notify | Adresse email destinataire |
| `VITE_NEON_DATA_API_URL_PROD` | Oui (pour `deploy_pages`) | URL Neon Data API prod |
| `VITE_NEON_AUTH_URL_PROD` | Oui (pour `deploy_pages`) | URL Neon Auth prod |

`GITHUB_TOKEN` est fourni automatiquement par GitHub Actions.

---

## Axes d'amelioration potentiels

- Partage d'artefacts: partager `dist/` entre jobs pour eviter de rebatir
- Cache npm: ajouter `cache: 'npm'` dans `actions/setup-node`
- Image Docker: supprimer le `docker build` superflu du job `build` si besoin
