# 🏢 1. Agences & Profils
## Table : agence
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
nom	VARCHAR(150)	NOT NULL	Nom de l’agence
adresse	VARCHAR(255)		Adresse
ville	VARCHAR(100)		Ville
code_postal	VARCHAR(20)		Code postal
## Table : profil
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
libelle	VARCHAR(100)	NOT NULL	Profil applicatif
## Table : collaborateur_profil
Colonne	Type	Contraintes	Description
id_collaborateur	INT	PK, FK	Collaborateur
id_profil	INT	PK, FK	Profil
# 👤 2. Collaborateurs & Structure
## Table : metier
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
libelle	VARCHAR(100)	NOT NULL	Métier
## Table : collaborateur
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_agence	INT	FK	Agence
id_metier	INT	FK	Métier
nom	VARCHAR(100)		Nom
prenom	VARCHAR(100)		Prénom
email	VARCHAR(150)		Email
telephone	VARCHAR(50)		Téléphone
date_entree	DATE		Date d’entrée
actif	BOOLEAN	DEFAULT TRUE	Actif
## Table : equipe
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
nom_equipe	VARCHAR(100)		Nom
description	TEXT		Description
## Table : collaborateur_equipe
Colonne	Type	Contraintes	Description
id_collaborateur	INT	PK, FK	Collaborateur
id_equipe	INT	PK, FK	Équipe
## Table : domaine_juridique
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
libelle	VARCHAR(150)	NOT NULL	Domaine
## Table : sous_domaine
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_domaine	INT	FK	Domaine
libelle	VARCHAR(150)	NOT NULL	Sous‑domaine
## Table : specialite
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_sous_domaine	INT	FK	Sous‑domaine
libelle	VARCHAR(150)	NOT NULL	Spécialité
## Table : collaborateur_specialite
Colonne	Type	Contraintes	Description
id_collaborateur	INT	PK, FK	Collaborateur
id_specialite	INT	PK, FK	Spécialité
# 👥 3. Clients
## Table : client
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_agence	INT	FK	Agence
id_collaborateur_responsable	INT	FK	Référent
nom	VARCHAR(100)		Nom
prenom	VARCHAR(100)		Prénom
email	VARCHAR(150)		Email
telephone	VARCHAR(50)		Téléphone
# 📁 4. Dossiers
## Table : type_dossier
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
libelle	VARCHAR(100)	NOT NULL	Type
## Table : statut_dossier
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
libelle	VARCHAR(100)	NOT NULL	Statut
## Table : dossier
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_agence	INT	FK	Agence
id_client	INT	FK	Client
id_type_dossier	INT	FK	Type
id_statut_dossier	INT	FK	Statut
reference	VARCHAR(100)		Référence
date_ouverture	DATE		Ouverture
date_cloture	DATE		Clôture
## Table : historique_dossier
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_dossier	INT	FK	Dossier
auteur	INT	FK	Collaborateur
date_modification	TIMESTAMP		Date
description	TEXT		Description
## Table : facture
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_dossier	INT	FK	Dossier
montant	NUMERIC(10,2)		Montant
date_emission	DATE		Date
statut	VARCHAR(50)		Statut
# ⚖️ 5. Procédures & Instances
## Table : type_procedure
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
libelle	VARCHAR(100)	NOT NULL	Type
## Table : statut_procedure
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
libelle	VARCHAR(100)	NOT NULL	Statut
## Table : procedure
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_dossier	INT	FK	Dossier
id_type_procedure	INT	FK	Type
id_statut_procedure	INT	FK	Statut
date_debut	DATE		Début
date_fin	DATE		Fin
## Table : historique_procedure
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_procedure	INT	FK	Procédure
auteur	INT	FK	Collaborateur
date_modification	TIMESTAMP		Date
description	TEXT		Description
## Table : type_instance
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
libelle	VARCHAR(100)	NOT NULL	Type
## Table : statut_instance
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
libelle	VARCHAR(100)	NOT NULL	Statut
## Table : instance_juridique
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_procedure	INT	FK	Procédure
id_type_instance	INT	FK	Type
id_statut_instance	INT	FK	Statut
date_debut	DATE		Début
date_fin	DATE		Fin
## Table : historique_instance
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_instance	INT	FK	Instance
auteur	INT	FK	Collaborateur
date_modification	TIMESTAMP		Date
description	TEXT		Description
## Table : audience
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_instance	INT	FK	Instance
date_audience	DATE		Date
commentaire	TEXT		Commentaire
# 📄 6. Documents & Modèles (JSONB)
## Table : type_document
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
libelle	VARCHAR(100)	NOT NULL	Type
## Table : document
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_type_document	INT	FK	Type
id_dossier	INT	FK	Dossier
id_procedure	INT	FK	Procédure
id_instance	INT	FK	Instance
auteur	INT	FK	Collaborateur
chemin_fichier	TEXT		Chemin
date_creation	TIMESTAMP		Date
## Table : modele_document
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_type_document	INT	FK	Type
nom_modele	VARCHAR(150)		Nom
description	TEXT		Description
contenu_json	JSONB	CHECK JSON	Contenu Editor.js / Tiptap
## Table : modele_document_version
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_modele	INT	FK	Modèle
numero_version	INT	UNIQUE(id_modele, numero_version)	Version
contenu_json	JSONB	NOT NULL	Contenu
cree_le	TIMESTAMP	DEFAULT NOW()	Date
cree_par	INT	FK	Auteur
## Table : modele_sous_domaine
Colonne	Type	Contraintes	Description
id_modele	INT	PK, FK	Modèle
id_sous_domaine	INT	PK, FK	Sous‑domaine
## Table : paragraphe_predefini
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_modele	INT	FK	Modèle
ordre	INT		Ordre
contenu	TEXT		Contenu
# 🔐 7. Affectations & Rôles
## Table : role_affectation
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
libelle	VARCHAR(100)	NOT NULL	Rôle
## Table : affectation_dossier
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_collaborateur	INT	FK	Collaborateur
id_dossier	INT	FK	Dossier
id_role	INT	FK	Rôle
date_debut	DATE		Début
date_fin	DATE		Fin
## Table : affectation_procedure
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_collaborateur	INT	FK	Collaborateur
id_procedure	INT	FK	Procédure
id_role	INT	FK	Rôle
date_debut	DATE		Début
date_fin	DATE		Fin
# 🔒 8. Verrouillage (Dossiers & Documents)
## Table : dossier_lock
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_dossier	INT	FK	Dossier
id_collaborateur	INT	FK	Collaborateur
locked_at	TIMESTAMP	NOT NULL	Début verrou
expires_at	TIMESTAMP	NOT NULL	Expiration
## Table : document_lock
Colonne	Type	Contraintes	Description
id	SERIAL	PK	Identifiant
id_document	INT	FK	Document
id_collaborateur	INT	FK	Collaborateur
locked_at	TIMESTAMP	NOT NULL	Début verrou
expires_at	TIMESTAMP	NOT NULL