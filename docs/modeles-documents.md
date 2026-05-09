# Documents, modèles et paragraphes

## Vue d'ensemble

La rédaction documentaire repose sur trois couches imbriquées :

1. **Modèles** (`modele_document`) — squelettes TipTap publiés, appliqués à un document vierge.
2. **Documents** (`document`) — instances liées à un dossier (ou procédure / instance), stockées en JSON TipTap.
3. **Paragraphes prédéfinis** (`paragraphe_predefini`) — blocs de texte réutilisables insérables à la volée dans l'éditeur.

Les trois couches partagent le même système de **placeholders `[LIBELLÉ]`** qui permet la substitution automatique des données du dossier.

---

## Modèles de documents

### Structure en base

| Table | Colonnes clés |
|---|---|
| `modele_document` | `id`, `nom_modele`, `type_document_id`, `contenu_json` (JSONB TipTap), `publie` (boolean) |
| `modele_document_version` | `id_modele`, `numero_version`, `contenu_json`, `publie_le` |

### API REST

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/modeles` | Liste tous les modèles (param `?publishedOnly=true` pour filtrer) |
| GET | `/api/modeles/:id` | Détail d'un modèle avec son `contenu_json` |
| POST | `/api/modeles` | Création d'un nouveau modèle |
| PUT | `/api/modeles/:id` | Mise à jour (titre, type, contenu) |
| POST | `/api/modeles/:id/publish` | Publie le modèle (snapshot versionné) |
| GET | `/api/modeles/:id/versions` | Historique des versions publiées |

### Workflow d'application dans l'UI

1. **Nouveau document** (modal dans `DossierDetailPage.vue`) : l'utilisateur sélectionne un modèle dans le menu déroulant. Le `watch` sur `newDocForm.modeleId` charge le `contenu_json` via `getModeleById()`, applique la substitution automatique des placeholders, puis injecte le résultat dans l'éditeur.

2. **Édition d'un document existant** (drawer) : le bouton « Appliquer un modèle » appelle `applyTemplate()`, qui charge le modèle et applique la même substitution avant d'écraser le contenu de l'éditeur.

Dans les deux cas, la substitution est effectuée par `substituteJsonVars()` (voir ci-dessous) **avant** que le contenu n'apparaisse dans l'éditeur, de sorte que les placeholders auto-remplis sont déjà remplacés dès la première frappe.

---

## Paragraphes prédéfinis

### Structure en base

Table `paragraphe_predefini` :

| Colonne | Type | Description |
|---|---|---|
| `id` | serial | Clé primaire |
| `id_modele` | integer \| null | Lien optionnel à un modèle (null = générique) |
| `ordre` | integer \| null | Tri au sein d'une catégorie |
| `titre` | varchar(200) \| null | Libellé court affiché dans la liste déroulante |
| `categorie` | varchar(100) \| null | Famille (Introduction, Moyens de droit, Droit du travail…) |
| `contenu` | text | Texte brut avec placeholders `[LIBELLÉ]` |

### API REST

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/paragraphes` | Liste (params optionnels : `?modeleId=`, `?categorie=`) |
| GET | `/api/paragraphes/categories` | Liste distincte des catégories existantes |
| POST | `/api/paragraphes` | Création |
| PUT | `/api/paragraphes/:id` | Mise à jour |
| DELETE | `/api/paragraphes/:id` | Suppression |

### Gestion dans l'UI

Page **Paragraphes** (`/paragraphes`) — accessible aux rôles Associée, Collaborateur, Juriste :

- Tableau filtrable par catégorie.
- Drawer de création/édition : champs titre, catégorie (avec autocomplétion), contenu (texte brut).
- La liste de catégories est peuplée dynamiquement depuis `/api/paragraphes/categories`.

### Insertion dans l'éditeur

Dans tout `RichTextEditor` en mode édition, une liste déroulante affiche les paragraphes disponibles (`titre · categorie`). À la sélection, `insertParagraphe()` :

1. Récupère le texte `contenu` du paragraphe.
2. Appelle `substituteVars()` pour remplacer les placeholders auto-remplis.
3. Insère un nœud `paragraph` TipTap au point de curseur courant.

---

## Système de placeholders

### Convention

Tous les placeholders utilisent la syntaxe `[LIBELLÉ EN MAJUSCULES]`.

- Les crochets `[…]` restent visibles dans le document final si le placeholder n'est pas résolu, signalant clairement les zones à compléter manuellement.
- L'ancienne convention `{{snake_case}}` (issue des premiers modèles) a été migrée en `[LIBELLÉ]` via `scripts/migrations/2026-05-09-migrate-modele-placeholders.mjs`.

### Placeholders auto-remplis

Ces placeholders sont substitués automatiquement à partir des données du dossier courant (`templateVars` dans `DossierDetailPage.vue`) :

| Placeholder | Source |
|---|---|
| `[NOM CLIENT]` | `dossier.client` |
| `[NOM SOCIÉTÉ]` | `dossier.client` (quand le client est une société) |
| `[NOM DOSSIER]` | `dossier.reference` |
| `[RÉFÉRENCE DOSSIER]` | `dossier.reference` |
| `[VILLE]` | ville de l'agence du dossier |
| `[NOM AVOCAT]` | `currentUser.firstName + lastName` (utilisateur connecté) |
| `[DATE OUVERTURE]` | `dossier.ouverture` (format `dd/mm/yyyy`) |
| `[DATE ÉCHÉANCE]` | `dossier.echeance` (format `dd/mm/yyyy`) |
| `[DATE CLOTURE]` | `dossier.echeance` (idem) |
| `[MONTANT]` | `dossier.montant` (format `1 234,56`) |
| `[DATE]` | date du jour à la génération |
| `[ANNÉE]` / `[ANNÉE EN COURS]` | année en cours |

### Placeholders manuels

Ces placeholders restent en clair dans l'éditeur et doivent être complétés à la main, car leur valeur est propre à chaque affaire :

| Placeholder | Signification |
|---|---|
| `[DATE AUDIENCE]` | Date d'une audience |
| `[DATE JUGEMENT]` | Date du jugement de première instance |
| `[DATE LICENCIEMENT]` | Date du licenciement |
| `[DATE EMBAUCHE]` | Date d'embauche du salarié |
| `[DATE FIN CONTRAT]` | Date de fin de contrat |
| `[DATE CONTRAT]` | Date de signature du contrat |
| `[DATE SIGNALEMENT]` | Date d'un signalement interne |
| `[DATE SIGNIFICATION]` | Date de signification de l'acte |
| `[DATE MISE EN DEMEURE]` | Date de la mise en demeure |
| `[DATE MANQUEMENT]` | Date du manquement contractuel |
| `[POSTE]` | Intitulé du poste du salarié |
| `[SALAIRE]` | Salaire mensuel brut (€) |
| `[CONGÉS PAYÉS]` | Montant des congés payés afférents |
| `[MONTANT RÉCLAMÉ]` | Montant spécifique réclamé (≠ montant dossier) |
| `[MONTANT PROVISION]` | Provision demandée en référé |
| `[MONTANT INDEMNITÉ]` | Montant de l'indemnité |
| `[MONTANT PRÉAVIS]` | Montant du préavis |
| `[MONTANT ART. 700]` | Montant au titre de l'article 700 CPC |
| `[MONTANT ASTREINTE]` | Montant de l'astreinte en référé |
| `[ART. LOI]` | Référence d'un article de loi (ex. `L.1152-1 CT`) |
| `[JURIDICTION]` | Nom de la juridiction saisie |
| `[ADVERSAIRE]` | Identité ou conseil de la partie adverse |
| `[AUTEUR HARCÈLEMENT]` | Identité de l'auteur du harcèlement |
| `[MOTIF URGENCE]` | Motif justifiant la procédure en référé |
| `[OBJET]` | Objet de la mise en demeure |
| `[SECTION]` | Section du conseil de prud'hommes |
| `[HEURE AUDIENCE]` | Heure de l'audience |
| `[ADRESSE JURIDICTION]` | Adresse physique de la juridiction |
| `[NOM CABINET]` | Nom du cabinet (pour courriers à en-tête libre) |

### Implémentation technique

#### `substituteVars()` — insertion de paragraphe

Utilisée dans `RichTextEditor.vue` au moment d'insérer un paragraphe prédéfini :

```ts
function substituteVars(text: string): string {
  const vars = props.variables; // Record<string, string>
  if (!vars || !Object.keys(vars).length) return text;
  return text.replaceAll(/\[([^\]]+)\]/g, (_match, key: string) => {
    const upper = key.toUpperCase();
    return vars[upper] ?? vars[key] ?? _match;
  });
}
```

Le composant reçoit `variables` via la prop `:variables="templateVars"` injectée par la page parente.

#### `substituteJsonVars()` — application d'un modèle

Utilisée dans `DossierDetailPage.vue` lors du chargement d'un modèle dans l'éditeur. Parcourt récursivement l'arbre TipTap JSON et substitue les placeholders dans tous les nœuds `text` :

```ts
function substituteJsonVars(
  node: Record<string, unknown>,
  vars: Record<string, string>,
): Record<string, unknown> {
  const result = { ...node };
  if (result.type === 'text' && typeof result.text === 'string') {
    result.text = result.text.replaceAll(/\[([^\]]+)\]/g, (_match, key) => {
      const upper = key.toUpperCase();
      return vars[upper] ?? vars[key] ?? _match;
    });
  }
  if (Array.isArray(result.content)) {
    result.content = (result.content as Record<string, unknown>[]).map(
      (child) => substituteJsonVars(child, vars),
    );
  }
  return result;
}
```

---

## Migrations associées

| Fichier | Description |
|---|---|
| `scripts/migrations/2026-03-28-modeles-documents-workflow.sql` | Ajout des colonnes `id_modele`, `statut_document`, `metadata_json` sur `document` |
| `scripts/migrations/2026-03-29-modeles-contenu-editorjs.sql` | Migration contenu EditorJS → TipTap (phase 1) |
| `scripts/migrations/2026-04-12-editorjs-to-tiptap.sql` | Migration contenu EditorJS → TipTap (phase 2) |
| `scripts/migrations/2026-05-09-enrich-paragraphe-predefini.sql` | Ajout colonnes `titre` et `categorie` sur `paragraphe_predefini` |
| `scripts/migrations/2026-05-09-seed-paragraphes-predefinis.sql` | Peuplement initial (61 paragraphes) — idempotent |
| `scripts/migrations/2026-05-09-migrate-modele-placeholders.mjs` | Conversion `{{snake_case}}` → `[LIBELLÉ]` sur tous les `contenu_json` |

