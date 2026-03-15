<template>
  <div>
    <h1>Gestion Cabinet d'Avocats</h1>
    <ul>
      <li v-for="table in tables" :key="table.name">
        <strong>{{ table.name }}</strong>
        <ul>
          <li v-for="col in table.columns" :key="col.name">
            {{ col.name }} ({{ col.type }}) <span v-if="col.constraints">- {{ col.constraints }}</span> <span v-if="col.description">: {{ col.description }}</span>
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

interface Column {
  name: string;
  type: string;
  constraints?: string;
  description?: string;
}

interface Table {
  name: string;
  columns: Column[];
}

export default defineComponent({
  name: 'SchemaOverview',
  data() {
    return {
      tables: [
        {
          name: 'agence',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'nom', type: 'VARCHAR(150)', constraints: 'NOT NULL', description: 'Nom de l’agence' },
            { name: 'adresse', type: 'VARCHAR(255)', description: 'Adresse' },
            { name: 'ville', type: 'VARCHAR(100)', description: 'Ville' },
            { name: 'code_postal', type: 'VARCHAR(20)', description: 'Code postal' },
          ],
        },
        {
          name: 'profil',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Profil applicatif' },
          ],
        },
        {
          name: 'collaborateur_profil',
          columns: [
            { name: 'id_collaborateur', type: 'INT', constraints: 'PK, FK', description: 'Collaborateur' },
            { name: 'id_profil', type: 'INT', constraints: 'PK, FK', description: 'Profil' },
          ],
        },
        {
          name: 'metier',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Métier' },
          ],
        },
        {
          name: 'collaborateur',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_agence', type: 'INT', constraints: 'FK', description: 'Agence' },
            { name: 'id_metier', type: 'INT', constraints: 'FK', description: 'Métier' },
            { name: 'nom', type: 'VARCHAR(100)', description: 'Nom' },
            { name: 'prenom', type: 'VARCHAR(100)', description: 'Prénom' },
            { name: 'email', type: 'VARCHAR(150)', description: 'Email' },
            { name: 'telephone', type: 'VARCHAR(50)', description: 'Téléphone' },
            { name: 'date_entree', type: 'DATE', description: 'Date d’entrée' },
            { name: 'actif', type: 'BOOLEAN', constraints: 'DEFAULT TRUE', description: 'Actif' },
          ],
        },
        {
          name: 'equipe',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'nom_equipe', type: 'VARCHAR(100)', description: 'Nom' },
            { name: 'description', type: 'TEXT', description: 'Description' },
          ],
        },
        {
          name: 'collaborateur_equipe',
          columns: [
            { name: 'id_collaborateur', type: 'INT', constraints: 'PK, FK', description: 'Collaborateur' },
            { name: 'id_equipe', type: 'INT', constraints: 'PK, FK', description: 'Équipe' },
          ],
        },
        {
          name: 'domaine_juridique',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'libelle', type: 'VARCHAR(150)', constraints: 'NOT NULL', description: 'Domaine' },
          ],
        },
        {
          name: 'sous_domaine',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_domaine', type: 'INT', constraints: 'FK', description: 'Domaine' },
            { name: 'libelle', type: 'VARCHAR(150)', constraints: 'NOT NULL', description: 'Sous‑domaine' },
          ],
        },
        {
          name: 'specialite',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_sous_domaine', type: 'INT', constraints: 'FK', description: 'Sous‑domaine' },
            { name: 'libelle', type: 'VARCHAR(150)', constraints: 'NOT NULL', description: 'Spécialité' },
          ],
        },
        {
          name: 'collaborateur_specialite',
          columns: [
            { name: 'id_collaborateur', type: 'INT', constraints: 'PK, FK', description: 'Collaborateur' },
            { name: 'id_specialite', type: 'INT', constraints: 'PK, FK', description: 'Spécialité' },
          ],
        },
        {
          name: 'client',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_agence', type: 'INT', constraints: 'FK', description: 'Agence' },
            { name: 'id_collaborateur_responsable', type: 'INT', constraints: 'FK', description: 'Référent' },
            { name: 'nom', type: 'VARCHAR(100)', description: 'Nom' },
            { name: 'prenom', type: 'VARCHAR(100)', description: 'Prénom' },
            { name: 'email', type: 'VARCHAR(150)', description: 'Email' },
            { name: 'telephone', type: 'VARCHAR(50)', description: 'Téléphone' },
          ],
        },
        {
          name: 'type_dossier',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Type' },
          ],
        },
        {
          name: 'statut_dossier',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Statut' },
          ],
        },
        {
          name: 'dossier',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_agence', type: 'INT', constraints: 'FK', description: 'Agence' },
            { name: 'id_client', type: 'INT', constraints: 'FK', description: 'Client' },
            { name: 'id_type_dossier', type: 'INT', constraints: 'FK', description: 'Type' },
            { name: 'id_statut_dossier', type: 'INT', constraints: 'FK', description: 'Statut' },
            { name: 'reference', type: 'VARCHAR(100)', description: 'Référence' },
            { name: 'date_ouverture', type: 'DATE', description: 'Ouverture' },
            { name: 'date_cloture', type: 'DATE', description: 'Clôture' },
          ],
        },
        {
          name: 'historique_dossier',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_dossier', type: 'INT', constraints: 'FK', description: 'Dossier' },
            { name: 'auteur', type: 'INT', constraints: 'FK', description: 'Collaborateur' },
            { name: 'date_modification', type: 'TIMESTAMP', description: 'Date' },
            { name: 'description', type: 'TEXT', description: 'Description' },
          ],
        },
        {
          name: 'facture',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_dossier', type: 'INT', constraints: 'FK', description: 'Dossier' },
            { name: 'montant', type: 'NUMERIC(10,2)', description: 'Montant' },
            { name: 'date_emission', type: 'DATE', description: 'Date' },
            { name: 'statut', type: 'VARCHAR(50)', description: 'Statut' },
          ],
        },
        {
          name: 'type_procedure',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Type' },
          ],
        },
        {
          name: 'statut_procedure',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Statut' },
          ],
        },
        {
          name: 'procedure',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_dossier', type: 'INT', constraints: 'FK', description: 'Dossier' },
            { name: 'id_type_procedure', type: 'INT', constraints: 'FK', description: 'Type' },
            { name: 'id_statut_procedure', type: 'INT', constraints: 'FK', description: 'Statut' },
            { name: 'date_debut', type: 'DATE', description: 'Début' },
            { name: 'date_fin', type: 'DATE', description: 'Fin' },
          ],
        },
        {
          name: 'historique_procedure',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_procedure', type: 'INT', constraints: 'FK', description: 'Procédure' },
            { name: 'auteur', type: 'INT', constraints: 'FK', description: 'Collaborateur' },
            { name: 'date_modification', type: 'TIMESTAMP', description: 'Date' },
            { name: 'description', type: 'TEXT', description: 'Description' },
          ],
        },
        {
          name: 'type_instance',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Type' },
          ],
        },
        {
          name: 'statut_instance',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Statut' },
          ],
        },
        {
          name: 'instance_juridique',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_procedure', type: 'INT', constraints: 'FK', description: 'Procédure' },
            { name: 'id_type_instance', type: 'INT', constraints: 'FK', description: 'Type' },
            { name: 'id_statut_instance', type: 'INT', constraints: 'FK', description: 'Statut' },
            { name: 'date_debut', type: 'DATE', description: 'Début' },
            { name: 'date_fin', type: 'DATE', description: 'Fin' },
          ],
        },
        {
          name: 'historique_instance',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_instance', type: 'INT', constraints: 'FK', description: 'Instance' },
            { name: 'auteur', type: 'INT', constraints: 'FK', description: 'Collaborateur' },
            { name: 'date_modification', type: 'TIMESTAMP', description: 'Date' },
            { name: 'description', type: 'TEXT', description: 'Description' },
          ],
        },
        {
          name: 'audience',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_instance', type: 'INT', constraints: 'FK', description: 'Instance' },
            { name: 'date_audience', type: 'DATE', description: 'Date' },
            { name: 'commentaire', type: 'TEXT', description: 'Commentaire' },
          ],
        },
        {
          name: 'type_document',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Type' },
          ],
        },
        {
          name: 'document',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_type_document', type: 'INT', constraints: 'FK', description: 'Type' },
            { name: 'id_dossier', type: 'INT', constraints: 'FK', description: 'Dossier' },
            { name: 'id_procedure', type: 'INT', constraints: 'FK', description: 'Procédure' },
            { name: 'id_instance', type: 'INT', constraints: 'FK', description: 'Instance' },
            { name: 'auteur', type: 'INT', constraints: 'FK', description: 'Collaborateur' },
            { name: 'chemin_fichier', type: 'TEXT', description: 'Chemin' },
            { name: 'date_creation', type: 'TIMESTAMP', description: 'Date' },
          ],
        },
        {
          name: 'modele_document',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_type_document', type: 'INT', constraints: 'FK', description: 'Type' },
            { name: 'nom_modele', type: 'VARCHAR(150)', description: 'Nom' },
            { name: 'description', type: 'TEXT', description: 'Description' },
            { name: 'contenu_json', type: 'JSONB', constraints: 'CHECK JSON', description: 'Contenu Editor.js / Tiptap' },
          ],
        },
        {
          name: 'modele_document_version',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_modele', type: 'INT', constraints: 'FK', description: 'Modèle' },
            { name: 'numero_version', type: 'INT', constraints: 'UNIQUE(id_modele, numero_version)', description: 'Version' },
            { name: 'contenu_json', type: 'JSONB', constraints: 'NOT NULL', description: 'Contenu' },
            { name: 'cree_le', type: 'TIMESTAMP', constraints: 'DEFAULT NOW()', description: 'Date' },
            { name: 'cree_par', type: 'INT', constraints: 'FK', description: 'Auteur' },
          ],
        },
        {
          name: 'modele_sous_domaine',
          columns: [
            { name: 'id_modele', type: 'INT', constraints: 'PK, FK', description: 'Modèle' },
            { name: 'id_sous_domaine', type: 'INT', constraints: 'PK, FK', description: 'Sous‑domaine' },
          ],
        },
        {
          name: 'paragraphe_predefini',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_modele', type: 'INT', constraints: 'FK', description: 'Modèle' },
            { name: 'ordre', type: 'INT', description: 'Ordre' },
            { name: 'contenu', type: 'TEXT', description: 'Contenu' },
          ],
        },
        {
          name: 'role_affectation',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'libelle', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Rôle' },
          ],
        },
        {
          name: 'affectation_dossier',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_collaborateur', type: 'INT', constraints: 'FK', description: 'Collaborateur' },
            { name: 'id_dossier', type: 'INT', constraints: 'FK', description: 'Dossier' },
            { name: 'id_role', type: 'INT', constraints: 'FK', description: 'Rôle' },
            { name: 'date_debut', type: 'DATE', description: 'Début' },
            { name: 'date_fin', type: 'DATE', description: 'Fin' },
          ],
        },
        {
          name: 'affectation_procedure',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_collaborateur', type: 'INT', constraints: 'FK', description: 'Collaborateur' },
            { name: 'id_procedure', type: 'INT', constraints: 'FK', description: 'Procédure' },
            { name: 'id_role', type: 'INT', constraints: 'FK', description: 'Rôle' },
            { name: 'date_debut', type: 'DATE', description: 'Début' },
            { name: 'date_fin', type: 'DATE', description: 'Fin' },
          ],
        },
        {
          name: 'dossier_lock',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_dossier', type: 'INT', constraints: 'FK', description: 'Dossier' },
            { name: 'id_collaborateur', type: 'INT', constraints: 'FK', description: 'Collaborateur' },
            { name: 'locked_at', type: 'TIMESTAMP', constraints: 'NOT NULL', description: 'Début verrou' },
            { name: 'expires_at', type: 'TIMESTAMP', constraints: 'NOT NULL', description: 'Expiration' },
          ],
        },
        {
          name: 'document_lock',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PK', description: 'Identifiant' },
            { name: 'id_document', type: 'INT', constraints: 'FK', description: 'Document' },
            { name: 'id_collaborateur', type: 'INT', constraints: 'FK', description: 'Collaborateur' },
            { name: 'locked_at', type: 'TIMESTAMP', constraints: 'NOT NULL', description: 'Début verrou' },
            { name: 'expires_at', type: 'TIMESTAMP', constraints: 'NOT NULL', description: 'Expiration' },
          ],
        },
      ] as Table[],
    };
  },
});
</script>

<style scoped>
h1 {
  margin-bottom: 1rem;
}
strong {
  color: #2c3e50;
}
ul {
  margin-bottom: 1rem;
}
</style>
