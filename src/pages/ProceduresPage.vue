<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DataTable from '../components/ui/DataTable.vue';
import { procedures } from '../data/mockData';
import { getProcedures } from '../services/api';
import type { ProcedureItem } from '../types/domain';

const rows = ref<ProcedureItem[]>([...procedures]);
const statusFilter = ref('all');
const dataSource = ref('Mock local');

const columns = [
  { key: 'id', label: 'ID', sortable: true, align: 'center' as const },
  { key: 'dossierReference', label: 'Dossier', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'juridiction', label: 'Juridiction', sortable: true },
  { key: 'debut', label: 'Debut', sortable: true },
  { key: 'statut', label: 'Statut', sortable: true },
];

const statuses = computed(() => ['all', ...new Set(rows.value.map((item) => item.statut))]);

const filteredRows = computed(() =>
  rows.value.filter((item) => statusFilter.value === 'all' || item.statut === statusFilter.value),
);

async function loadProceduresFromApi(): Promise<void> {
  try {
    const remoteRows = await getProcedures();
    if (remoteRows.length > 0) {
      rows.value = remoteRows;
    }
    dataSource.value = 'PostgreSQL local';
  } catch {
    dataSource.value = 'Mock local';
  }
}

onMounted(() => {
  void loadProceduresFromApi();
});
</script>

<template>
  <section class="page-grid" data-cy="procedures-page">
    <div class="action-bar card">
      <div>
        <p class="action-bar-title">Suivi des procedures</p>
        <p class="action-bar-caption">Source: {{ dataSource }}</p>
      </div>
      <div class="action-bar-actions">
        <button class="button button-secondary" type="button">Planifier audience</button>
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
