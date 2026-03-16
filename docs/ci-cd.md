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
│publish-image │  │ deploy │
│  (GHCR)      │  │(Pages) │
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
| `deploy` | `build`, `sonar`, `cypress-run` | push main uniquement | Build Vite + déploiement GitHub Pages |
| `notify` | tous les jobs ci-dessus | toujours (succès ou échec) | Envoi email de compte rendu |

> `publish-image` et `deploy` sont bloqués si `build` ou `cypress-run` échouent. `sonar` peut être ignoré (skipped) si `SONAR_TOKEN` n'est pas configuré — dans ce cas les deux jobs déploient quand même.

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

### `deploy`
- `npm ci` + `npm run build`
- Copie de `dist/index.html` vers `dist/404.html` pour le fallback SPA
- Upload de l'artefact Pages (`actions/upload-pages-artifact`)
- Publication via `actions/deploy-pages`

> Sur GitHub Pages, les routes SPA peuvent répondre en HTTP `404` tout en renvoyant le shell applicatif (fichier `404.html`) ; le rendu côté client reste fonctionnel.

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
| `SONAR_TOKEN` | Recommandé | Token d'analyse SonarCloud (généré dans Compte → Sécurité) |
| `CYPRESS_RECORD_KEY` | Pour Cypress Cloud | Clé d'enregistrement Cypress Cloud |
| `MAIL_SERVER` | Pour notify | Serveur SMTP (ex. `smtp.gmail.com`) |
| `MAIL_PORT` | Pour notify | Port SMTP (ex. `587` pour TLS) |
| `MAIL_USERNAME` | Pour notify | Adresse email expéditeur |
| `MAIL_PASSWORD` | Pour notify | Mot de passe ou App Password |
| `MAIL_TO` | Pour notify | Adresse email destinataire |

> Pour Gmail : activer la validation en 2 étapes puis générer un **App Password** dans Compte Google → Sécurité → Mots de passe des applications.

`GITHUB_TOKEN` est fourni automatiquement par GitHub Actions (used pour GHCR, Pages, PR checks).

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

- **Partage d'artefacts** : partager le dossier `dist/` via `actions/upload-artifact` dans `build` et `actions/download-artifact` dans `deploy` pour éviter de rebâtir deux fois
- **Cache npm** : ajouter `cache: 'npm'` dans `actions/setup-node` pour accélérer `npm ci`
- **Image Docker** : supprimer le `docker build` superflu dans le job `build` (l'image est déjà rebâtie dans `publish-image`)
