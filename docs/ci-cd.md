# Pipeline CI/CD — Cabinet Avocats

## Vue d'ensemble

Le pipeline est défini dans `.github/workflows/ci.yml` et se déclenche sur chaque **push** ou **pull request** vers `main`.

---

## Ordonnancement des jobs

```
push / pull_request → main
          │
     ┌────▼────┐
     │  build  │  ← install · lint · test unitaires · build Vite
     └────┬────┘
          │ (en parallèle)
    ┌─────┴──────┐
    ▼            ▼
┌───────┐  ┌────────────┐
│ sonar │  │ cypress-run│  ← tests E2E Chrome
└───┬───┘  └──────┬─────┘
    │    (les deux│terminés)
    └──────┬──────┘
           │ (en parallèle, push main seulement)
     ┌─────┴──────┐
     ▼            ▼
┌──────────────┐  ┌────────┐
│publish-image │  │deploy_fly│
│  (GHCR)      │  │ (Fly.io) │
└──────────────┘  └────────┘
           │
     ┌─────▼─────┐
     │  notify   │  ← rapport email (toujours, succès ou échec)
     └───────────┘
```

---

## Description des jobs

| Job | Dépendances | Déclencheur | Rôle |
|-----|-------------|-------------|------|
| `build` | — | push + PR | Install npm, lint, tests unitaires, build Vite |
| `sonar` | `build` | push + PR | Analyse qualité SonarCloud + Quality Gate |
| `cypress-run` | `build` | push + PR | Tests E2E Cypress Cloud (Chrome, record, parallel x2) |
| `publish-image` | `build`, `sonar`, `cypress-run` | push main uniquement | Build + push image Docker vers GHCR |
| `deploy_fly` | `build`, `sonar`, `cypress-run` | push main uniquement | Déploiement applicatif sur Fly.io (`flyctl deploy`) |
| `notify` | tous les jobs ci-dessus | toujours (succès ou échec) | Envoi email de compte rendu |

> `publish-image` et `deploy_fly` sont bloqués si `build` ou `cypress-run` échouent. `sonar` peut être ignoré (skipped) si `SONAR_TOKEN` n'est pas configuré — dans ce cas les deux jobs déploient quand même.

---

## Détail des jobs

### `build`
- Checkout du code
- Setup Node.js 20
- `npm ci`
- `npm run lint` (si présent)
- `npm run build` (Vite → `dist/`)
- `npm test` (si présent)

### `sonar`
1. Vérifie l'existence du projet SonarCloud (clé `cduska_CabinetAvocats`)
2. Crée le projet si absent
3. Aligne la branche principale sur `main` (renomme si nécessaire)
4. Lance le scanner SonarQube avec `sonar.qualitygate.wait=true`
5. Échoue si le Quality Gate est rouge

> Le job est entièrement ignoré si le secret `SONAR_TOKEN` est absent.

### `cypress-run`
- Exécution en matrice sur 2 conteneurs (`containers: [1, 2]`)
- Démarre le serveur de développement (`npm run dev` sur le port 5173)
- Attend que le serveur réponde (timeout 120 s)
- Lance les tests Cypress en mode headless (Chrome)
- Enregistre les runs sur Cypress Cloud (`record: true`, `parallel: true`)

### `publish-image`
- Build de l'image Docker
- Login sur `ghcr.io`
- Tag + push `ghcr.io/cduska/cabinet-avocats:latest`

### `deploy_fly`
- Setup de `flyctl` via `superfly/flyctl-actions/setup-flyctl`
- Vérification du secret `FLY_API_TOKEN`
- Déploiement de l'image avec `flyctl deploy --remote-only --config fly.toml`
- Le conteneur Node sert à la fois l'API Express et le front `dist/`

### `db-migrate-fly.yml` (manuel)
- Déclenchement manuel via **Actions → Fly DB Maintenance → Run workflow**
- Paramètres:
     - `app_name` (nom de l'app Fly cible)
     - `apply_schema` (`true` pour exécuter `schema_complet.sql`, `false` sinon)
     - `seed_file` (`none`, `peuplement_minimal.sql`, `peuplement_rapide.sql`, `peuplement_massif.sql`)
- Exécution SQL dans la machine Fly via `flyctl ssh console`
- Contrôles de sécurité: validation du token, du nom d'app et du fichier de seed

> Recommandation: exécuter `schema_complet.sql` une seule fois sur un environnement vierge (script non idempotent), puis utiliser uniquement les seeds selon le besoin.

### `notify`
- Construit un résumé HTML de tous les jobs
- Affiche les statuts Sonar + Cypress en texte (robuste même si images externes bloquées)
- Ajoute un lien direct vers le dashboard SonarCloud et vers le run Cypress Cloud détaillé
- N'intègre pas de badge Cypress si le projet Cypress Cloud est privé
- Envoie l'email via SMTP (secrets à configurer — voir section Secrets)
- S'exécute toujours, même si un job précédent a échoué

---

## Secrets GitHub requis

| Secret | Obligatoire | Description |
|--------|-------------|-------------|
| `FLY_API_TOKEN` | Oui (pour `deploy_fly` et `db-migrate-fly.yml`) | Token d'authentification Fly.io pour `flyctl deploy` et maintenance DB |
| `SONAR_TOKEN` | Recommandé | Token d'analyse SonarCloud (généré dans Compte → Sécurité) |
| `CYPRESS_RECORD_KEY` | Pour Cypress Cloud | Clé d'enregistrement Cypress Cloud |
| `MAIL_SERVER` | Pour notify | Serveur SMTP (ex. `smtp.gmail.com`) |
| `MAIL_PORT` | Pour notify | Port SMTP (ex. `587` pour TLS) |
| `MAIL_USERNAME` | Pour notify | Adresse email expéditeur |
| `MAIL_PASSWORD` | Pour notify | Mot de passe ou App Password |
| `MAIL_TO` | Pour notify | Adresse email destinataire |

> Pour Gmail : activer la validation en 2 étapes puis générer un **App Password** dans Compte Google → Sécurité → Mots de passe des applications.

`GITHUB_TOKEN` est fourni automatiquement par GitHub Actions (utilisé pour GHCR et les checks PR).

---

## Badges SonarCloud

Ces badges sont accessibles publiquement et peuvent être intégrés dans le README :

```markdown
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=cduska_CabinetAvocats&metric=alert_status)](https://sonarcloud.io/dashboard?id=cduska_CabinetAvocats)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=cduska_CabinetAvocats&metric=coverage)](https://sonarcloud.io/dashboard?id=cduska_CabinetAvocats)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=cduska_CabinetAvocats&metric=bugs)](https://sonarcloud.io/dashboard?id=cduska_CabinetAvocats)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=cduska_CabinetAvocats&metric=code_smells)](https://sonarcloud.io/dashboard?id=cduska_CabinetAvocats)
```

> Note: si le projet SonarCloud est privé, les images de badges peuvent afficher `project not found` dans certains clients email non authentifiés. Dans ce cas, utilisez le lien dashboard SonarCloud présent dans l'email.

---

## Badge Cypress Cloud

```markdown
[![Cypress Cloud](https://img.shields.io/endpoint?url=https://cloud.cypress.io/badge/simple/1hszcb/main&style=flat&logo=cypress)](https://cloud.cypress.io/projects/1hszcb/runs)
```

> Note: les badges Cypress Cloud sont disponibles pour les projets publics. Si le projet est privé, utiliser un lien vers la page des runs au lieu d'une image de badge.

---

## Nettoyage des workflows

Les workflows redondants suivants ont été retirés du dépôt pour éviter les déploiements en double :

| Fichier | Statut | Motif |
|---------|--------|-------|
| `deploy.yml` | Supprimé | Double déploiement GitHub Pages |
| `static.yml` | Supprimé | Déploiement des sources brutes sans build Vite |
| `jekyll-gh-pages.yml` | Supprimé | Workflow Jekyll non adapté à Vue/Vite |
| `docker-deploy.yml` | Conservé (optionnel) | Peut être utile si un push DockerHub est requis en plus de GHCR |

---

## Axes d'amélioration potentiels

- **Partage d'artefacts** : partager le dossier `dist/` via `actions/upload-artifact` dans `build` et `actions/download-artifact` dans `deploy_fly` pour éviter de rebâtir deux fois
- **Cache npm** : ajouter `cache: 'npm'` dans `actions/setup-node` pour accélérer `npm ci`
- **Image Docker** : supprimer le `docker build` superflu dans le job `build` (l'image est déjà rebâtie dans `publish-image`)
