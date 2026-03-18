<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import DataTable from '../components/ui/DataTable.vue';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import { useAccessControl } from '../services/access';
import { createDocument as createDocumentApi, getDocuments, getDossiers } from '../services/api';
import { useSession } from '../services/session';
import type { DocumentItem, Dossier } from '../types/domain';

const rows = ref<DocumentItem[]>([]);
const typeFilter = ref('all');
const statusFilter = ref('all');
const drawerOpen = ref(false);
const dataSource = ref('');
const { canPerformAction } = useAccessControl();
const { state: sessionState } = useSession();
const canCreateDocument = computed(() => canPerformAction('documents:create'));

const form = reactive({
  type: 'Note interne',
  dossierReference: null as number | null,
  auteur: '',
  statut: 'Brouillon',
});

const dossiers = ref<Dossier[]>([]);

const columns = [
  { key: 'id', label: 'ID', sortable: true, align: 'center' as const },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'dossierReference', label: 'Dossier', sortable: true },
  { key: 'auteur', label: 'Auteur', sortable: true },
  { key: 'dateCreation', label: 'Date creation', sortable: true },
  { key: 'statut', label: 'Statut', sortable: true },
];

const types = computed(() => ['all', ...new Set(rows.value.map((item) => item.type))]);
const statuses = computed(() => ['all', ...new Set(rows.value.map((item) => item.statut))]);

const filteredRows = computed(() =>
  rows.value.filter((item) => {
    const typeMatch = typeFilter.value === 'all' || item.type === typeFilter.value;
    const statusMatch = statusFilter.value === 'all' || item.statut === statusFilter.value;
    return typeMatch && statusMatch;
  }),
);

async function loadReferences() {
  dossiers.value = await getDossiers();
}

async function loadDocumentsFromApi(): Promise<void> {
  try {
    await loadReferences();
    const remoteRows = await getDocuments();
    rows.value = remoteRows;
    dataSource.value = 'PostgreSQL local';
  } catch {
    dataSource.value = 'Erreur API';
  }
}

watch(
  () => [sessionState.agencyId, sessionState.metier, sessionState.userId],
  () => {
    void loadDocumentsFromApi();
  },
  { immediate: true },
);

async function createDocument(): Promise<void> {
  if (!canCreateDocument.value) {
    return;
  }
  if (!form.type || !form.auteur) {
    return;
  }
  try {
    const created = await createDocumentApi({
      type: form.type,
      dossierReference: form.dossierReference ? String(form.dossierReference) : '',
      auteur: form.auteur,
      statut: form.statut,
    });
    rows.value.unshift(created);
    dataSource.value = 'PostgreSQL local';
  } catch {
    dataSource.value = 'Erreur API';
  }
  drawerOpen.value = false;
  form.type = 'Note interne';
  form.dossierReference = null;
  form.auteur = '';
  form.statut = 'Brouillon';
}

function openDrawer(): void {
  if (!canCreateDocument.value) {
    return;
  }

  drawerOpen.value = true;
}
</script>

<template>
  <section class="page-grid" data-cy="documents-page">
    <div class="action-bar card">
      <div>
        <p class="action-bar-title">Gestion documentaire</p>
        <p class="action-bar-caption">Source: {{ dataSource }}</p>
        <p v-if="!canCreateDocument" class="action-bar-caption">Mode lecture seule sur la creation de document.</p>
      </div>
      <div class="action-bar-actions">
        <button class="button" type="button" :disabled="!canCreateDocument" @click="openDrawer">Nouveau document</button>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="filteredRows.map(row => ({ ...row }))"
      :searchable-fields="['type', 'dossierReference', 'auteur', 'statut']"
      empty-message="Aucun document pour les filtres actifs."
    >
      <template #filters>
        <label>
          Type
          <select v-model="typeFilter" class="select" aria-label="Filtre type document">
            <option v-for="type in types" :key="type" :value="type">
              {{ type === 'all' ? 'Tous' : type }}
            </option>
          </select>
        </label>

        <label>
          Statut
          <select v-model="statusFilter" class="select" aria-label="Filtre statut document">
            <option v-for="status in statuses" :key="status" :value="status">
              {{ status === 'all' ? 'Tous' : status }}
            </option>
          </select>
        </label>
      </template>

      <template #cell-statut="{ value }">
        <span
          :class="[
            'status-pill',
            value === 'Valide' || value === 'Archive' ? 'status-ok' : value === 'A relire' ? 'status-alert' : 'status-warn',
          ]"
        >
          {{ value }}
        </span>
      </template>
    </DataTable>

    <DrawerPanel
      :open="drawerOpen"
      title="Nouveau document"
      description="Ajout rapide depuis la vue centrale"
      @close="drawerOpen = false"
    >
      <form class="form-grid" @submit.prevent="createDocument">
        <label>
          Type
          <input v-model="form.type" class="input" required />
        </label>
        <label>
          Dossier
          <select v-model="form.dossierReference" class="input">
            <option value="" disabled>Choisir un dossier</option>
            <option v-for="d in dossiers" :key="d.id" :value="d.id">{{ d.reference }}</option>
          </select>
        </label>
        <label>
          Auteur
          <input v-model="form.auteur" class="input" required />
        </label>
        <label>
          Statut
          <input v-model="form.statut" class="input" />
        </label>
      </form>

      <template #footer>
        <button class="button button-secondary" type="button" @click="drawerOpen = false">Annuler</button>
        <button class="button" type="button" :disabled="!canCreateDocument" @click="createDocument">Ajouter</button>
      </template>
    </DrawerPanel>
  </section>
</template>
