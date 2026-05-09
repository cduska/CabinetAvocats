-- =========================================================
-- Peuplement : paragraphes prédéfinis
-- Date       : 2026-05-09
-- Idempotente : oui (DELETE avant INSERT)
-- =========================================================
--
-- LÉGENDE DES PLACEHOLDERS
-- ─────────────────────────────────────────────────────────
-- Auto-remplis depuis le dossier (clés templateVars) :
--   [NOM CLIENT]        → nom complet du client du dossier
--   [NOM SOCIÉTÉ]       → idem (quand le client est une société)
--   [NOM DOSSIER]       → référence du dossier (ex. DOS-2026-001)
--   [RÉFÉRENCE DOSSIER] → idem
--   [VILLE]             → ville de l'agence
--   [NOM AVOCAT]        → prénom + nom de l'avocat connecté
--   [DATE OUVERTURE]    → date d'ouverture du dossier
--   [DATE ÉCHÉANCE]     → date d'échéance du dossier
--   [MONTANT]           → montant HT du dossier
--   [DATE]              → date du jour (génération du document)
--   [ANNÉE]             → année en cours
--
-- À remplir manuellement (spécifiques à l'affaire) :
--   [DATE DÉCISION]     → date d'un jugement ou arrêt
--   [DATE AUDIENCE]     → date d'une audience
--   [DATE JUGEMENT]     → date d'un jugement de première instance
--   [DATE LICENCIEMENT] → date du licenciement
--   [DATE EMBAUCHE]     → date d'embauche du salarié
--   [DATE SIGNALEMENT]  → date du signalement interne
--   [DATE SIGNIFICATION]→ date de signification de l'acte
--   [POSTE]             → intitulé du poste
--   [SALAIRE]           → salaire mensuel brut en euros
--   [CONGÉS PAYÉS]      → montant des congés payés afférents
--   [MONTANT RÉCLAMÉ]   → montant spécifique réclamé (≠ montant dossier)
--   [MONTANT PROVISION] → provision demandée en référé
--   [ART. LOI]          → référence d'un article de loi (ex. L.1152-1 CT)
--   [JURIDICTION]       → nom de la juridiction saisie
--   [ADVERSAIRE]        → identité ou conseil de la partie adverse
--   [AUTEUR HARCÈLEMENT]→ identité de l'auteur du harcèlement
--   [MOTIF URGENCE]     → motif justifiant la procédure en référé
--   [OBJET]             → objet de la mise en demeure
-- =========================================================

BEGIN;

-- Nettoyage pour rendre le script ré-exécutable
TRUNCATE TABLE paragraphe_predefini RESTART IDENTITY CASCADE;

-- ─────────────────────────────────────────────────────────
-- PARAGRAPHES GÉNÉRIQUES (id_modele NULL)
-- Réutilisables dans tout type de document
-- ─────────────────────────────────────────────────────────

INSERT INTO paragraphe_predefini (id_modele, ordre, titre, categorie, contenu) VALUES

-- Formules d'introduction
(NULL, 1,  'En l''état du dossier',          'Introduction',
 'En l''état du dossier [NOM DOSSIER] et des pièces versées aux débats, il ressort les éléments suivants.'),
(NULL, 2,  'Rappel des faits',               'Introduction',
 'À titre liminaire, il convient de rappeler les faits à l''origine du présent litige, tels qu''ils résultent des pièces versées aux débats.'),
(NULL, 3,  'Objet de la procédure',          'Introduction',
 'La présente procédure a pour objet d''obtenir réparation du préjudice subi par notre client du fait des agissements de la partie adverse.'),

-- Formules de politesse (courriers)
(NULL, 1,  'Salutation formelle',            'Politesse',
 'Je vous prie d''agréer, Maître, l''expression de mes salutations distinguées.'),
(NULL, 2,  'Salutation client',              'Politesse',
 'Nous vous prions de croire, Madame, Monsieur, en l''expression de nos salutations distinguées.'),
(NULL, 3,  'Prise de contact',               'Politesse',
 'J''ai l''honneur de me présenter à vous en qualité de conseil de [NOM CLIENT] dans le cadre du dossier [NOM DOSSIER].'),
(NULL, 4,  'Disponibilité pour rendez-vous', 'Politesse',
 'Je reste à votre disposition pour tout complément d''information et vous propose, si vous le souhaitez, de nous rencontrer afin d''évoquer ce dossier.'),
(NULL, 5,  'Signature avocat',               'Politesse',
 'Maître [NOM AVOCAT]\nAvocat au Barreau de [VILLE]\nFait à [VILLE], le [DATE]'),

-- Moyens de droit généraux
(NULL, 1,  'Violation du principe du contradictoire',  'Moyens de droit',
 'En tout état de cause, la décision querellée a été rendue en violation du principe du contradictoire, en ce qu''elle ne permet pas à notre client de faire valoir ses droits et observations.'),
(NULL, 2,  'Droit à réparation intégrale',             'Moyens de droit',
 'Conformément au principe de réparation intégrale du préjudice, la victime doit être replacée dans la situation qui aurait été la sienne si le fait dommageable ne s''était pas produit.'),
(NULL, 3,  'Charge de la preuve',                      'Moyens de droit',
 'Il appartient à la partie adverse d''apporter la preuve des faits qu''elle allègue, conformément à l''article 1353 du Code civil.'),
(NULL, 4,  'Bonne foi contractuelle',                  'Moyens de droit',
 'En application de l''article 1104 du Code civil, les contrats doivent être négociés, formés et exécutés de bonne foi, ce que la partie adverse n''a manifestement pas respecté en l''espèce.'),

-- Dispositifs / demandes
(NULL, 1,  'Demande de condamnation aux dépens',       'Dispositif',
 'Condamner la partie adverse aux entiers dépens de l''instance.'),
(NULL, 2,  'Demande article 700 CPC',                  'Dispositif',
 'Condamner la partie adverse à payer à [NOM CLIENT] la somme de [MONTANT] euros au titre de l''article 700 du Code de procédure civile.'),
(NULL, 3,  'Demande d''exécution provisoire',           'Dispositif',
 'Ordonner l''exécution provisoire de la décision à intervenir.'),
(NULL, 4,  'Réserve de tous droits',                   'Dispositif',
 'Se réserver le droit d''articuler tous nouveaux chefs de préjudice et de toutes nouvelles demandes en fonction des éléments qui pourraient être portés à la connaissance de Maître [NOM AVOCAT].'),

-- ─────────────────────────────────────────────────────────
-- CONCLUSIONS APPEL (id_modele = 6)
-- ─────────────────────────────────────────────────────────
(6, 1,  'Infirmation du jugement',              'Introduction',
 'La cour est saisie de l''appel interjeté par [NOM CLIENT] à l''encontre du jugement rendu le [DATE JUGEMENT] par le Conseil de Prud''hommes de [VILLE], dont il sollicite l''infirmation en toutes ses dispositions.'),
(6, 2,  'Recevabilité de l''appel',              'Introduction',
 'L''appel a été interjeté dans les formes et délais prescrits par la loi. Il est en conséquence parfaitement recevable.'),
(6, 3,  'Erreur dans l''appréciation des faits', 'Faits',
 'Le premier juge a commis une erreur manifeste dans l''appréciation des faits de l''espèce, en ne tenant pas compte des pièces versées aux débats qui établissent pourtant sans ambiguïté la réalité des griefs invoqués.'),
(6, 4,  'Mauvaise application du droit',         'Discussion',
 'Le tribunal a fait une mauvaise application des textes légaux applicables, et notamment de l''article [ART. LOI], en retenant une interprétation contraire à la jurisprudence constante de la Cour de cassation.'),
(6, 5,  'Confirmer sur les dépens',              'Dispositif',
 'Confirmer le jugement en ce qu''il a condamné l''intimé aux dépens de première instance, y ajoutant la condamnation aux dépens d''appel.'),
(6, 6,  'Infirmer et statuer à nouveau',         'Dispositif',
 'Infirmer le jugement entrepris en toutes ses dispositions, statuant à nouveau, condamner [ADVERSAIRE] à payer à [NOM CLIENT] la somme de [MONTANT RÉCLAMÉ] euros à titre de [OBJET CRÉANCE].'),

-- ─────────────────────────────────────────────────────────
-- ASSIGNATION PRUD'HOMALE (id_modele = 4)
-- ─────────────────────────────────────────────────────────
(4, 1,  'En-tête assignation prud''homale',     'Introduction',
 'L''an deux mil [ANNÉE], et le [DATE SIGNIFICATION],\nÀ la requête de [NOM CLIENT], demeurant [ADRESSE], représenté par Maître [NOM AVOCAT], avocat inscrit au Barreau de [VILLE],\nJ''ai, [NOM HUISSIER], huissier de justice soussigné, signifié et donné assignation à :'),
(4, 2,  'Objet prud''homal',                    'Introduction',
 'La présente assignation a pour objet de saisir le Conseil de Prud''hommes de [VILLE] aux fins de condamner l''employeur défendeur à payer à [NOM CLIENT] les sommes réclamées au titre de l''exécution et de la rupture du contrat de travail.'),
(4, 3,  'Rappel relation de travail',            'Faits',
 'Notre client [NOM CLIENT] a été engagé par la société [NOM SOCIÉTÉ] suivant contrat de travail à durée indéterminée en date du [DATE EMBAUCHE], en qualité de [POSTE], moyennant une rémunération mensuelle brute de [SALAIRE] euros.'),
(4, 4,  'Rupture abusive',                       'Discussion',
 'Le licenciement notifié à [NOM CLIENT] par lettre recommandée avec accusé de réception en date du [DATE LICENCIEMENT] est dépourvu de cause réelle et sérieuse, la partie adverse n''établissant pas la réalité des griefs allégués.'),
(4, 5,  'Demande de dommages-intérêts',          'Dispositif',
 'Condamner la société [NOM SOCIÉTÉ] à payer à [NOM CLIENT] la somme de [MONTANT RÉCLAMÉ] euros à titre de dommages-intérêts pour licenciement sans cause réelle et sérieuse.'),
(4, 6,  'Demande de rappel de salaire',          'Dispositif',
 'Condamner la société [NOM SOCIÉTÉ] à payer à [NOM CLIENT] la somme de [MONTANT RÉCLAMÉ] euros à titre de rappel de salaire, outre la somme de [CONGÉS PAYÉS] euros au titre des congés payés afférents.'),

-- ─────────────────────────────────────────────────────────
-- ASSIGNATION EN RÉFÉRÉ (id_modele = 10)
-- ─────────────────────────────────────────────────────────
(10, 1, 'En-tête référé',                        'Introduction',
 'Nous soumettons au juge des référés saisi en urgence, sur requête de [NOM CLIENT], la situation suivante qui justifie qu''il soit statué en référé conformément aux articles 484 et suivants du Code de procédure civile.'),
(10, 2, 'Urgence caractérisée',                   'Discussion',
 'L''urgence est caractérisée en l''espèce par [MOTIF URGENCE], situation qui nécessite une intervention judiciaire immédiate afin d''éviter un dommage imminent et irréparable pour [NOM CLIENT].'),
(10, 3, 'Absence de contestation sérieuse',       'Discussion',
 'L''obligation de la partie adverse de [OBJET OBLIGATION] ne fait l''objet d''aucune contestation sérieuse, le défendeur ne pouvant valablement opposer [ARGUMENT ADVERSE].'),
(10, 4, 'Mesure d''interdiction',                 'Dispositif',
 'Interdire à [ADVERSAIRE], sous astreinte de [MONTANT RÉCLAMÉ] euros par infraction constatée, de [ACTE INTERDIT], et ce jusqu''à ce qu''il ait été statué au fond.'),
(10, 5, 'Provision ad litem',                     'Dispositif',
 'Condamner [ADVERSAIRE] à payer à [NOM CLIENT] une provision de [MONTANT PROVISION] euros à valoir sur l''indemnisation définitive de son préjudice.'),

-- ─────────────────────────────────────────────────────────
-- COURRIER MISE EN DEMEURE (id_modele = 7)
-- ─────────────────────────────────────────────────────────
(7, 1,  'En-tête lettre',                        'Introduction',
 '[VILLE], le [DATE]\n\nMaître [NOM AVOCAT]\nAvocat au Barreau de [VILLE]\n\nConcerne : Dossier [NOM DOSSIER] – Mise en demeure'),
(7, 2,  'Objet mise en demeure',                  'Introduction',
 'Je me permets de me rapprocher de vous en qualité de conseil de [NOM CLIENT], afin de vous mettre en demeure de [OBJET], dans les meilleurs délais.'),
(7, 3,  'Rappel des obligations inexécutées',     'Faits',
 'Malgré les relances amiables effectuées les [DATES RELANCES], vous n''avez pas donné suite à vos obligations contractuelles, notamment [DESCRIPTION MANQUEMENTS].'),
(7, 4,  'Délai de régularisation',                'Discussion',
 'Je vous mets en demeure de régulariser cette situation dans un délai de [DÉLAI] jours à compter de la réception de la présente, faute de quoi [NOM CLIENT] se verra contraint d''engager toutes les procédures judiciaires utiles à la défense de ses droits.'),
(7, 5,  'Réserve de préjudices',                  'Discussion',
 '[NOM CLIENT] se réserve d''ores et déjà le droit de réclamer l''indemnisation de l''intégralité du préjudice subi du fait de vos manquements, qui s''élève à ce jour à la somme de [MONTANT RÉCLAMÉ] euros.'),
(7, 6,  'Clôture mise en demeure',                'Politesse',
 'Dans l''attente de votre retour, que j''espère favorable, je vous prie de croire, Maître, en l''expression de mes salutations distinguées.\n\nMaître [NOM AVOCAT]'),

-- ─────────────────────────────────────────────────────────
-- COURRIER CLIENT (id_modele = 11)
-- ─────────────────────────────────────────────────────────
(11, 1, 'En-tête courrier client',               'Introduction',
 '[VILLE], le [DATE]\n\nMaître [NOM AVOCAT]\nAvocat au Barreau de [VILLE]\n\nÀ l''attention de [NOM CLIENT]\nConcerne : Dossier [NOM DOSSIER]'),
(11, 2, 'Point d''étape dossier',                'Introduction',
 'Je vous adresse le présent courrier afin de vous tenir informé de l''évolution de votre dossier [NOM DOSSIER] et des prochaines étapes de la procédure.'),
(11, 3, 'Décision de justice',                   'Faits',
 'Par décision en date du [DATE DÉCISION], la juridiction saisie a [RÉSUMÉ DÉCISION]. Cette décision [EST/N''EST PAS] susceptible de recours dans un délai de [DÉLAI] jours.'),
(11, 4, 'Délai de réponse adverse',              'Discussion',
 'La partie adverse dispose désormais d''un délai de [DÉLAI] pour [ACTION REQUISE]. Dès réception de sa réponse, je reviendrai vers vous pour définir la suite à donner.'),
(11, 5, 'Documents à produire',                  'Discussion',
 'Afin de poursuivre la défense de vos intérêts dans les meilleures conditions, je vous serais reconnaissant de bien vouloir me faire parvenir les documents suivants : [LISTE DOCUMENTS].'),
(11, 6, 'Honoraires et provision',               'Discussion',
 'Conformément à notre convention d''honoraires, je vous adresse en pièce jointe une note d''honoraires au titre de [DESCRIPTION DILIGENCES] concernant le dossier [NOM DOSSIER].'),

-- ─────────────────────────────────────────────────────────
-- CONCLUSIONS AFFAIRES (id_modele = 8)
-- ─────────────────────────────────────────────────────────
(8, 1,  'Présentation des parties',              'Introduction',
 'La société [NOM SOCIÉTÉ], [FORME SOCIALE] au capital de [CAPITAL] euros, immatriculée au RCS de [VILLE] sous le n° [SIRET], a pour activité principale [ACTIVITÉ].'),
(8, 2,  'Relation commerciale',                  'Faits',
 'Les parties entretiennent une relation commerciale établie depuis [DATE DÉBUT RELATION] matérialisée par [NATURE CONTRATS] dont les conditions sont définies contractuellement.'),
(8, 3,  'Inexécution contractuelle',             'Discussion',
 'En l''espèce, la partie adverse a manqué à ses obligations contractuelles en [DESCRIPTION MANQUEMENT], ce qui a causé à [NOM CLIENT] un préjudice certain et direct évalué à [MONTANT RÉCLAMÉ] euros.'),
(8, 4,  'Responsabilité délictuelle',            'Discussion',
 'À titre subsidiaire, les faits décrits constituent une faute au sens de l''article 1240 du Code civil, engageant la responsabilité délictuelle de la partie adverse à l''égard de [NOM CLIENT].'),
(8, 5,  'Demande en paiement',                   'Dispositif',
 'Condamner la partie adverse à payer à [NOM CLIENT] la somme de [MONTANT RÉCLAMÉ] euros HT au titre de [OBJET CRÉANCE], assortie des intérêts au taux légal à compter du [DATE MISE EN DEMEURE].'),

-- ─────────────────────────────────────────────────────────
-- CONCLUSIONS HARCÈLEMENT (id_modele = 9)
-- ─────────────────────────────────────────────────────────
(9, 1,  'Définition légale harcèlement',         'Discussion',
 'En application de l''article L. 1152-1 du Code du travail, aucun salarié ne doit subir les agissements répétés de harcèlement moral qui ont pour objet ou pour effet une dégradation de ses conditions de travail susceptible de porter atteinte à ses droits et à sa dignité, d''altérer sa santé physique ou mentale ou de compromettre son avenir professionnel.'),
(9, 2,  'Matérialité des faits de harcèlement',  'Faits',
 'En l''espèce, [NOM CLIENT] a subi de façon répétée les agissements suivants de la part de [AUTEUR HARCÈLEMENT] : [DESCRIPTION FAITS]. Ces agissements, pris dans leur ensemble, caractérisent indubitablement une situation de harcèlement moral.'),
(9, 3,  'Altération de la santé',                'Faits',
 'Ces agissements ont eu pour effet direct d''altérer gravement l''état de santé de [NOM CLIENT], comme en attestent les certificats médicaux et arrêts de travail versés aux débats (Pièces n° [NUMÉROS PIÈCES]).'),
(9, 4,  'Obligation de sécurité de l''employeur', 'Discussion',
 'L''employeur, tenu d''une obligation de sécurité en matière de harcèlement moral, n''a pris aucune mesure pour faire cesser les agissements dénoncés, alors même qu''il en avait connaissance depuis le [DATE SIGNALEMENT].'),
(9, 5,  'Nullité du licenciement',               'Dispositif',
 'Prononcer la nullité du licenciement de [NOM CLIENT] en ce qu''il est consécutif à une situation de harcèlement moral, et condamner en conséquence la société [NOM SOCIÉTÉ] à lui payer la somme de [MONTANT RÉCLAMÉ] euros à titre de dommages-intérêts.'),

-- ─────────────────────────────────────────────────────────
-- NOTE INTERNE ANALYSE (id_modele = 5)
-- ─────────────────────────────────────────────────────────
(5, 1,  'En-tête note interne',                  'Introduction',
 'NOTE INTERNE CONFIDENTIELLE\nDossier : [NOM DOSSIER]\nClient : [NOM CLIENT]\nRédacteur : Maître [NOM AVOCAT]\nDate : [DATE]\nObjet : analyse juridique et stratégie'),
(5, 2,  'Objet de la note',                      'Introduction',
 'La présente note a pour objet d''analyser les arguments juridiques susceptibles d''être invoqués par [NOM CLIENT] dans le cadre du litige l''opposant à [ADVERSAIRE], et d''évaluer les chances de succès d''une action en justice.'),
(5, 3,  'Analyse des risques',                   'Discussion',
 'Sur la base des éléments communiqués, le risque de condamnation est estimé à [FAIBLE/MODÉRÉ/ÉLEVÉ]. Les principales incertitudes portent sur [POINTS INCERTAINS].'),
(5, 4,  'Stratégie contentieuse recommandée',    'Discussion',
 'Au regard de ce qui précède, il est recommandé d''adopter la stratégie suivante : [DESCRIPTION STRATÉGIE]. Cette approche permettra de maximiser les chances de succès tout en limitant les coûts de procédure.'),
(5, 5,  'Évaluation du préjudice',               'Discussion',
 'Le préjudice de [NOM CLIENT] peut être évalué comme suit : préjudice matériel [MONTANT MATÉRIEL] €, préjudice moral [MONTANT MORAL] €, soit un total de [MONTANT TOTAL] €. Il convient toutefois de réserver les préjudices non encore chiffrables.'),
(5, 6,  'Prochaines diligences',                 'Discussion',
 'Les diligences à effectuer dans les prochaines semaines sont les suivantes :\n1. [DILIGENCE 1]\n2. [DILIGENCE 2]\n3. [DILIGENCE 3]\nUn point d''étape sera effectué le [DATE POINT ÉTAPE].'),

-- ─────────────────────────────────────────────────────────
-- NOTE INTERNE AUDIENCE (id_modele = 12)
-- ─────────────────────────────────────────────────────────
(12, 1, 'En-tête compte rendu d''audience',      'Introduction',
 'COMPTE RENDU D''AUDIENCE – CONFIDENTIEL\nDossier : [NOM DOSSIER]\nClient : [NOM CLIENT]\nRédacteur : Maître [NOM AVOCAT]\nDate d''audience : [DATE AUDIENCE]\nJuridiction : [JURIDICTION]'),
(12, 2, 'Composition du tribunal',               'Faits',
 'L''audience s''est tenue le [DATE AUDIENCE] devant [JURIDICTION]. La partie adverse était représentée par Maître [ADVERSAIRE]. Le tribunal a fixé l''affaire au [DATE PROCHAIN RENVOI] pour [OBJET RENVOI].'),
(12, 3, 'Arguments développés',                  'Discussion',
 'À l''audience, nous avons principalement développé les arguments suivants :\n– [ARGUMENT 1]\n– [ARGUMENT 2]\n– [ARGUMENT 3]\nLa partie adverse a quant à elle soutenu [POSITION ADVERSE].'),
(12, 4, 'Décision rendue',                       'Discussion',
 'Le tribunal a rendu sa décision en ces termes : [RÉSUMÉ DÉCISION]. Cette décision [EST/N''EST PAS] susceptible d''appel dans un délai de [DÉLAI RECOURS] jours.'),
(12, 5, 'Suites à donner',                       'Discussion',
 'À la suite de cette audience, les diligences suivantes sont à effectuer :\n– Informer [NOM CLIENT] : délai [DÉLAI INFO CLIENT]\n– Signifier la décision : avant le [DATE LIMITE SIGNIFICATION]\n– Envisager un recours : [MOTIFS RECOURS SI PERTINENT]');

COMMIT;


-- Nettoyage pour rendre le script ré-exécutable
TRUNCATE TABLE paragraphe_predefini RESTART IDENTITY CASCADE;

-- ─────────────────────────────────────────────────────────
-- PARAGRAPHES GÉNÉRIQUES (id_modele NULL)
-- Réutilisables dans tout type de document
-- ─────────────────────────────────────────────────────────

INSERT INTO paragraphe_predefini (id_modele, ordre, titre, categorie, contenu) VALUES

-- Formules d'introduction
(NULL, 1,  'En l''état du dossier',          'Introduction',
 'En l''état du dossier et des pièces versées aux débats, il ressort les éléments suivants.'),
(NULL, 2,  'Rappel des faits',               'Introduction',
 'À titre liminaire, il convient de rappeler les faits à l''origine du présent litige, tels qu''ils résultent des pièces versées aux débats.'),
(NULL, 3,  'Objet de la procédure',          'Introduction',
 'La présente procédure a pour objet d''obtenir réparation du préjudice subi par notre client du fait des agissements de la partie adverse.'),

-- Formules de politesse (courriers)
(NULL, 1,  'Salutation formelle',            'Politesse',
 'Je vous prie d''agréer, Maître, l''expression de mes salutations distinguées.'),
(NULL, 2,  'Salutation client',              'Politesse',
 'Nous vous prions de croire, Madame, Monsieur, en l''expression de nos salutations distinguées.'),
(NULL, 3,  'Prise de contact',               'Politesse',
 'J''ai l''honneur de me présenter à vous en qualité de conseil de [NOM CLIENT] dans le cadre du dossier référencé ci-dessus.'),
(NULL, 4,  'Disponibilité pour rendez-vous', 'Politesse',
 'Je reste à votre disposition pour tout complément d''information et vous propose, si vous le souhaitez, de nous rencontrer afin d''évoquer ce dossier.'),

-- Moyens de droit généraux
(NULL, 1,  'Violation du principe du contradictoire',  'Moyens de droit',
 'En tout état de cause, la décision querellée a été rendue en violation du principe du contradictoire, en ce qu''elle ne permet pas à notre client de faire valoir ses droits et observations.'),
(NULL, 2,  'Droit à réparation intégrale',             'Moyens de droit',
 'Conformément au principe de réparation intégrale du préjudice, la victime doit être replacée dans la situation qui aurait été la sienne si le fait dommageable ne s''était pas produit.'),
(NULL, 3,  'Charge de la preuve',                      'Moyens de droit',
 'Il appartient à la partie adverse d''apporter la preuve des faits qu''elle allègue, conformément à l''article 1353 du Code civil.'),
(NULL, 4,  'Bonne foi contractuelle',                  'Moyens de droit',
 'En application de l''article 1104 du Code civil, les contrats doivent être négociés, formés et exécutés de bonne foi, ce que la partie adverse n''a manifestement pas respecté en l''espèce.'),

-- Dispositifs / demandes
(NULL, 1,  'Demande de condamnation aux dépens',       'Dispositif',
 'Condamner la partie adverse aux entiers dépens de l''instance.'),
(NULL, 2,  'Demande article 700 CPC',                  'Dispositif',
 'Condamner la partie adverse à payer à notre client la somme de [MONTANT] euros au titre de l''article 700 du Code de procédure civile.'),
(NULL, 3,  'Demande d''exécution provisoire',           'Dispositif',
 'Ordonner l''exécution provisoire de la décision à intervenir.'),
(NULL, 4,  'Réserve de tous droits',                   'Dispositif',
 'Se réserver le droit d''articuler tous nouveaux chefs de préjudice et de toutes nouvelles demandes en fonction des éléments qui pourraient être portés à la connaissance du soussigné.'),

-- ─────────────────────────────────────────────────────────
-- CONCLUSIONS APPEL (id_modele = 6)
-- ─────────────────────────────────────────────────────────
(6, 1,  'Infirmation du jugement',             'Introduction',
 'La cour est saisie de l''appel interjeté par notre client à l''encontre du jugement rendu le [DATE] par le Conseil de Prud''hommes de [VILLE], dont il sollicite l''infirmation en toutes ses dispositions.'),
(6, 2,  'Recevabilité de l''appel',             'Introduction',
 'L''appel a été interjeté dans les formes et délais prescrits par la loi. Il est en conséquence parfaitement recevable.'),
(6, 3,  'Erreur dans l''appréciation des faits','Faits',
 'Le premier juge a commis une erreur manifeste dans l''appréciation des faits de l''espèce, en ne tenant pas compte des pièces versées aux débats qui établissent pourtant sans ambiguïté la réalité des griefs invoqués.'),
(6, 4,  'Mauvaise application du droit',        'Discussion',
 'Le tribunal a fait une mauvaise application des textes légaux applicables, et notamment de l''article [RÉFÉRENCE], en retenant une interprétation contraire à la jurisprudence constante de la Cour de cassation.'),
(6, 5,  'Confirmer sur les dépens',             'Dispositif',
 'Confirmer le jugement en ce qu''il a condamné l''intimé aux dépens de première instance, y ajoutant la condamnation aux dépens d''appel.'),

-- ─────────────────────────────────────────────────────────
-- ASSIGNATION PRUD'HOMALE (id_modele = 4)
-- ─────────────────────────────────────────────────────────
(4, 1,  'En-tête assignation prud''homale',    'Introduction',
 'L''an deux mil [ANNÉE], et le [DATE SIGNIFICATION],\nÀ la requête de [NOM CLIENT], demeurant [ADRESSE], représenté par Maître [NOM AVOCAT], avocat inscrit au Barreau de [VILLE],\nJ''ai, [NOM HUISSIER], huissier de justice [COORDONNÉES], signifié et donné assignation à :'),
(4, 2,  'Objet prud''homal',                   'Introduction',
 'La présente assignation a pour objet de saisir le Conseil de Prud''hommes de [VILLE] aux fins de condamner l''employeur défendeur à payer à notre client les sommes réclamées au titre de l''exécution et de la rupture du contrat de travail.'),
(4, 3,  'Rappel relation de travail',           'Faits',
 'Notre client a été engagé par la société [NOM SOCIÉTÉ] suivant contrat de travail à durée indéterminée en date du [DATE EMBAUCHE], en qualité de [POSTE], moyennant une rémunération mensuelle brute de [SALAIRE] euros.'),
(4, 4,  'Rupture abusive',                      'Discussion',
 'Le licenciement notifié à notre client par lettre recommandée avec accusé de réception en date du [DATE LICENCIEMENT] est dépourvu de cause réelle et sérieuse, la partie adverse n''établissant pas la réalité des griefs allégués.'),
(4, 5,  'Demande de dommages-intérêts',         'Dispositif',
 'Condamner la société [NOM SOCIÉTÉ] à payer à notre client la somme de [MONTANT] euros à titre de dommages-intérêts pour licenciement sans cause réelle et sérieuse.'),
(4, 6,  'Demande de rappel de salaire',         'Dispositif',
 'Condamner la société [NOM SOCIÉTÉ] à payer à notre client la somme de [MONTANT] euros à titre de rappel de salaire, outre la somme de [MONTANT x 10%] euros au titre des congés payés afférents.'),

-- ─────────────────────────────────────────────────────────
-- ASSIGNATION EN RÉFÉRÉ (id_modele = 10)
-- ─────────────────────────────────────────────────────────
(10, 1, 'En-tête référé',                       'Introduction',
 'Nous soumettons au juge des référés saisi en urgence la situation suivante, qui justifie qu''il soit statué en référé conformément aux articles 484 et suivants du Code de procédure civile.'),
(10, 2, 'Urgence caractérisée',                  'Discussion',
 'L''urgence est caractérisée en l''espèce par [MOTIF URGENCE], situation qui nécessite une intervention judiciaire immédiate afin d''éviter un dommage imminent et irréparable.'),
(10, 3, 'Absence de contestation sérieuse',      'Discussion',
 'L''obligation de la partie adverse de [OBJET OBLIGATION] ne fait l''objet d''aucune contestation sérieuse, le défendeur ne pouvant valablement opposer [ARGUMENT ADVERSE].'),
(10, 4, 'Mesure d''interdiction',                'Dispositif',
 'Interdire à la partie adverse, sous astreinte de [MONTANT] euros par infraction constatée, de [ACTE INTERDIT], et ce jusqu''à ce qu''il ait été statué au fond.'),
(10, 5, 'Provision ad litem',                    'Dispositif',
 'Condamner la partie adverse à payer à notre client une provision de [MONTANT] euros à valoir sur l''indemnisation définitive de son préjudice.'),

-- ─────────────────────────────────────────────────────────
-- COURRIER MISE EN DEMEURE (id_modele = 7)
-- ─────────────────────────────────────────────────────────
(7, 1,  'Objet mise en demeure',                 'Introduction',
 'Je me permets de me rapprocher de vous en qualité de conseil de [NOM CLIENT], afin de vous mettre en demeure de [OBJET], dans les meilleurs délais.'),
(7, 2,  'Rappel des obligations inexécutées',    'Faits',
 'Malgré les relances amiables effectuées les [DATES RELANCES], vous n''avez pas donné suite à vos obligations contractuelles, notamment [DESCRIPTION MANQUEMENTS].'),
(7, 3,  'Délai de régularisation',               'Discussion',
 'Je vous mets en demeure de régulariser cette situation dans un délai de [DÉLAI] jours à compter de la réception de la présente, faute de quoi mon client se verra contraint d''engager toutes les procédures judiciaires utiles à la défense de ses droits.'),
(7, 4,  'Réserve de préjudices',                 'Discussion',
 'Mon client se réserve d''ores et déjà le droit de réclamer l''indemnisation de l''intégralité du préjudice subi du fait de vos manquements, qui s''élève à ce jour à la somme de [MONTANT] euros.'),
(7, 5,  'Clôture mise en demeure',               'Politesse',
 'Dans l''attente de votre retour, que j''espère favorable, je vous prie de croire, Maître, en l''expression de mes salutations distinguées.'),

-- ─────────────────────────────────────────────────────────
-- COURRIER CLIENT (id_modele = 11)
-- ─────────────────────────────────────────────────────────
(11, 1, 'Point d''étape dossier',                'Introduction',
 'Je vous adresse le présent courrier afin de vous tenir informé de l''évolution de votre dossier et des prochaines étapes de la procédure.'),
(11, 2, 'Décision de justice',                   'Faits',
 'Par décision en date du [DATE], la juridiction saisie a [RÉSUMÉ DÉCISION]. Cette décision [APPRÉCIATON : est/n''est pas] susceptible de recours.'),
(11, 3, 'Délai de réponse adverse',              'Discussion',
 'La partie adverse dispose désormais d''un délai de [DÉLAI] pour [ACTION REQUISE]. Dès réception de sa réponse, je reviendrai vers vous pour définir la suite à donner.'),
(11, 4, 'Documents à produire',                  'Discussion',
 'Afin de poursuivre la défense de vos intérêts dans les meilleures conditions, je vous serais reconnaissant de bien vouloir me faire parvenir les documents suivants : [LISTE DOCUMENTS].'),
(11, 5, 'Honoraires et provision',               'Discussion',
 'Conformément à notre convention d''honoraires, je vous adresse en pièce jointe une note d''honoraires d''un montant de [MONTANT] euros TTC au titre de [DESCRIPTION DILIGENCES].'),

-- ─────────────────────────────────────────────────────────
-- CONCLUSIONS AFFAIRES (id_modele = 8)
-- ─────────────────────────────────────────────────────────
(8, 1,  'Présentation des parties',              'Introduction',
 'La société [NOM CLIENT], [FORME SOCIALE] au capital de [CAPITAL] euros, immatriculée au RCS de [VILLE] sous le n° [SIRET], a pour activité principale [ACTIVITÉ].'),
(8, 2,  'Relation commerciale',                  'Faits',
 'Les parties entretiennent une relation commerciale établie depuis [DATE DÉBUT] matérialisée par [NATURE CONTRATS] dont les conditions sont définies contractuellement.'),
(8, 3,  'Inexécution contractuelle',             'Discussion',
 'En l''espèce, la partie adverse a manqué à ses obligations contractuelles en [DESCRIPTION MANQUEMENT], ce qui a causé à notre cliente un préjudice certain et direct évalué à [MONTANT] euros.'),
(8, 4,  'Responsabilité délictuelle',            'Discussion',
 'À titre subsidiaire, les faits décrits constituent une faute au sens de l''article 1240 du Code civil, engageant la responsabilité délictuelle de la partie adverse à l''égard de notre cliente.'),
(8, 5,  'Demande en paiement',                   'Dispositif',
 'Condamner la partie adverse à payer à notre cliente la somme de [MONTANT] euros HT, soit [MONTANT TTC] euros TTC, au titre de [OBJET CRÉANCE], assortie des intérêts au taux légal à compter du [DATE].'),

-- ─────────────────────────────────────────────────────────
-- CONCLUSIONS HARCÈLEMENT (id_modele = 9)
-- ─────────────────────────────────────────────────────────
(9, 1,  'Définition légale harcèlement',         'Discussion',
 'En application de l''article L. 1152-1 du Code du travail, aucun salarié ne doit subir les agissements répétés de harcèlement moral qui ont pour objet ou pour effet une dégradation de ses conditions de travail susceptible de porter atteinte à ses droits et à sa dignité, d''altérer sa santé physique ou mentale ou de compromettre son avenir professionnel.'),
(9, 2,  'Matérialité des faits de harcèlement',  'Faits',
 'En l''espèce, notre client a subi de façon répétée les agissements suivants de la part de [AUTEUR HARCÈLEMENT] : [DESCRIPTION FAITS]. Ces agissements, pris dans leur ensemble, caractérisent indubitablement une situation de harcèlement moral.'),
(9, 3,  'Altération de la santé',                'Faits',
 'Ces agissements ont eu pour effet direct d''altérer gravement l''état de santé de notre client, comme en attestent les certificats médicaux et arrêts de travail versés aux débats (Pièces n° [NUMÉROS]).'),
(9, 4,  'Obligation de sécurité de l''employeur', 'Discussion',
 'L''employeur, tenu d''une obligation de sécurité résultat en matière de harcèlement moral, n''a pris aucune mesure pour faire cesser les agissements dénoncés, alors même qu''il en avait connaissance depuis le [DATE SIGNALEMENT].'),
(9, 5,  'Nullité du licenciement',               'Dispositif',
 'Prononcer la nullité du licenciement de notre client en ce qu''il est consécutif à une situation de harcèlement moral, et condamner en conséquence la société [NOM SOCIÉTÉ] à lui payer la somme de [MONTANT] euros à titre de dommages-intérêts.'),

-- ─────────────────────────────────────────────────────────
-- NOTE INTERNE ANALYSE (id_modele = 5)
-- ─────────────────────────────────────────────────────────
(5, 1,  'Objet de la note',                      'Introduction',
 'La présente note a pour objet d''analyser les arguments juridiques susceptibles d''être invoqués par notre client dans le cadre du litige l''opposant à [PARTIE ADVERSE], et d''évaluer les chances de succès d''une action en justice.'),
(5, 2,  'Analyse des risques',                   'Discussion',
 'Sur la base des éléments communiqués, le risque de condamnation est estimé à [FAIBLE/MODÉRÉ/ÉLEVÉ]. Les principales incertitudes portent sur [POINTS INCERTAINS].'),
(5, 3,  'Stratégie contentieuse recommandée',    'Discussion',
 'Au regard de ce qui précède, il est recommandé d''adopter la stratégie suivante : [DESCRIPTION STRATÉGIE]. Cette approche permettra de maximiser les chances de succès tout en limitant les coûts de procédure.'),
(5, 4,  'Évaluation du préjudice',               'Discussion',
 'Le préjudice de notre client peut être évalué comme suit : préjudice matériel [MONTANT] €, préjudice moral [MONTANT] €, soit un total de [TOTAL] €. Il convient toutefois de réserver les préjudices non encore chiffrables.'),
(5, 5,  'Prochaines diligences',                 'Discussion',
 'Les diligences à effectuer dans les prochaines semaines sont les suivantes :\n1. [DILIGENCE 1]\n2. [DILIGENCE 2]\n3. [DILIGENCE 3]\nUn point d''étape sera effectué le [DATE].'),

-- ─────────────────────────────────────────────────────────
-- NOTE INTERNE AUDIENCE (id_modele = 12)
-- ─────────────────────────────────────────────────────────
(12, 1, 'Compte rendu d''audience',              'Introduction',
 'La présente note a pour objet de rendre compte de l''audience qui s''est tenue le [DATE] devant [JURIDICTION] concernant le dossier [NOM DOSSIER].'),
(12, 2, 'Composition du tribunal',               'Faits',
 'L''audience s''est tenue devant [COMPOSITION JURIDICTION]. La partie adverse était représentée par Maître [ADVERSAIRE]. Le tribunal a fixé l''affaire au [PROCHAIN RENVOI] pour [OBJET RENVOI].'),
(12, 3, 'Arguments développés',                  'Discussion',
 'À l''audience, nous avons principalement développé les arguments suivants :\n– [ARGUMENT 1]\n– [ARGUMENT 2]\n– [ARGUMENT 3]\nLa partie adverse a quant à elle soutenu [POSITION ADVERSE].'),
(12, 4, 'Décision rendue',                       'Discussion',
 'Le tribunal a rendu sa décision en ces termes : [RÉSUMÉ DÉCISION]. Cette décision [EST/N''EST PAS] susceptible d''appel dans un délai de [DÉLAI] jours.'),
(12, 5, 'Suites à donner',                       'Discussion',
 'À la suite de cette audience, les diligences suivantes sont à effectuer :\n– Informer le client : [OUI/NON], délai : [DÉLAI]\n– Signifier la décision : avant le [DATE]\n– Envisager un recours : [MOTIFS SI OUI]');

COMMIT;
