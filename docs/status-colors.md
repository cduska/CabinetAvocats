# Politique de couleurs des statuts

Cette documentation definit la convention de couleurs appliquee aux statuts metier dans l'interface.

Perimetre actuel:
- Dossiers
- Procedures
- Instances
- Documents

Exclusion explicite:
- Dashboard (non aligne volontairement pour le moment)

## Regles globales

| Couleur (classe CSS) | Intention metier | Exemples de statuts |
|---|---|---|
| Jaune (`status-warn`) | Etat initie / cree / en attente de qualification | `initie`, `initiee`, `cree`, `creee`, `brouillon`, `a valider`, `en preparation` |
| Vert (`status-ok`) | Etat actif / en cours de traitement | `en cours`, `active`, `actif`, `ouvert`, `ouverte`, `traite`, `traitee`, `valide`, `validation` |
| Rouge (`status-alert`) | Etat incident / blocage / retard | `urgent`, `en retard`, `bloque`, `bloquee`, `suspendu`, `suspendue`, `rejete`, `rejetee` |
| Gris (`status-neutral`) | Etat final / clos | `cloture`, `clos`, `terminee`, `termine`, `archive`, `finalisee`, `finalise` |

## Regles techniques

- La normalisation retire la casse et les accents avant mapping.
- Toute valeur non reconnue tombe par defaut en jaune (`status-warn`).
- La logique est centralisee dans `src/services/status.ts` via `getStatusColorClass(status)`.

## Impact UX

- Le meme statut a la meme couleur partout dans les modules couverts.
- La lecture des ecrans est plus rapide: etat initial (jaune), actif (vert), incident (rouge), termine (gris).
