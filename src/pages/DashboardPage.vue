<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import frLocale from '@fullcalendar/core/locales/fr';
import type { EventClickArg, CalendarOptions } from '@fullcalendar/core';
import MetricCard from '../components/ui/MetricCard.vue';
import { useAccessControl } from '../services/access';
import { useSession } from '../services/session';
import { getAudiences, getDashboardMetrics, getDocuments, getDossiers } from '../services/api';
import type { AudienceItem, DashboardMetric, Dossier, DocumentItem } from '../types/domain';

const dataSource = ref('');
const metrics = ref<DashboardMetric[]>([]);
const dossierRows = ref<Dossier[]>([]);
const documentRows = ref<DocumentItem[]>([]);
const audienceRows = ref<AudienceItem[]>([]);
const selectedCalendarStatuses = ref<string[]>([]);
const selectedCalendarContentieux = ref<string[]>([]);
const router = useRouter();
const { canPerformAction, canAccessRoute } = useAccessControl();
const { state: sessionState } = useSession();
const canCreateDossier = computed(() => canPerformAction('dashboard:create-dossier'));
const canExportActivity = computed(() => canPerformAction('dashboard:export-activity'));
const canOpenProcedureDetail = computed(() => canAccessRoute('procedure-detail'));

async function hydrateDashboard() {
  try {
    const [remoteMetrics, remoteDossiers, remoteDocuments, remoteAudiences] = await Promise.all([
      getDashboardMetrics(),
      getDossiers(),
      getDocuments(),
      getAudiences(),
    ]);
    metrics.value = remoteMetrics;
    dossierRows.value = remoteDossiers;
    documentRows.value = remoteDocuments;
    audienceRows.value = remoteAudiences;
    dataSource.value = 'PostgreSQL local';
  } catch (e) {
    metrics.value = [];
    dossierRows.value = [];
    documentRows.value = [];
    audienceRows.value = [];
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[Dashboard] Erreur hydrateDashboard:', msg, e);
    dataSource.value = `Erreur API: ${msg.slice(0, 120)}`;
  }
}

watch(
  () => [sessionState.agencyId, sessionState.metier, sessionState.userId],
  () => {
    void hydrateDashboard();
  },
  { immediate: true },
);

const upcomingDeadlines = computed(() =>
  [...dossierRows.value]
    .filter((item) => item.statut !== 'Cloture')
    .sort((a, b) => a.echeance.localeCompare(b.echeance))
    .slice(0, 5),
);

const pendingDocuments = computed(() =>
  documentRows.value.filter((item) => item.statut !== 'Archive').slice(0, 6),
);

function parseIsoDate(value: string): Date | null {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const [year, month, day] = normalized.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const calendarStatusOptions = computed(() => {
  return [...new Set(audienceRows.value.map((item) => item.procedureStatut || 'Non renseigne'))]
    .sort((left, right) => left.localeCompare(right, 'fr'));
});

const calendarContentieuxOptions = computed(() => {
  return [...new Set(audienceRows.value.map((item) => item.dossierType || 'Non renseigne'))]
    .sort((left, right) => left.localeCompare(right, 'fr'));
});

watch(calendarStatusOptions, (options) => {
  selectedCalendarStatuses.value = selectedCalendarStatuses.value.filter((status) => options.includes(status));
});

watch(calendarContentieuxOptions, (options) => {
  selectedCalendarContentieux.value = selectedCalendarContentieux.value.filter((contentieux) => options.includes(contentieux));
});

const hasActiveCalendarFilters = computed(() =>
  selectedCalendarStatuses.value.length > 0 || selectedCalendarContentieux.value.length > 0,
);

function clearCalendarFilters() {
  selectedCalendarStatuses.value = [];
  selectedCalendarContentieux.value = [];
}

const filteredCalendarEvents = computed(() => {
  return audienceRows.value
    .filter((event) => (
      selectedCalendarStatuses.value.length === 0
      || selectedCalendarStatuses.value.includes(event.procedureStatut || 'Non renseigne')
    ))
    .filter((event) => (
      selectedCalendarContentieux.value.length === 0
      || selectedCalendarContentieux.value.includes(event.dossierType || 'Non renseigne')
    ))
    .filter((event) => Boolean(parseIsoDate(event.dateAudience)))
    .sort((left, right) => left.dateAudience.localeCompare(right.dateAudience) || left.id - right.id);
});

function openProcedureDetailFromCalendar(event: AudienceItem) {
  if (!canOpenProcedureDetail.value) {
    return;
  }

  const procedureId = Number(event.procedureId);
  if (!Number.isFinite(procedureId)) {
    return;
  }

  router.push({ name: 'procedure-detail', params: { id: String(procedureId) } }).catch(() => undefined);
}

function openMetricResults(metric: DashboardMetric) {
  const metricCode = metric.code || '';

  switch (metricCode) {
    case 'active-dossiers':
      router.push({ name: 'dossiers', query: { preset: 'active' } }).catch(() => undefined);
      return;
    case 'delayed-procedures':
      router.push({ name: 'procedures', query: { preset: 'delayed' } }).catch(() => undefined);
      return;
    case 'upcoming-hearings':
      router.push({ name: 'audiences', query: { preset: 'upcoming7d' } }).catch(() => undefined);
      return;
    case 'pending-documents':
      router.push({ name: 'documents', query: { preset: 'pending-validation' } }).catch(() => undefined);
      return;
    default:
      break;
  }

  if (metric.label === 'Dossiers actifs') {
    router.push({ name: 'dossiers', query: { preset: 'active' } }).catch(() => undefined);
  } else if (metric.label === 'Procedures en retard' || metric.label === 'Procedures en cours') {
    router.push({ name: 'procedures', query: { preset: 'delayed' } }).catch(() => undefined);
  } else if (metric.label === 'Audiences sous 7 jours') {
    router.push({ name: 'audiences', query: { preset: 'upcoming7d' } }).catch(() => undefined);
  } else if (metric.label === 'Documents a valider') {
    router.push({ name: 'documents', query: { preset: 'pending-validation' } }).catch(() => undefined);
  }
}

function mapToFcEvent(item: AudienceItem) {
  return {
    id: String(item.id),
    title: `${item.dossierReference} — ${item.instanceType} (${item.procedureType})`,
    start: item.dateAudience,
    extendedProps: { audience: item },
  };
}

function handleEventClick(arg: EventClickArg) {
  const audience = arg.event.extendedProps['audience'] as AudienceItem;
  openProcedureDetailFromCalendar(audience);
}

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin],
  initialView: 'dayGridMonth',
  locale: frLocale,
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,listMonth',
  },
  buttonText: {
    today: "Aujourd'hui",
    month: 'Mois',
    week: 'Semaine',
    list: 'Liste',
  },
  events: filteredCalendarEvents.value.map(mapToFcEvent),
  eventClick: handleEventClick,
  height: 'auto',
  noEventsText: 'Aucune audience pour les filtres selectionnes',
}));
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
        value-clickable
        @value-click="openMetricResults(metric)"
      />
    </section>

    <section class="card calendar-card" data-cy="dashboard-calendar">
      <header class="card-header">
        <div>
          <h2>Calendrier des instances</h2>
          <p class="action-bar-caption">Filtres a gauche, cliquez sur une audience pour ouvrir la procedure associee.</p>
          <p v-if="!canOpenProcedureDetail" class="action-bar-caption">Le detail procedure n'est pas accessible avec ce profil.</p>
        </div>
      </header>

      <div class="calendar-layout">
        <aside class="calendar-sidebar">
          <section class="calendar-filter-block">
            <div class="calendar-filter-head">
              <p class="calendar-filter-title">Statut procedure</p>
              <button class="calendar-link-button" type="button" @click="selectedCalendarStatuses = []">Tout</button>
            </div>
            <label v-for="status in calendarStatusOptions" :key="status" class="calendar-checkbox-row">
              <input v-model="selectedCalendarStatuses" type="checkbox" :value="status" />
              <span>{{ status }}</span>
            </label>
            <p v-if="calendarStatusOptions.length === 0" class="action-bar-caption">Aucun statut disponible.</p>
          </section>

          <section class="calendar-filter-block">
            <div class="calendar-filter-head">
              <p class="calendar-filter-title">Type de contentieux</p>
              <button class="calendar-link-button" type="button" @click="selectedCalendarContentieux = []">Tout</button>
            </div>
            <label v-for="contentieux in calendarContentieuxOptions" :key="contentieux" class="calendar-checkbox-row">
              <input v-model="selectedCalendarContentieux" type="checkbox" :value="contentieux" />
              <span>{{ contentieux }}</span>
            </label>
            <p v-if="calendarContentieuxOptions.length === 0" class="action-bar-caption">Aucun type disponible.</p>
          </section>

          <button
            class="button button-secondary calendar-reset-filters"
            type="button"
            :disabled="!hasActiveCalendarFilters"
            @click="clearCalendarFilters"
          >
            Reinitialiser les filtres
          </button>
        </aside>

        <div class="calendar-main">
          <FullCalendar :options="calendarOptions" />
        </div>
      </div>
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
