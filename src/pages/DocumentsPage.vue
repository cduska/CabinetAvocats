<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import DataTable from '../components/ui/DataTable.vue';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import { useAccessControl } from '../services/access';
import { getStatusColorClass } from '../services/status';
import { createDocument as createDocumentApi, getDocuments, getDossiers, updateDocumentStatus } from '../services/api';
import { useSession } from '../services/session';
import type { DocumentItem, Dossier } from '../types/domain';

const route = useRoute();
const rows = ref<DocumentItem[]>([]);
const typeFilter = ref('all');
const statusFilter = ref('all');
const drawerOpen = ref(false);
const dataSource = ref('');
const isUpdatingStatus = ref(false);
const { canPerformAction } = useAccessControl();
const { state: sessionState } = useSession();
const canCreateDocument = computed(() => canPerformAction('documents:create'));

const workflowStatusOptions = [
  'brouillon',
  'initie',
  'cree',
  'en cours',
  'en relecture',
  'valide',
  'archive',
  'cloture',
];

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
const isPendingValidationPreset = computed(() => String(route.query.preset ?? '').toLowerCase() === 'pending-validation');

function formatDateAsIso(dateValue: Date): string {
  return dateValue.toISOString().slice(0, 10);
}

function isPendingValidationDocument(item: DocumentItem): boolean {
  const creationDate = item.dateCreation?.trim();
  if (!creationDate) {
    return true;
  }

  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - 30);

  return creationDate >= formatDateAsIso(threshold);
}

const filteredRows = computed(() =>
  {
    const filtered = rows.value.filter((item) => {
      const typeMatch = typeFilter.value === 'all' || item.type === typeFilter.value;
      const statusMatch = statusFilter.value === 'all' || item.statut === statusFilter.value;
      const pendingPresetMatch = !isPendingValidationPreset.value || isPendingValidationDocument(item);
      return typeMatch && statusMatch && pendingPresetMatch;
    });

    if (!isPendingValidationPreset.value) {
      return filtered;
    }

    return [...filtered].sort((left, right) => right.dateCreation.localeCompare(left.dateCreation));
  },
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

async function changeStatus(row: Record<string, unknown>, nextStatus: string): Promise<void> {
  const id = typeof row.id === 'number' ? row.id : Number(row.id);
  const currentStatus = typeof row.statut === 'string' ? row.statut : '';

  if (!Number.isFinite(id) || id <= 0 || !nextStatus || currentStatus === nextStatus) {
    return;
  }

  isUpdatingStatus.value = true;
  try {
    const updated = await updateDocumentStatus(id, { statut: nextStatus });
    rows.value = rows.value.map((item) => (item.id === id ? { ...item, statut: updated.statut } : item));
    dataSource.value = 'PostgreSQL local';
  } catch {
    dataSource.value = 'Erreur API';
    await loadDocumentsFromApi();
  } finally {
    isUpdatingStatus.value = false;
  }
}
</script>

<template>
  <section class="page-grid" data-cy="documents-page">
    <div class="action-bar card">
      <div>
        <p class="action-bar-title">Gestion documentaire</p>
        <p class="action-bar-caption">Source: {{ dataSource }}</p>
        <p v-if="isPendingValidationPreset" class="action-bar-caption">Vue pre-triee: documents sans date ou crees depuis 30 jours.</p>
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

      <template #cell-statut="{ value, row }">
        <div class="status-cell" @click.stop>
          <span :class="['status-pill', getStatusColorClass(value)]">{{ value }}</span>
          <select
            class="select status-select"
            :value="String(value ?? '')"
            :disabled="isUpdatingStatus"
            @change="changeStatus(row, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="status in workflowStatusOptions" :key="status" :value="status">{{ status }}</option>
          </select>
        </div>
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

<style scoped>
.status-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.status-select {
  min-width: 9.5rem;
  font-size: 0.76rem;
  padding: 0.12rem 0.3rem;
}
</style>
