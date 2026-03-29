<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import MetricCard from '../components/ui/MetricCard.vue';
import { useAccessControl } from '../services/access';
import { useSession } from '../services/session';
import { getAudiences, getDashboardMetrics, getDocuments, getDossiers } from '../services/api';
import type { AudienceItem, DashboardMetric, Dossier, DocumentItem } from '../types/domain';

interface CalendarCell {
  key: string;
  isoDate: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  events: AudienceItem[];
}

type CalendarViewMode = 'week' | 'month';

const dataSource = ref('');
const metrics = ref<DashboardMetric[]>([]);
const dossierRows = ref<Dossier[]>([]);
const documentRows = ref<DocumentItem[]>([]);
const audienceRows = ref<AudienceItem[]>([]);
const calendarViewMode = ref<CalendarViewMode>('month');
const calendarFocusDate = ref(new Date());
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

const calendarWeekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function startOfWeek(date: Date): Date {
  const normalized = startOfDay(date);
  const weekOffset = (normalized.getDay() + 6) % 7;
  normalized.setDate(normalized.getDate() - weekOffset);
  return normalized;
}

function toIsoDate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

const todayIsoDate = toIsoDate(new Date());

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

const calendarEventsByDate = computed(() => {
  const groups = new Map<string, AudienceItem[]>();

  for (const event of filteredCalendarEvents.value) {
    const dateKey = event.dateAudience.trim();
    if (!dateKey) {
      continue;
    }

    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(event);
      continue;
    }

    groups.set(dateKey, [event]);
  }

  return groups;
});

const calendarPeriodLabel = computed(() => {
  if (calendarViewMode.value === 'week') {
    const weekStart = startOfWeek(calendarFocusDate.value);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    return `Semaine du ${dateFormatter.format(weekStart)} au ${dateFormatter.format(weekEnd)}`;
  }

  const monthDate = new Date(calendarFocusDate.value.getFullYear(), calendarFocusDate.value.getMonth(), 1);
  const raw = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(monthDate);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
});

function buildCalendarCell(date: Date, inCurrentMonth: boolean): CalendarCell {
  const isoDate = toIsoDate(date);

  return {
    key: `${isoDate}-${inCurrentMonth ? 'current' : 'adjacent'}`,
    isoDate,
    dayNumber: date.getDate(),
    inCurrentMonth,
    isToday: isoDate === todayIsoDate,
    events: calendarEventsByDate.value.get(isoDate) ?? [],
  };
}

const calendarCells = computed(() => {
  if (calendarViewMode.value === 'week') {
    const weekCells: CalendarCell[] = [];
    const weekStart = startOfWeek(calendarFocusDate.value);

    for (let index = 0; index < 7; index += 1) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      weekCells.push(buildCalendarCell(date, date.getMonth() === calendarFocusDate.value.getMonth()));
    }

    return weekCells;
  }

  const cells: CalendarCell[] = [];
  const monthStart = new Date(calendarFocusDate.value.getFullYear(), calendarFocusDate.value.getMonth(), 1);
  const monthEnd = new Date(calendarFocusDate.value.getFullYear(), calendarFocusDate.value.getMonth() + 1, 0);
  const leadingDays = (monthStart.getDay() + 6) % 7;

  for (let index = leadingDays; index > 0; index -= 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 - index);
    cells.push(buildCalendarCell(date, false));
  }

  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    cells.push(buildCalendarCell(date, true));
  }

  while (cells.length % 7 !== 0) {
    const dayOffset = cells.length - (leadingDays + monthEnd.getDate()) + 1;
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, dayOffset);
    cells.push(buildCalendarCell(date, false));
  }

  return cells;
});

function setCalendarViewMode(mode: CalendarViewMode) {
  calendarViewMode.value = mode;
}

function previousCalendarPeriod() {
  if (calendarViewMode.value === 'week') {
    const previousWeek = startOfDay(calendarFocusDate.value);
    previousWeek.setDate(previousWeek.getDate() - 7);
    calendarFocusDate.value = previousWeek;
    return;
  }

  calendarFocusDate.value = new Date(
    calendarFocusDate.value.getFullYear(),
    calendarFocusDate.value.getMonth() - 1,
    1,
  );
}

function nextCalendarPeriod() {
  if (calendarViewMode.value === 'week') {
    const nextWeek = startOfDay(calendarFocusDate.value);
    nextWeek.setDate(nextWeek.getDate() + 7);
    calendarFocusDate.value = nextWeek;
    return;
  }

  calendarFocusDate.value = new Date(
    calendarFocusDate.value.getFullYear(),
    calendarFocusDate.value.getMonth() + 1,
    1,
  );
}

function resetCalendarPeriod() {
  calendarFocusDate.value = startOfDay(new Date());
}

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

function openDayPrimaryProcedure(cell: CalendarCell) {
  const primaryEvent = cell.events[0];
  if (!primaryEvent) {
    return;
  }

  openProcedureDetailFromCalendar(primaryEvent);
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
      <header class="card-header calendar-header">
        <div>
          <h2>Calendrier des instances</h2>
          <p class="action-bar-caption">Filtres a gauche en multi-selection, puis clic sur une date pour ouvrir la procedure associee.</p>
          <p v-if="!canOpenProcedureDetail" class="action-bar-caption">Le detail procedure n'est pas accessible avec ce profil.</p>
        </div>

        <div class="calendar-controls">
          <div class="calendar-zoom-toggle">
            <button
              class="button button-secondary"
              :class="{ 'is-active': calendarViewMode === 'week' }"
              type="button"
              @click="setCalendarViewMode('week')"
            >
              Semaine
            </button>
            <button
              class="button button-secondary"
              :class="{ 'is-active': calendarViewMode === 'month' }"
              type="button"
              @click="setCalendarViewMode('month')"
            >
              Mois
            </button>
          </div>
          <button class="button button-secondary" type="button" @click="previousCalendarPeriod">
            {{ calendarViewMode === 'week' ? 'Semaine precedente' : 'Mois precedent' }}
          </button>
          <strong class="calendar-month-label">{{ calendarPeriodLabel }}</strong>
          <button class="button button-secondary" type="button" @click="nextCalendarPeriod">
            {{ calendarViewMode === 'week' ? 'Semaine suivante' : 'Mois suivant' }}
          </button>
          <button class="button" type="button" @click="resetCalendarPeriod">Aujourd'hui</button>
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
          <p v-if="filteredCalendarEvents.length === 0" class="action-bar-caption">Aucune date d'instance pour les filtres selectionnes.</p>

          <div class="calendar-weekdays" aria-hidden="true">
            <span v-for="weekday in calendarWeekdays" :key="weekday">{{ weekday }}</span>
          </div>

          <div :class="['calendar-grid', calendarViewMode === 'week' ? 'is-week-view' : 'is-month-view']">
            <article
              v-for="cell in calendarCells"
              :key="cell.key"
              :class="[
                'calendar-cell',
                cell.inCurrentMonth ? 'is-current-month' : 'is-other-month',
                cell.isToday ? 'is-today' : '',
                cell.events.length > 0 ? 'has-events' : '',
              ]"
            >
              <button
                class="calendar-day-trigger"
                type="button"
                :disabled="cell.events.length === 0 || !canOpenProcedureDetail"
                @click="openDayPrimaryProcedure(cell)"
              >
                <span class="calendar-day-number">{{ cell.dayNumber }}</span>
                <span v-if="cell.events.length > 0" class="calendar-event-count">{{ cell.events.length }}</span>
              </button>

              <ul v-if="cell.events.length > 0" class="calendar-event-list">
                <li v-for="event in cell.events.slice(0, 2)" :key="event.id">
                  <button
                    class="calendar-event-item"
                    type="button"
                    :disabled="!canOpenProcedureDetail"
                    @click="openProcedureDetailFromCalendar(event)"
                  >
                    <span class="calendar-event-dot" aria-hidden="true" />
                    <span class="calendar-event-label">
                      {{ event.dossierReference }} / {{ event.procedureType }} / {{ event.instanceType }}
                    </span>
                  </button>
                </li>
              </ul>

              <p v-if="cell.events.length > 2" class="calendar-more">+{{ cell.events.length - 2 }} autres</p>
            </article>
          </div>
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
