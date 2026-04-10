-- Migration: peuplement des modeles documentaires avec contenu Editor.js
-- Date: 2026-03-29
--
-- Insère ou met à jour les modèles de documents avec un contenu Editor.js
-- réaliste pour chaque type : Assignation, Conclusions, Courrier, Note interne.
-- Chaque modèle est ensuite rattaché aux sous-domaines correspondants
-- et une première version publiée est créée.
--
-- Idempotent : utilise ON CONFLICT / WHERE NOT EXISTS.

-- =========================================================
-- 1. MODELES — contenu_json Editor.js structuré
-- =========================================================

WITH modeles_source AS (
  SELECT *
  FROM (
    VALUES

    -- -------------------------------------------------------
    -- Assignation (Droit du travail — Licenciement / Harcèlement)
    -- -------------------------------------------------------
    (
      'MODELE-ASSIGNATION-PRUD',
      'Assignation',
      'Modèle d''assignation devant le Conseil de prud''hommes',
      '{
        "time": 1743292800000,
        "version": "2.28.2",
        "blocks": [
          { "type": "header", "data": { "text": "ASSIGNATION DEVANT LE CONSEIL DE PRUD''HOMMES", "level": 1 } },
          { "type": "delimiter", "data": {} },
          { "type": "header", "data": { "text": "IDENTIFICATION DES PARTIES", "level": 2 } },
          { "type": "paragraph", "data": { "text": "<b>DEMANDEUR :</b> {{demandeur_prenom}} {{demandeur_nom}}, demeurant {{demandeur_adresse}}, représenté par Maître {{avocat_nom}}, avocat au barreau de {{barreau}}." } },
          { "type": "paragraph", "data": { "text": "<b>DÉFENDEUR :</b> {{defendeur_raison_sociale}}, dont le siège social est sis {{defendeur_adresse}}, prise en la personne de son représentant légal." } },
          { "type": "delimiter", "data": {} },
          { "type": "header", "data": { "text": "OBJET DE LA DEMANDE", "level": 2 } },
          { "type": "paragraph", "data": { "text": "Le demandeur a la honneur d''assigner {{defendeur_raison_sociale}} à comparaître devant le Conseil de prud''hommes de {{juridiction}}, section {{section}}, à l''audience du {{date_audience}} à {{heure_audience}}, tenue au {{adresse_juridiction}}." } },
          { "type": "header", "data": { "text": "EXPOSE DES FAITS", "level": 2 } },
          { "type": "paragraph", "data": { "text": "{{demandeur_prenom}} {{demandeur_nom}} a été employé(e) par {{defendeur_raison_sociale}} en qualité de {{poste}} depuis le {{date_entree}}." } },
          { "type": "paragraph", "data": { "text": "Le {{date_licenciement}}, le défendeur a notifié au demandeur son licenciement pour le motif suivant : {{motif_licenciement}}." } },
          { "type": "header", "data": { "text": "PRÉTENTIONS ET MOYENS", "level": 2 } },
          { "type": "list", "data": { "style": "ordered", "items": [
            "Juger que le licenciement est sans cause réelle et sérieuse.",
            "Condamner le défendeur à payer la somme de {{montant_indemnite}} € à titre d''indemnité pour licenciement sans cause réelle et sérieuse.",
            "Condamner le défendeur à payer la somme de {{montant_preavis}} € au titre du préavis.",
            "Condamner le défendeur aux entiers dépens."
          ]}},
          { "type": "header", "data": { "text": "PIÈCES JUSTIFICATIVES", "level": 2 } },
          { "type": "list", "data": { "style": "unordered", "items": [
            "Pièce n°1 : Contrat de travail du {{date_contrat}}",
            "Pièce n°2 : Lettre de licenciement du {{date_licenciement}}",
            "Pièce n°3 : Bulletins de salaire ({{mois_debut}} à {{mois_fin}})",
            "Pièce n°4 : Attestation Pôle Emploi"
          ]}},
          { "type": "delimiter", "data": {} },
          { "type": "paragraph", "data": { "text": "Fait à {{ville}}, le {{date_redaction}}" } },
          { "type": "paragraph", "data": { "text": "Maître {{avocat_nom}}" } }
        ]
      }'::jsonb
    ),

    (
      'MODELE-ASSIGNATION-REFERE',
      'Assignation',
      'Modèle d''assignation en référé (urgence)',
      '{
        "time": 1743292800000,
        "version": "2.28.2",
        "blocks": [
          { "type": "header", "data": { "text": "ASSIGNATION EN RÉFÉRÉ", "level": 1 } },
          { "type": "delimiter", "data": {} },
          { "type": "paragraph", "data": { "text": "Maître {{avocat_nom}}, avocat au barreau de {{barreau}}, <b>au nom et pour le compte de</b> {{demandeur_prenom}} {{demandeur_nom}}, fait assigner :" } },
          { "type": "paragraph", "data": { "text": "<b>{{defendeur_raison_sociale}}</b>, dont le siège social est sis {{defendeur_adresse}},<br>à comparaître d''<b>urgence</b> devant Madame / Monsieur le Président du Tribunal judiciaire de {{juridiction}}, siégeant en référé, au {{adresse_juridiction}}, à l''audience du <b>{{date_audience}}</b> à <b>{{heure_audience}}</b>." } },
          { "type": "header", "data": { "text": "FAITS ET CIRCONSTANCES", "level": 2 } },
          { "type": "paragraph", "data": { "text": "{{expose_faits}}" } },
          { "type": "header", "data": { "text": "EN DROIT", "level": 2 } },
          { "type": "paragraph", "data": { "text": "En vertu des articles 484 et suivants du Code de procédure civile, le juge des référés peut ordonner, même en présence d''une contestation sérieuse, toute mesure conservatoire ou de remise en état propre à prévenir un dommage imminent." } },
          { "type": "header", "data": { "text": "DEMANDES", "level": 2 } },
          { "type": "list", "data": { "style": "ordered", "items": [
            "Ordonner sous astreinte de {{montant_astreinte}} € par jour de retard {{mesure_demandee}}.",
            "Condamner le défendeur aux entiers dépens de la présente instance.",
            "Dire n''y avoir lieu à sursis à statuer."
          ]}},
          { "type": "delimiter", "data": {} },
          { "type": "paragraph", "data": { "text": "Sous toutes réserves." } },
          { "type": "paragraph", "data": { "text": "Fait à {{ville}}, le {{date_redaction}}<br>Maître {{avocat_nom}}" } }
        ]
      }'::jsonb
    ),

    -- -------------------------------------------------------
    -- Conclusions (Droit du travail — Licenciement / Harcèlement)
    -- -------------------------------------------------------
    (
      'MODELE-CONCLUSIONS-APPEL',
      'Conclusions',
      'Modèle de conclusions d''appelant devant la cour d''appel',
      '{
        "time": 1743292800000,
        "version": "2.28.2",
        "blocks": [
          { "type": "header", "data": { "text": "CONCLUSIONS D''APPELANT", "level": 1 } },
          { "type": "paragraph", "data": { "text": "<b>POUR :</b> {{appelant_prenom}} {{appelant_nom}}, {{appelant_qualite}}, demeurant {{appelant_adresse}},<br>Représenté(e) par Maître {{avocat_nom}}, avocat au barreau de {{barreau}}, inscrit au tableau sous le n° {{numero_tableau}}." } },
          { "type": "paragraph", "data": { "text": "<b>CONTRE :</b> {{intime_prenom}} {{intime_nom}} ou {{intime_raison_sociale}}, demeurant / dont le siège est sis {{intime_adresse}}." } },
          { "type": "delimiter", "data": {} },
          { "type": "quote", "data": { "text": "Appel formé contre le jugement rendu le {{date_jugement}} par le {{juridiction_premier_degre}} de {{ville_premier_degre}}, RG n° {{rg_premier_degre}}.", "caption": "Objet de l''appel", "alignment": "left" } },
          { "type": "header", "data": { "text": "DISCUSSION", "level": 2 } },
          { "type": "header", "data": { "text": "I — Sur la recevabilité de l''appel", "level": 3 } },
          { "type": "paragraph", "data": { "text": "L''appel a été interjeté dans le délai légal d''un mois suivant la notification du jugement, conformément à l''article 538 du Code de procédure civile. Il est donc recevable." } },
          { "type": "header", "data": { "text": "II — Sur le fond", "level": 3 } },
          { "type": "paragraph", "data": { "text": "{{expose_moyens_appel}}" } },
          { "type": "header", "data": { "text": "PAR CES MOTIFS", "level": 2 } },
          { "type": "paragraph", "data": { "text": "Plaise à la Cour de :" } },
          { "type": "list", "data": { "style": "ordered", "items": [
            "INFIRMER le jugement rendu le {{date_jugement}} en toutes ses dispositions.",
            "STATUANT À NOUVEAU, juger que {{chef_demande_principal}}.",
            "CONDAMNER {{intime_prenom}} {{intime_nom}} à payer à l''appelant la somme de {{montant_principal}} € à titre de {{nature_somme}}.",
            "CONDAMNER {{intime_prenom}} {{intime_nom}} aux entiers dépens de première instance et d''appel.",
            "CONDAMNER {{intime_prenom}} {{intime_nom}} à payer la somme de {{montant_article_700}} € sur le fondement de l''article 700 du Code de procédure civile."
          ]}},
          { "type": "delimiter", "data": {} },
          { "type": "paragraph", "data": { "text": "Fait à {{ville}}, le {{date_redaction}}<br>Maître {{avocat_nom}}" } }
        ]
      }'::jsonb
    ),

    (
      'MODELE-CONCLUSIONS-HARCELEMENT',
      'Conclusions',
      'Modèle de conclusions en défense — harcèlement moral au travail',
      '{
        "time": 1743292800000,
        "version": "2.28.2",
        "blocks": [
          { "type": "header", "data": { "text": "CONCLUSIONS EN DÉFENSE", "level": 1 } },
          { "type": "paragraph", "data": { "text": "<b>POUR :</b> {{defendeur_raison_sociale}}, représentée par Maître {{avocat_nom}}, avocat au barreau de {{barreau}}." } },
          { "type": "paragraph", "data": { "text": "<b>CONTRE :</b> {{demandeur_prenom}} {{demandeur_nom}}." } },
          { "type": "delimiter", "data": {} },
          { "type": "header", "data": { "text": "RAPPEL DES FAITS", "level": 2 } },
          { "type": "paragraph", "data": { "text": "{{demandeur_prenom}} {{demandeur_nom}} a été employé(e) par {{defendeur_raison_sociale}} du {{date_entree}} au {{date_fin_contrat}} en qualité de {{poste}}." } },
          { "type": "paragraph", "data": { "text": "Le demandeur soutient avoir été victime de harcèlement moral, ce que le défendeur conteste formellement." } },
          { "type": "header", "data": { "text": "DISCUSSION", "level": 2 } },
          { "type": "header", "data": { "text": "I — Absence de matérialité des faits allégués", "level": 3 } },
          { "type": "paragraph", "data": { "text": "L''article L.1152-1 du Code du travail dispose qu''aucun salarié ne doit subir les agissements répétés de harcèlement moral qui ont pour objet ou pour effet une dégradation de ses conditions de travail. La preuve de tels agissements incombe, en premier lieu, au salarié." } },
          { "type": "paragraph", "data": { "text": "Or, les éléments produits aux débats par le demandeur ne permettent pas d''établir {{motif_contestation}}." } },
          { "type": "header", "data": { "text": "II — Sur les demandes indemnitaires", "level": 3 } },
          { "type": "paragraph", "data": { "text": "À titre subsidiaire, les montants réclamés par le demandeur sont disproportionnés et non justifiés. Le préjudice allégué n''est pas établi." } },
          { "type": "header", "data": { "text": "PAR CES MOTIFS", "level": 2 } },
          { "type": "list", "data": { "style": "ordered", "items": [
            "DÉBOUTER {{demandeur_prenom}} {{demandeur_nom}} de l''ensemble de ses demandes.",
            "CONDAMNER le demandeur aux entiers dépens.",
            "CONDAMNER le demandeur à payer la somme de {{montant_article_700}} € sur le fondement de l''article 700 du Code de procédure civile."
          ]}},
          { "type": "delimiter", "data": {} },
          { "type": "paragraph", "data": { "text": "Fait à {{ville}}, le {{date_redaction}}<br>Maître {{avocat_nom}}" } }
        ]
      }'::jsonb
    ),

    (
      'MODELE-CONCLUSIONS-AFFAIRES',
      'Conclusions',
      'Modèle de conclusions au fond — contentieux commercial',
      '{
        "time": 1743292800000,
        "version": "2.28.2",
        "blocks": [
          { "type": "header", "data": { "text": "CONCLUSIONS AU FOND", "level": 1 } },
          { "type": "paragraph", "data": { "text": "<b>POUR :</b> {{demandeur_raison_sociale}}, {{demandeur_forme_juridique}}, au capital de {{capital}} €, dont le siège social est sis {{demandeur_adresse}}, immatriculée au RCS de {{ville_rcs}} sous le n° {{numero_rcs}},<br>Représentée par Maître {{avocat_nom}}, avocat au barreau de {{barreau}}." } },
          { "type": "delimiter", "data": {} },
          { "type": "header", "data": { "text": "FAITS ET PROCÉDURE", "level": 2 } },
          { "type": "paragraph", "data": { "text": "Les parties ont conclu le {{date_contrat}} un contrat de {{type_contrat}} aux termes duquel {{objet_contrat}}." } },
          { "type": "paragraph", "data": { "text": "Le {{date_manquement}}, le défendeur a manqué à ses obligations contractuelles en {{nature_manquement}}, causant ainsi un préjudice {{chiffrage_prejudice}}." } },
          { "type": "header", "data": { "text": "EN DROIT", "level": 2 } },
          { "type": "paragraph", "data": { "text": "En application de l''article 1231-1 du Code civil, le débiteur est condamné au paiement de dommages et intérêts à raison de l''inexécution de l''obligation. La responsabilité contractuelle du défendeur est pleinement engagée." } },
          { "type": "header", "data": { "text": "PAR CES MOTIFS", "level": 2 } },
          { "type": "list", "data": { "style": "ordered", "items": [
            "JUGER que {{defendeur_raison_sociale}} a manqué à ses obligations contractuelles.",
            "CONDAMNER {{defendeur_raison_sociale}} à payer la somme de {{montant_principal}} € HT à titre de dommages et intérêts.",
            "ASSORTIR cette condamnation des intérêts au taux légal à compter du {{date_mise_en_demeure}}.",
            "CONDAMNER {{defendeur_raison_sociale}} à payer la somme de {{montant_article_700}} € sur le fondement de l''article 700 du Code de procédure civile.",
            "CONDAMNER {{defendeur_raison_sociale}} aux entiers dépens."
          ]}},
          { "type": "delimiter", "data": {} },
          { "type": "paragraph", "data": { "text": "Fait à {{ville}}, le {{date_redaction}}<br>Maître {{avocat_nom}}" } }
        ]
      }'::jsonb
    ),

    -- -------------------------------------------------------
    -- Courrier (tous domaines)
    -- -------------------------------------------------------
    (
      'MODELE-COURRIER-MISE-EN-DEMEURE',
      'Courrier',
      'Lettre de mise en demeure',
      '{
        "time": 1743292800000,
        "version": "2.28.2",
        "blocks": [
          { "type": "header", "data": { "text": "MISE EN DEMEURE", "level": 1 } },
          { "type": "paragraph", "data": { "text": "Cabinet {{cabinet_nom}}<br>Maître {{avocat_nom}}<br>{{adresse_cabinet}}<br>Tél : {{telephone_cabinet}} — Email : {{email_cabinet}}" } },
          { "type": "delimiter", "data": {} },
          { "type": "paragraph", "data": { "text": "À {{destinataire_prenom}} {{destinataire_nom}} / {{destinataire_raison_sociale}}<br>{{destinataire_adresse}}" } },
          { "type": "paragraph", "data": { "text": "{{ville}}, le {{date_redaction}}" } },
          { "type": "paragraph", "data": { "text": "<b>Lettre recommandée avec accusé de réception</b>" } },
          { "type": "paragraph", "data": { "text": "<b>Objet :</b> Mise en demeure — {{objet_bref}}<br><b>Réf. dossier :</b> {{reference_dossier}}" } },
          { "type": "delimiter", "data": {} },
          { "type": "paragraph", "data": { "text": "Madame, Monsieur," } },
          { "type": "paragraph", "data": { "text": "Je me permets de vous contacter en qualité d''avocat de {{client_prenom}} {{client_nom}} / {{client_raison_sociale}}, lequel m''a confié la défense de ses intérêts dans le présent dossier." } },
          { "type": "paragraph", "data": { "text": "Il ressort des éléments communiqués que {{expose_manquement}}." } },
          { "type": "paragraph", "data": { "text": "En conséquence, je vous mets en demeure, par la présente et dans un délai de <b>{{delai}} jours</b> à compter de la réception de ce courrier, de {{injonction}}." } },
          { "type": "paragraph", "data": { "text": "À défaut, mon client se verra contraint d''engager toute procédure judiciaire qu''il estimera utile pour faire valoir ses droits, et ce à vos frais et dépens exclusifs." } },
          { "type": "paragraph", "data": { "text": "Dans l''espoir d''un règlement amiable du présent différend, je reste à votre disposition." } },
          { "type": "delimiter", "data": {} },
          { "type": "paragraph", "data": { "text": "Veuillez agréer, Madame, Monsieur, l''expression de mes salutations distinguées." } },
          { "type": "paragraph", "data": { "text": "<br>Maître {{avocat_nom}}" } }
        ]
      }'::jsonb
    ),

    (
      'MODELE-COURRIER-CLIENT',
      'Courrier',
      'Compte rendu de diligences adressé au client',
      '{
        "time": 1743292800000,
        "version": "2.28.2",
        "blocks": [
          { "type": "header", "data": { "text": "COMPTE RENDU DE DILIGENCES", "level": 1 } },
          { "type": "paragraph", "data": { "text": "À {{client_prenom}} {{client_nom}}<br>{{client_adresse}}" } },
          { "type": "paragraph", "data": { "text": "{{ville}}, le {{date_redaction}}" } },
          { "type": "paragraph", "data": { "text": "<b>Objet :</b> Dossier {{reference_dossier}} — {{objet_bref}}" } },
          { "type": "delimiter", "data": {} },
          { "type": "paragraph", "data": { "text": "Cher(e) client(e)," } },
          { "type": "paragraph", "data": { "text": "Je vous adresse ce compte rendu afin de vous tenir informé(e) de l''état d''avancement de votre dossier." } },
          { "type": "header", "data": { "text": "Diligences effectuées", "level": 2 } },
          { "type": "list", "data": { "style": "unordered", "items": [
            "{{diligence_1}}",
            "{{diligence_2}}",
            "{{diligence_3}}"
          ]}},
          { "type": "header", "data": { "text": "Prochaines étapes", "level": 2 } },
          { "type": "paragraph", "data": { "text": "{{prochaines_etapes}}" } },
          { "type": "header", "data": { "text": "Situation financière du dossier", "level": 2 } },
          { "type": "paragraph", "data": { "text": "Provisions versées : {{provisions_versees}} €<br>Diligences à facturer : {{diligences_a_facturer}} €" } },
          { "type": "paragraph", "data": { "text": "Je reste à votre entière disposition pour tout renseignement complémentaire." } },
          { "type": "delimiter", "data": {} },
          { "type": "paragraph", "data": { "text": "Bien cordialement,<br>Maître {{avocat_nom}}" } }
        ]
      }'::jsonb
    ),

    -- -------------------------------------------------------
    -- Note interne (tous domaines)
    -- -------------------------------------------------------
    (
      'MODELE-NOTE-INTERNE-ANALYSE',
      'Note interne',
      'Note d''analyse juridique interne',
      '{
        "time": 1743292800000,
        "version": "2.28.2",
        "blocks": [
          { "type": "header", "data": { "text": "NOTE JURIDIQUE INTERNE", "level": 1 } },
          { "type": "paragraph", "data": { "text": "<b>Dossier :</b> {{reference_dossier}}<br><b>Rédigée par :</b> {{redacteur}}<br><b>Date :</b> {{date_redaction}}<br><b>Objet :</b> {{objet_note}}" } },
          { "type": "delimiter", "data": {} },
          { "type": "header", "data": { "text": "1. Rappel des faits", "level": 2 } },
          { "type": "paragraph", "data": { "text": "{{rappel_faits}}" } },
          { "type": "header", "data": { "text": "2. Question(s) juridique(s) posée(s)", "level": 2 } },
          { "type": "list", "data": { "style": "ordered", "items": [
            "{{question_1}}",
            "{{question_2}}"
          ]}},
          { "type": "header", "data": { "text": "3. Analyse et fondements juridiques", "level": 2 } },
          { "type": "paragraph", "data": { "text": "{{analyse_juridique}}" } },
          { "type": "header", "data": { "text": "4. Risques identifiés", "level": 2 } },
          { "type": "list", "data": { "style": "unordered", "items": [
            "<b>Risque élevé :</b> {{risque_eleve}}",
            "<b>Risque modéré :</b> {{risque_modere}}",
            "<b>Risque faible :</b> {{risque_faible}}"
          ]}},
          { "type": "header", "data": { "text": "5. Recommandations", "level": 2 } },
          { "type": "paragraph", "data": { "text": "{{recommandations}}" } },
          { "type": "header", "data": { "text": "6. Pièces consultées", "level": 2 } },
          { "type": "list", "data": { "style": "unordered", "items": [
            "{{piece_1}}",
            "{{piece_2}}"
          ]}},
          { "type": "delimiter", "data": {} },
          { "type": "quote", "data": { "text": "Document confidentiel — usage interne au cabinet uniquement.", "caption": "", "alignment": "left" } }
        ]
      }'::jsonb
    ),

    (
      'MODELE-NOTE-INTERNE-AUDIENCE',
      'Note interne',
      'Note de préparation d''audience',
      '{
        "time": 1743292800000,
        "version": "2.28.2",
        "blocks": [
          { "type": "header", "data": { "text": "NOTE DE PRÉPARATION D''AUDIENCE", "level": 1 } },
          { "type": "paragraph", "data": { "text": "<b>Dossier :</b> {{reference_dossier}}<br><b>Juridiction :</b> {{juridiction}}<br><b>Date audience :</b> {{date_audience}} à {{heure_audience}}<br><b>Avocat plaidant :</b> {{avocat_nom}}" } },
          { "type": "delimiter", "data": {} },
          { "type": "header", "data": { "text": "Résumé du litige", "level": 2 } },
          { "type": "paragraph", "data": { "text": "{{resume_litige}}" } },
          { "type": "header", "data": { "text": "Arguments à développer à l''audience", "level": 2 } },
          { "type": "list", "data": { "style": "ordered", "items": [
            "{{argument_1}}",
            "{{argument_2}}",
            "{{argument_3}}"
          ]}},
          { "type": "header", "data": { "text": "Points sensibles / contre-arguments attendus", "level": 2 } },
          { "type": "list", "data": { "style": "unordered", "items": [
            "{{contra_1}}",
            "{{contra_2}}"
          ]}},
          { "type": "header", "data": { "text": "Pièces à produire", "level": 2 } },
          { "type": "list", "data": { "style": "unordered", "items": [
            "Pièce n°1 — {{piece_1}}",
            "Pièce n°2 — {{piece_2}}"
          ]}},
          { "type": "header", "data": { "text": "Demandes à formuler", "level": 2 } },
          { "type": "list", "data": { "style": "ordered", "items": [
            "{{demande_1}}",
            "{{demande_2}}"
          ]}},
          { "type": "delimiter", "data": {} },
          { "type": "quote", "data": { "text": "Document confidentiel — usage interne au cabinet uniquement.", "caption": "", "alignment": "left" } }
        ]
      }'::jsonb
    )

  ) AS v(nom_modele, type_libelle, description, contenu_json)
),
resolved AS (
  SELECT
    td.id     AS id_type_document,
    s.nom_modele,
    s.description,
    s.contenu_json
  FROM modeles_source s
  JOIN type_document td ON td.libelle = s.type_libelle
)
INSERT INTO modele_document (id_type_document, nom_modele, description, contenu_json)
SELECT r.id_type_document, r.nom_modele, r.description, r.contenu_json
FROM resolved r
WHERE NOT EXISTS (
  SELECT 1 FROM modele_document md WHERE md.nom_modele = r.nom_modele
);

-- =========================================================
-- 2. RATTACHEMENT AUX SOUS-DOMAINES
-- =========================================================

WITH associations AS (
  SELECT *
  FROM (
    VALUES
      -- Assignation prud'hommes → Licenciement + Harcèlement
      ('MODELE-ASSIGNATION-PRUD',       'Licenciement'),
      ('MODELE-ASSIGNATION-PRUD',       'Harcelement'),
      -- Assignation référé → tous sous-domaines
      ('MODELE-ASSIGNATION-REFERE',     'Licenciement'),
      ('MODELE-ASSIGNATION-REFERE',     'Harcelement'),
      ('MODELE-ASSIGNATION-REFERE',     'Contrats commerciaux'),
      ('MODELE-ASSIGNATION-REFERE',     'Infractions financieres'),
      -- Conclusions appel → Licenciement + Harcèlement
      ('MODELE-CONCLUSIONS-APPEL',      'Licenciement'),
      ('MODELE-CONCLUSIONS-APPEL',      'Harcelement'),
      -- Conclusions harcèlement → Harcèlement
      ('MODELE-CONCLUSIONS-HARCELEMENT','Harcelement'),
      -- Conclusions affaires → Contrats commerciaux
      ('MODELE-CONCLUSIONS-AFFAIRES',   'Contrats commerciaux'),
      -- Courrier mise en demeure → tous sous-domaines
      ('MODELE-COURRIER-MISE-EN-DEMEURE','Licenciement'),
      ('MODELE-COURRIER-MISE-EN-DEMEURE','Harcelement'),
      ('MODELE-COURRIER-MISE-EN-DEMEURE','Contrats commerciaux'),
      ('MODELE-COURRIER-MISE-EN-DEMEURE','Infractions financieres'),
      -- Courrier client → tous sous-domaines
      ('MODELE-COURRIER-CLIENT',         'Licenciement'),
      ('MODELE-COURRIER-CLIENT',         'Harcelement'),
      ('MODELE-COURRIER-CLIENT',         'Contrats commerciaux'),
      ('MODELE-COURRIER-CLIENT',         'Infractions financieres'),
      -- Notes internes → tous sous-domaines
      ('MODELE-NOTE-INTERNE-ANALYSE',   'Licenciement'),
      ('MODELE-NOTE-INTERNE-ANALYSE',   'Harcelement'),
      ('MODELE-NOTE-INTERNE-ANALYSE',   'Contrats commerciaux'),
      ('MODELE-NOTE-INTERNE-ANALYSE',   'Infractions financieres'),
      ('MODELE-NOTE-INTERNE-AUDIENCE',  'Licenciement'),
      ('MODELE-NOTE-INTERNE-AUDIENCE',  'Harcelement'),
      ('MODELE-NOTE-INTERNE-AUDIENCE',  'Contrats commerciaux'),
      ('MODELE-NOTE-INTERNE-AUDIENCE',  'Infractions financieres')
  ) AS v(nom_modele, sous_domaine_libelle)
)
INSERT INTO modele_sous_domaine (id_modele, id_sous_domaine)
SELECT md.id, sd.id
FROM associations a
JOIN modele_document md ON md.nom_modele = a.nom_modele
JOIN sous_domaine    sd ON sd.libelle     = a.sous_domaine_libelle
ON CONFLICT (id_modele, id_sous_domaine) DO NOTHING;

-- =========================================================
-- 3. VERSIONS PUBLIÉES (v1 pour chaque modèle)
-- =========================================================

INSERT INTO modele_document_version (
  id_modele,
  numero_version,
  contenu_json,
  cree_le,
  cree_par
)
SELECT
  md.id,
  1,
  md.contenu_json,
  NOW(),
  (SELECT id FROM collaborateur ORDER BY id LIMIT 1)
FROM modele_document md
WHERE md.nom_modele IN (
  'MODELE-ASSIGNATION-PRUD',
  'MODELE-ASSIGNATION-REFERE',
  'MODELE-CONCLUSIONS-APPEL',
  'MODELE-CONCLUSIONS-HARCELEMENT',
  'MODELE-CONCLUSIONS-AFFAIRES',
  'MODELE-COURRIER-MISE-EN-DEMEURE',
  'MODELE-COURRIER-CLIENT',
  'MODELE-NOTE-INTERNE-ANALYSE',
  'MODELE-NOTE-INTERNE-AUDIENCE'
)
ON CONFLICT (id_modele, numero_version) DO NOTHING;
