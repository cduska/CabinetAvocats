<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import MetricCard from '../components/ui/MetricCard.vue';
import { dashboardMetrics, documents, dossiers } from '../data/mockData';
import { useAccessControl } from '../services/access';
import {
  getDashboardMetrics,
  getDocuments,
  getDossiers,
} from '../services/api';

const dataSource = ref('Mock local');
const metrics = ref([...dashboardMetrics]);
const dossierRows = ref([...dossiers]);
const documentRows = ref([...documents]);
const { canPerformAction } = useAccessControl();
const canCreateDossier = computed(() => canPerformAction('dashboard:create-dossier'));
const canExportActivity = computed(() => canPerformAction('dashboard:export-activity'));

async function hydrateDashboard() {
  try {
    const [remoteMetrics, remoteDossiers, remoteDocuments] = await Promise.all([
      getDashboardMetrics(),
      getDossiers(),
      getDocuments(),
    ]);

    metrics.value = remoteMetrics.length > 0 ? remoteMetrics : metrics.value;
    dossierRows.value = remoteDossiers.length > 0 ? remoteDossiers : dossierRows.value;
    documentRows.value = remoteDocuments.length > 0 ? remoteDocuments : documentRows.value;
    dataSource.value = 'PostgreSQL local';
  } catch {
    dataSource.value = 'Mock local';
  }
}

onMounted(() => {
  void hydrateDashboard();
});

const upcomingDeadlines = computed(() =>
  [...dossierRows.value]
    .filter((item) => item.statut !== 'Cloture')
    .sort((a, b) => a.echeance.localeCompare(b.echeance))
    .slice(0, 5),
);

const pendingDocuments = computed(() =>
  documentRows.value.filter((item) => item.statut !== 'Archive').slice(0, 6),
);
</script>

<template>
  <section class="page-grid" data-cy="dashboard-page">
    <div class="action-bar card">
      <div>
        <p class="action-bar-title">Centre de pilotage</p>
        <p class="action-bar-caption">Source: {{ dataSource }}</p>
        <p v-if="!canCreateDossier || !canExportActivity" class="action-bar-caption">
          Certaines actions sont en lecture seule pour ce metier.
        </p>
      </div>
      <div class="action-bar-actions">
        <button class="button" type="button" :disabled="!canCreateDossier">Nouveau dossier</button>
        <button class="button button-secondary" type="button" :disabled="!canExportActivity">Exporter activite</button>
      </div>
    </div>

    <section class="metrics-grid">
      <MetricCard
        v-for="metric in metrics"
        :key="metric.label"
        :title="metric.label"
        :value="metric.value"
        :trend="metric.trend"
        :trend-up="metric.trendUp"
      />
    </section>

    <section class="dashboard-columns">
      <article class="card">
        <header class="card-header">
          <h2>Echeances proches</h2>
          <span class="badge">Priorite</span>
        </header>

        <ul class="list-rows">
          <li v-for="item in upcomingDeadlines" :key="item.id" class="list-row">
            <div>
              <p class="list-row-title">{{ item.reference }} - {{ item.client }}</p>
              <p class="list-row-subtitle">{{ item.type }} / {{ item.agence }}</p>
            </div>
            <strong>{{ item.echeance }}</strong>
          </li>
        </ul>
      </article>

      <article class="card">
        <header class="card-header">
          <h2>Documents en cours</h2>
          <span class="badge badge-neutral">Controle</span>
        </header>

        <ul class="list-rows">
          <li v-for="doc in pendingDocuments" :key="doc.id" class="list-row">
            <div>
              <p class="list-row-title">{{ doc.type }} / {{ doc.dossierReference }}</p>
              <p class="list-row-subtitle">Auteur: {{ doc.auteur }}</p>
            </div>
            <span :class="['status-pill', doc.statut === 'Valide' ? 'status-ok' : 'status-warn']">
              {{ doc.statut }}
            </span>
          </li>
        </ul>
      </article>
    </section>
  </section>
</template>
