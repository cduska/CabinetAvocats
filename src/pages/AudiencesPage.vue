<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DataTable from '../components/ui/DataTable.vue';
import { getAudiences } from '../services/api/audiencesApi';
import { useSession } from '../services/session';
import type { AudienceItem } from '../types/domain';

const route = useRoute();
const router = useRouter();
const { state: sessionState } = useSession();

const rows = ref<AudienceItem[]>([]);
const dataSource = ref('');

const isUpcomingPreset = computed(() => String(route.query.preset ?? '').toLowerCase() === 'upcoming7d');

const columns = [
  { key: 'id', label: 'ID', sortable: true, align: 'center' as const },
  { key: 'dateAudience', label: 'Date audience', sortable: true },
  { key: 'dossierReference', label: 'Dossier', sortable: true },
  { key: 'procedureType', label: 'Procedure', sortable: true },
  { key: 'instanceType', label: 'Instance', sortable: true },
  { key: 'commentaire', label: 'Commentaire', sortable: true },
  { key: 'procedureId', label: 'Action', sortable: false },
];

function parseIsoDate(dateValue: string): Date | null {
  const normalized = dateValue.trim();
  if (!normalized) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function isUpcomingInSevenDays(item: AudienceItem): boolean {
  const audienceDate = parseIsoDate(item.dateAudience);
  if (!audienceDate) {
    return false;
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return audienceDate >= start && audienceDate <= end;
}

const filteredRows = computed(() => {
  const baseRows = isUpcomingPreset.value ? rows.value.filter(isUpcomingInSevenDays) : rows.value;
  return [...baseRows].sort((left, right) => left.dateAudience.localeCompare(right.dateAudience));
});

async function loadAudiencesFromApi(): Promise<void> {
  try {
    const preset = isUpcomingPreset.value ? 'upcoming7d' : undefined;
    rows.value = await getAudiences(preset);
    dataSource.value = 'PostgreSQL local';
  } catch {
    rows.value = [];
    dataSource.value = 'Erreur API';
  }
}

watch(
  () => [sessionState.agencyId, sessionState.metier, sessionState.userId, route.query.preset],
  () => {
    loadAudiencesFromApi().catch(() => undefined);
  },
  { immediate: true },
);

function openProcedureDetail(row: AudienceItem | Record<string, unknown>): void {
  const rawProcedureId = row.procedureId;
  const procedureId = Number(rawProcedureId);

  if (!Number.isFinite(procedureId)) {
    return;
  }

  router.push({ name: 'procedure-detail', params: { id: String(procedureId) } }).catch(() => undefined);
}
</script>

<template>
  <section class="page-grid" data-cy="audiences-page">
    <div class="action-bar card">
      <div>
        <p class="action-bar-title">Suivi des audiences</p>
        <p class="action-bar-caption">Source: {{ dataSource }}</p>
        <p v-if="isUpcomingPreset" class="action-bar-caption">Vue pre-triee: audiences planifiees sur les 7 prochains jours.</p>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="filteredRows.map(row => ({ ...row }))"
      :searchable-fields="['dossierReference', 'procedureType', 'instanceType', 'commentaire', 'dateAudience']"
      empty-message="Aucune audience pour les filtres actifs."
      @row-click="(row: AudienceItem) => openProcedureDetail(row)"
    >
      <template #cell-commentaire="{ value }">
        {{ value || 'Sans commentaire' }}
      </template>

      <template #cell-procedureId="{ row }">
        <button
          class="button button-secondary"
          type="button"
          :disabled="!row.procedureId"
          @click.stop="openProcedureDetail(row)"
        >
          Voir procedure
        </button>
      </template>
    </DataTable>
  </section>
</template>
