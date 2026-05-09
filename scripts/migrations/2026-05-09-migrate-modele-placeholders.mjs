/**
 * Migration : convertit les placeholders {{snake_case}} des modèles de document
 * vers le format [LIBELLÉ] unifié avec le système templateVars du frontend.
 *
 * Les clés auto-remplies depuis le dossier sont mappées aux mêmes noms que
 * templateVars dans DossierDetailPage.vue.
 */

import pg from 'pg';
import { getPgClientConfig } from '../../server/db-config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Table de correspondance complète
// Ordre important : les patterns combinés (prénom + nom) doivent passer AVANT
// les patterns individuels pour éviter les remplacements partiels.
// ─────────────────────────────────────────────────────────────────────────────
const REPLACEMENTS = [
  // == PATTERNS COMBINÉS (traités en premier) ==
  // Nom complet client (personne physique)
  ['{{demandeur_prenom}} {{demandeur_nom}}', '[NOM CLIENT]'],
  ['{{appelant_prenom}} {{appelant_nom}}',   '[NOM CLIENT]'],
  ['{{client_prenom}} {{client_nom}}',       '[NOM CLIENT]'],
  // Adversaire (personne physique)
  ['{{intime_prenom}} {{intime_nom}}',       '[ADVERSAIRE]'],
  ['{{destinataire_prenom}} {{destinataire_nom}}', '[DESTINATAIRE]'],

  // == AUTO-REMPLIS DEPUIS LE DOSSIER (templateVars) ==
  ['{{ville}}',              '[VILLE]'],
  ['{{date_redaction}}',     '[DATE]'],
  ['{{avocat_nom}}',         '[NOM AVOCAT]'],
  ['{{redacteur}}',          '[NOM AVOCAT]'],
  ['{{barreau}}',            '[VILLE]'],
  ['{{reference_dossier}}',  '[NOM DOSSIER]'],
  // Société cliente → NOM SOCIÉTÉ (auto-rempli = NOM CLIENT dans templateVars)
  ['{{client_raison_sociale}}',    '[NOM SOCIÉTÉ]'],
  ['{{demandeur_raison_sociale}}', '[NOM SOCIÉTÉ]'],

  // == INDIVIDUELS RESTANTS — client ==
  ['{{demandeur_prenom}}',   '[PRÉNOM CLIENT]'],
  ['{{demandeur_nom}}',      '[NOM CLIENT]'],
  ['{{appelant_prenom}}',    '[PRÉNOM CLIENT]'],
  ['{{appelant_nom}}',       '[NOM CLIENT]'],
  ['{{appelant_qualite}}',   '[QUALITÉ CLIENT]'],
  ['{{appelant_adresse}}',   '[ADRESSE CLIENT]'],
  ['{{client_prenom}}',      '[PRÉNOM CLIENT]'],
  ['{{client_nom}}',         '[NOM CLIENT]'],
  ['{{client_adresse}}',     '[ADRESSE CLIENT]'],
  ['{{demandeur_adresse}}',  '[ADRESSE CLIENT]'],

  // == ADVERSAIRE / INTIMÉ / DESTINATAIRE ==
  ['{{intime_prenom}}',              '[PRÉNOM ADVERSAIRE]'],
  ['{{intime_nom}}',                 '[NOM ADVERSAIRE]'],
  ['{{intime_raison_sociale}}',      '[RAISON SOCIALE ADVERSE]'],
  ['{{intime_adresse}}',             '[ADRESSE ADVERSE]'],
  ['{{defendeur_raison_sociale}}',   '[NOM SOCIÉTÉ ADVERSE]'],
  ['{{defendeur_adresse}}',          '[ADRESSE ADVERSE]'],
  ['{{destinataire_prenom}}',        '[PRÉNOM DESTINATAIRE]'],
  ['{{destinataire_nom}}',           '[NOM DESTINATAIRE]'],
  ['{{destinataire_raison_sociale}}','[RAISON SOCIALE DESTINATAIRE]'],
  ['{{destinataire_adresse}}',       '[ADRESSE DESTINATAIRE]'],

  // == JURIDICTION ==
  ['{{juridiction}}',              '[JURIDICTION]'],
  ['{{juridiction_premier_degre}}','[JURIDICTION 1ER DEGRÉ]'],
  ['{{ville_premier_degre}}',      '[VILLE 1ER DEGRÉ]'],
  ['{{section}}',                  '[SECTION]'],
  ['{{adresse_juridiction}}',      '[ADRESSE JURIDICTION]'],
  ['{{rg_premier_degre}}',         '[N° RG 1ER DEGRÉ]'],
  ['{{numero_tableau}}',           '[N° TABLEAU]'],

  // == DATES MANUELLES ==
  ['{{date_audience}}',         '[DATE AUDIENCE]'],
  ['{{heure_audience}}',        '[HEURE AUDIENCE]'],
  ['{{date_jugement}}',         '[DATE JUGEMENT]'],
  ['{{date_entree}}',           '[DATE EMBAUCHE]'],
  ['{{date_licenciement}}',     '[DATE LICENCIEMENT]'],
  ['{{date_fin_contrat}}',      '[DATE FIN CONTRAT]'],
  ['{{date_contrat}}',          '[DATE CONTRAT]'],
  ['{{date_manquement}}',       '[DATE MANQUEMENT]'],
  ['{{date_mise_en_demeure}}',  '[DATE MISE EN DEMEURE]'],
  ['{{mois_debut}}',            '[MOIS DÉBUT]'],
  ['{{mois_fin}}',              '[MOIS FIN]'],

  // == EMPLOI ==
  ['{{poste}}',               '[POSTE]'],
  ['{{motif_licenciement}}',  '[MOTIF LICENCIEMENT]'],
  ['{{motif_contestation}}',  '[MOTIF CONTESTATION]'],

  // == MONTANTS MANUELS ==
  ['{{montant_indemnite}}',    '[MONTANT INDEMNITÉ]'],
  ['{{montant_preavis}}',      '[MONTANT PRÉAVIS]'],
  ['{{montant_principal}}',    '[MONTANT RÉCLAMÉ]'],
  ['{{chiffrage_prejudice}}',  '[MONTANT RÉCLAMÉ]'],
  ['{{montant_article_700}}',  '[MONTANT ART. 700]'],
  ['{{montant_astreinte}}',    '[MONTANT ASTREINTE]'],

  // == CABINET ==
  ['{{cabinet_nom}}',        '[NOM CABINET]'],
  ['{{adresse_cabinet}}',    '[ADRESSE CABINET]'],
  ['{{telephone_cabinet}}',  '[TÉLÉPHONE CABINET]'],
  ['{{email_cabinet}}',      '[EMAIL CABINET]'],

  // == OBJETS / CONTENU LIBRE ==
  ['{{objet_bref}}',          '[OBJET]'],
  ['{{objet_note}}',          '[OBJET NOTE]'],
  ['{{objet_contrat}}',       '[OBJET CONTRAT]'],
  ['{{expose_manquement}}',   '[EXPOSÉ MANQUEMENTS]'],
  ['{{expose_faits}}',        '[EXPOSÉ FAITS]'],
  ['{{expose_moyens_appel}}', '[EXPOSÉ MOYENS APPEL]'],
  ['{{chef_demande_principal}}','[CHEF DEMANDE PRINCIPAL]'],
  ['{{nature_somme}}',        '[NATURE SOMME]'],
  ['{{injonction}}',          '[INJONCTION]'],
  ['{{mesure_demandee}}',     '[MESURE DEMANDÉE]'],
  ['{{delai}}',               '[DÉLAI]'],

  // == SOCIÉTÉ (données commerciales) ==
  ['{{demandeur_forme_juridique}}', '[FORME JURIDIQUE]'],
  ['{{capital}}',                   '[CAPITAL]'],
  ['{{ville_rcs}}',                 '[VILLE RCS]'],
  ['{{numero_rcs}}',                '[N° RCS]'],
  ['{{type_contrat}}',              '[TYPE CONTRAT]'],
  ['{{nature_manquement}}',         '[NATURE MANQUEMENT]'],

  // == NOTE INTERNE ==
  ['{{rappel_faits}}',       '[RAPPEL FAITS]'],
  ['{{question_1}}',         '[QUESTION 1]'],
  ['{{question_2}}',         '[QUESTION 2]'],
  ['{{analyse_juridique}}',  '[ANALYSE JURIDIQUE]'],
  ['{{risque_eleve}}',       '[RISQUE ÉLEVÉ]'],
  ['{{risque_modere}}',      '[RISQUE MODÉRÉ]'],
  ['{{risque_faible}}',      '[RISQUE FAIBLE]'],
  ['{{recommandations}}',    '[RECOMMANDATIONS]'],
  ['{{piece_1}}',            '[PIÈCE 1]'],
  ['{{piece_2}}',            '[PIÈCE 2]'],

  // == AUDIENCE ==
  ['{{resume_litige}}',  '[RÉSUMÉ LITIGE]'],
  ['{{argument_1}}',     '[ARGUMENT 1]'],
  ['{{argument_2}}',     '[ARGUMENT 2]'],
  ['{{argument_3}}',     '[ARGUMENT 3]'],
  ['{{contra_1}}',       '[CONTRA 1]'],
  ['{{contra_2}}',       '[CONTRA 2]'],
  ['{{demande_1}}',      '[DEMANDE 1]'],
  ['{{demande_2}}',      '[DEMANDE 2]'],

  // == COURRIER CLIENT ==
  ['{{diligence_1}}',            '[DILIGENCE 1]'],
  ['{{diligence_2}}',            '[DILIGENCE 2]'],
  ['{{diligence_3}}',            '[DILIGENCE 3]'],
  ['{{prochaines_etapes}}',      '[PROCHAINES ÉTAPES]'],
  ['{{provisions_versees}}',     '[PROVISIONS VERSÉES]'],
  ['{{diligences_a_facturer}}',  '[DILIGENCES À FACTURER]'],
];

// ─────────────────────────────────────────────────────────────────────────────
// Application
// ─────────────────────────────────────────────────────────────────────────────
function applyReplacements(jsonText) {
  let result = jsonText;
  for (const [from, to] of REPLACEMENTS) {
    result = result.split(from).join(to);
  }
  return result;
}

const client = new pg.Client(getPgClientConfig());
await client.connect();

try {
  const { rows } = await client.query(
    'SELECT id, nom_modele, contenu_json::text AS raw FROM modele_document WHERE contenu_json IS NOT NULL ORDER BY id',
  );

  let updated = 0;

  for (const row of rows) {
    if (!row.raw) continue;

    const converted = applyReplacements(row.raw);
    if (converted === row.raw) {
      console.log(`  [=] Modele ${row.id} ${row.nom_modele} — aucun placeholder {{}} trouvé, ignoré`);
      continue;
    }

    // Valider le JSON avant d'envoyer
    JSON.parse(converted);

    await client.query(
      'UPDATE modele_document SET contenu_json = $1::jsonb WHERE id = $2',
      [converted, row.id],
    );
    console.log(`  [✓] Modele ${row.id} ${row.nom_modele} — mis à jour`);
    updated++;
  }

  console.log(`\nTerminé : ${updated}/${rows.length} modèle(s) modifié(s).`);
} finally {
  await client.end();
}
