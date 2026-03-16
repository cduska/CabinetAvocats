<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import DataTable from '../components/ui/DataTable.vue';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import { documents } from '../data/mockData';
import { useAccessControl } from '../services/access';
import {
  createDocument as createDocumentApi,
  getDocuments,
} from '../services/api';
import type { DocumentItem } from '../types/domain';

const rows = ref<DocumentItem[]>([...documents]);
const typeFilter = ref('all');
const statusFilter = ref('all');
const drawerOpen = ref(false);
const dataSource = ref('Mock local');
const { canPerformAction } = useAccessControl();
const canCreateDocument = computed(() => canPerformAction('documents:create'));

const form = reactive({
  type: 'Note interne',
  dossierReference: '',
  auteur: '',
  statut: 'Brouillon',
});

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

async function loadDocumentsFromApi(): Promise<void> {
  try {
    const remoteRows = await getDocuments();
    if (remoteRows.length > 0) {
      rows.value = remoteRows;
    }
    dataSource.value = 'PostgreSQL local';
  } catch {
    dataSource.value = 'Mock local';
  }
}

onMounted(() => {
  void loadDocumentsFromApi();
});

function createDocumentLocally(): void {
  if (!form.type || !form.auteur) {
    return;
  }

  const nextId = rows.value.length > 0 ? Math.max(...rows.value.map((item) => item.id)) + 1 : 1;

  rows.value.unshift({
    id: nextId,
    type: form.type,
    dossierReference: form.dossierReference,
    auteur: form.auteur,
    dateCreation: new Date().toISOString().slice(0, 10),
    statut: form.statut,
  });
}

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
      dossierReference: form.dossierReference,
      auteur: form.auteur,
      statut: form.statut,
    });

    rows.value.unshift(created);
    dataSource.value = 'PostgreSQL local';
  } catch {
    createDocumentLocally();
    dataSource.value = 'Mock local';
  }

  drawerOpen.value = false;
  form.type = 'Note interne';
  form.dossierReference = '';
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
      :rows="filteredRows as Record<string, unknown>[]"
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
          Dossier reference
          <input v-model="form.dossierReference" class="input" placeholder="DOS-2026-001" />
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
