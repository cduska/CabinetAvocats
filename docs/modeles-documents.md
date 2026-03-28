# Gestion des modèles et documents

## Vue d'ensemble

La gestion documentaire est structuree en deux couches:

- Catalogue de modeles (`modele_document`, `modele_document_version`)
- Documents generes (`document`) relies a un seul scope metier:
  - dossier
  - procedure
  - instance

## Migration base de donnees

Avant d'utiliser les nouveaux endpoints de workflow documentaire, appliquer la migration:

```bash
psql -U postgres -d postgres -f scripts/migrations/2026-03-28-modeles-documents-workflow.sql
```

Cette migration ajoute a `document`:

- `id_modele`
- `numero_version_modele`
- `statut_document`
- `metadata_json`

## Endpoints modeles

- `GET /api/modeles`
- `GET /api/modeles/:id`
- `POST /api/modeles`
- `PUT /api/modeles/:id`
- `POST /api/modeles/:id/publish`
- `GET /api/modeles/:id/versions`
- `GET /api/modeles/:id/versions/:version`

## Endpoints documents

- `POST /api/documents/generate`
  - Genere un document a partir d'un modele publie (`modeleId + numeroVersion`) et d'un scope metier (`scopeType + scopeId`).
- `PUT /api/documents/:id/status`
  - Met a jour le `statut_document` du document.

## UI

Une page de gestion est disponible dans la navigation:

- `Modeles` (`/modeles`)

Fonctionnalites disponibles:

- Liste des modeles
- Edition du brouillon JSON
- Publication de version
- Generation d'un document depuis une version publiee
