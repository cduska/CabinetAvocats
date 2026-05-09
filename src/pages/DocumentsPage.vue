<script setup lang="ts">
import { ref, watch } from 'vue';
import DataTable from '../components/ui/DataTable.vue';
import { getDossiers } from '../services/api/dossiersApi';
import { getDocuments } from '../services/api/documentsApi';
import { useSession } from '../services/session';
import type { DocumentItem } from '../types/domain';

const { state: sessionState } = useSession();

const rows = ref<DocumentItem[]>([]);
const dataSource = ref('');

const columns = [
  { key: 'id', label: 'ID', sortable: true, align: 'center' as const },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'dossierReference', label: 'Dossier', sortable: true },
  { key: 'auteur', label: 'Auteur', sortable: true },
  { key: 'dateCreation', label: 'Date creation', sortable: true },
  { key: 'statut', label: 'Statut', sortable: true },
];

async function loadDocuments(): Promise<void> {
  try {
    await getDossiers();
    rows.value = await getDocuments();
    dataSource.value = 'PostgreSQL local';
  } catch {
    rows.value = [];
    dataSource.value = 'Erreur API';
  }
}

watch(
  () => [sessionState.agencyId, sessionState.metier, sessionState.userId],
  () => {
    loadDocuments().catch(() => undefined);
  },
  { immediate: true },
);
</script>

<template>
  <div class="documents-page" data-cy="documents-page">
    <div class="page-header">
      <h1>Documents</h1>
      <span v-if="dataSource" class="data-source-badge">{{ dataSource }}</span>
    </div>

    <DataTable
      :columns="columns"
      :rows="rows"
      row-key="id"
      empty-message="Aucun document trouve."
    />
  </div>
</template>
