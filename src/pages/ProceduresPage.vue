<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import DataTable from '../components/ui/DataTable.vue';
import { useAccessControl } from '../services/access';
import { getDossiers, getProcedures } from '../services/api';
import { useSession } from '../services/session';
import type { ProcedureItem, Dossier } from '../types/domain';

const route = useRoute();
const rows = ref<ProcedureItem[]>([]);
const dossiers = ref<Dossier[]>([]);
const statusFilter = ref('all');
const dataSource = ref('');
const { canPerformAction } = useAccessControl();
const { state: sessionState } = useSession();
const canPlanProcedure = computed(() => canPerformAction('procedures:plan'));

const columns = [
  { key: 'id', label: 'ID', sortable: true, align: 'center' as const },
  { key: 'dossierReference', label: 'Dossier', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'juridiction', label: 'Juridiction', sortable: true },
  { key: 'debut', label: 'Debut', sortable: true },
  { key: 'statut', label: 'Statut', sortable: true },
];

const statuses = computed(() => ['all', ...new Set(rows.value.map((item) => item.statut))]);
const isDelayedPreset = computed(() => String(route.query.preset ?? '').toLowerCase() === 'delayed');

function isDelayedProcedure(item: ProcedureItem): boolean {
  const hasEndDate = Boolean(item.fin && item.fin.trim().length > 0);
  if (hasEndDate) {
    return false;
  }

  const startDateRaw = item.debut?.trim();
  if (!startDateRaw) {
    return false;
  }

  const startDate = new Date(`${startDateRaw}T00:00:00`);
  if (Number.isNaN(startDate.getTime())) {
    return false;
  }

  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - 14);

  return startDate < threshold;
}

const filteredRows = computed(() =>
  {
    const filtered = rows.value.filter((item) => {
      const statusMatch = statusFilter.value === 'all' || item.statut === statusFilter.value;
      const delayedPresetMatch = !isDelayedPreset.value || isDelayedProcedure(item);
      return statusMatch && delayedPresetMatch;
    });

    if (!isDelayedPreset.value) {
      return filtered;
    }

    return [...filtered].sort((left, right) => left.debut.localeCompare(right.debut));
  },
);

async function loadReferences() {
  dossiers.value = await getDossiers();
}

async function loadProceduresFromApi(): Promise<void> {
  try {
    await loadReferences();
    const remoteRows = await getProcedures();
    rows.value = remoteRows;
    dataSource.value = 'PostgreSQL local';
  } catch {
    dataSource.value = 'Erreur API';
  }
}

watch(
  () => [sessionState.agencyId, sessionState.metier, sessionState.userId],
  () => {
    void loadProceduresFromApi();
  },
  { immediate: true },
);
</script>

<template>
  <section class="page-grid" data-cy="procedures-page">
    <div class="action-bar card">
      <div>
        <p class="action-bar-title">Suivi des procedures</p>
        <p class="action-bar-caption">Source: {{ dataSource }}</p>
        <p v-if="isDelayedPreset" class="action-bar-caption">Vue pre-triee: procedures ouvertes depuis plus de 14 jours.</p>
        <p v-if="!canPlanProcedure" class="action-bar-caption">Mode lecture seule sur la planification.</p>
      </div>
      <div class="action-bar-actions">
        <button class="button button-secondary" type="button" :disabled="!canPlanProcedure">Planifier audience</button>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="filteredRows as Record<string, unknown>[]"
      :searchable-fields="['dossierReference', 'type', 'juridiction', 'statut']"
      empty-message="Aucune procedure enregistree."
    >
      <template #filters>
        <label>
          Statut
          <select v-model="statusFilter" class="select" aria-label="Filtre statut procedure">
            <option v-for="status in statuses" :key="status" :value="status">
              {{ status === 'all' ? 'Tous' : status }}
            </option>
          </select>
        </label>
      </template>

      <template #cell-statut="{ value }">
        <span :class="['status-pill', value === 'Terminee' ? 'status-ok' : 'status-warn']">{{ value }}</span>
      </template>
    </DataTable>
  </section>
</template>
