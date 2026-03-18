<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import DataTable from '../components/ui/DataTable.vue';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import { useAccessControl } from '../services/access';
import { createDossier as createDossierApi, getAgences, getClients, getDossiers, getStatutsDossier, getTypesDossier } from '../services/api';
import { useSession } from '../services/session';
import type { Dossier, Client, StatutDossier, TypeDossier, Agence } from '../types/domain';

const route = useRoute();
const rows = ref<Dossier[]>([]);
const drawerOpen = ref(false);
const step = ref(1);
const statusFilter = ref('all');
const agencyFilter = ref('all');
const dataSource = ref('');
const { canPerformAction } = useAccessControl();
const { state: sessionState } = useSession();
const canCreateDossier = computed(() => canPerformAction('dossiers:create'));

const columns = [
  { key: 'reference', label: 'Reference', sortable: true },
  { key: 'client', label: 'Client', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'statut', label: 'Statut', sortable: true },
  { key: 'agence', label: 'Agence', sortable: true },
  { key: 'echeance', label: 'Echeance', sortable: true },
  { key: 'montant', label: 'Montant HT', sortable: true, align: 'right' as const },
];

const form = reactive({
  reference: '',
  client: null as number | null,
  type: null as number | null,
  statut: null as number | null,
  agence: null as number | null,
  ouverture: new Date().toISOString().slice(0, 10),
  echeance: '',
  montant: 0,
});

const statuts = ref<StatutDossier[]>([]);
const types = ref<TypeDossier[]>([]);
const agences = ref<Agence[]>([]);
const clients = ref<Client[]>([]);

const agencies = computed(() => ['all', ...new Set(rows.value.map((item) => item.agence))]);
const statuses = computed(() => ['all', ...new Set(rows.value.map((item) => item.statut))]);

const isActivePreset = computed(() => String(route.query.preset ?? '').toLowerCase() === 'active');

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '');
}

const filteredRows = computed(() =>
  {
    const filtered = rows.value.filter((item) => {
      const statusMatch = statusFilter.value === 'all' || item.statut === statusFilter.value;
      const agencyMatch = agencyFilter.value === 'all' || item.agence === agencyFilter.value;
      const normalizedStatus = normalizeText(item.statut);
      const activePresetMatch = !isActivePreset.value || !['cloture', 'clos'].includes(normalizedStatus);
      return statusMatch && agencyMatch && activePresetMatch;
    });

    if (!isActivePreset.value) {
      return filtered;
    }

    return [...filtered].sort((left, right) => left.echeance.localeCompare(right.echeance));
  },
);

const canContinueStepOne = computed(() => Boolean(form.reference && form.client && form.type));


async function loadReferences() {
  [statuts.value, types.value, agences.value, clients.value] = await Promise.all([
    getStatutsDossier(),
    getTypesDossier(),
    getAgences(),
    getClients(),
  ]);
}

async function loadDossiersFromApi(): Promise<void> {
  try {
    await loadReferences();
    const remoteRows = await getDossiers();
    rows.value = remoteRows;
    dataSource.value = 'PostgreSQL local';
  } catch {
    rows.value = [];
    dataSource.value = 'Erreur API';
  }
}

watch(
  () => [sessionState.agencyId, sessionState.metier, sessionState.userId],
  () => {
    void loadDossiersFromApi();
  },
  { immediate: true },
);

function resetForm(): void {
  form.reference = '';
  form.client = null;
  form.type = null;
  form.statut = null;
  form.agence = null;
  form.ouverture = new Date().toISOString().slice(0, 10);
  form.echeance = '';
  form.montant = 0;
  step.value = 1;
}

function openDrawer(): void {
  if (!canCreateDossier.value) {
    return;
  }

  resetForm();
  drawerOpen.value = true;
}

function closeDrawer(): void {
  drawerOpen.value = false;
  step.value = 1;
}

function nextStep(): void {
  if (!canCreateDossier.value) {
    return;
  }

  if (step.value === 1 && canContinueStepOne.value) {
    step.value = 2;
  }
}

function previousStep(): void {
  step.value = 1;
}

async function createDossier(): Promise<void> {
  if (!canCreateDossier.value) {
    return;
  }

  if (!form.reference || !form.client || !form.echeance) {
    return;
  }

  try {
    const created = await createDossierApi({
      reference: form.reference,
      client: String(form.client),
      type: String(form.type),
      statut: String(form.statut),
      agence: String(form.agence),
      ouverture: form.ouverture,
      echeance: form.echeance,
      montant: form.montant,
    });

    rows.value.unshift(created);
    dataSource.value = 'PostgreSQL local';
  } catch {
    dataSource.value = 'Erreur API';
  }

  drawerOpen.value = false;
}
</script>

<template>
  <section class="page-grid" data-cy="dossiers-page">
    <div class="action-bar card">
      <div>
        <p class="action-bar-title">Gestion des dossiers</p>
        <p class="action-bar-caption">Source: {{ dataSource }}</p>
        <p v-if="isActivePreset" class="action-bar-caption">Vue pre-triee: dossiers actifs, classes par echeance.</p>
        <p v-if="!canCreateDossier" class="action-bar-caption">Mode lecture seule sur la creation de dossier.</p>
      </div>
      <div class="action-bar-actions">
        <button class="button" type="button" :disabled="!canCreateDossier" data-cy="add-dossier" @click="openDrawer">
          Creer un dossier
        </button>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="filteredRows.map(row => ({ ...row }))"
      :searchable-fields="['reference', 'client', 'type', 'statut', 'agence']"
      empty-message="Aucun dossier pour les filtres en cours."
      @row-click="(row: Dossier) => $router.push({ name: 'dossier-detail', params: { id: row.id } })"
    >
      <template #filters>
        <label>
          Statut
          <select v-model="statusFilter" class="select" aria-label="Filtre statut">
            <option v-for="status in statuses" :key="status" :value="status">
              {{ status === 'all' ? 'Tous' : status }}
            </option>
          </select>
        </label>

        <label>
          Agence
          <select v-model="agencyFilter" class="select" aria-label="Filtre agence">
            <option v-for="agency in agencies" :key="agency" :value="agency">
              {{ agency === 'all' ? 'Toutes' : agency }}
            </option>
          </select>
        </label>
      </template>

      <template #cell-statut="{ value }">
        <span
          :class="[
            'status-pill',
            value === 'Cloture' ? 'status-ok' : value === 'Urgent' ? 'status-alert' : 'status-warn',
          ]"
        >
          {{ value }}
        </span>
      </template>

      <template #cell-montant="{ value }">
        {{ Number(value).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) }}
      </template>
    </DataTable>

    <DrawerPanel
      :open="drawerOpen"
      title="Creation de dossier"
      description="Assistant en deux etapes pour limiter les erreurs de saisie"
      @close="closeDrawer"
    >
      <div class="stepper" aria-label="Progression du formulaire">
        <span :class="['step', step === 1 ? 'is-current' : 'is-done']">1. Contexte</span>
        <span :class="['step', step === 2 ? 'is-current' : '']">2. Pilotage</span>
      </div>

      <form class="form-grid" @submit.prevent="createDossier">
        <template v-if="step === 1">
          <label>
            Reference dossier
            <input v-model="form.reference" class="input" placeholder="DOS-2026-006" required />
          </label>
          <label>
            Client principal
            <select v-model="form.client" class="input" required>
              <option value="" disabled>Choisir un client</option>
              <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.nom }} {{ c.prenom }}</option>
            </select>
          </label>
          <label>
            Type de dossier
            <select v-model="form.type" class="input" required>
              <option value="" disabled>Choisir un type</option>
              <option v-for="t in types" :key="t.id" :value="t.id">{{ t.libelle }}</option>
            </select>
          </label>
        </template>

        <template v-else>
          <label>
            Statut
            <select v-model="form.statut" class="input" required>
              <option value="" disabled>Choisir un statut</option>
              <option v-for="s in statuts" :key="s.id" :value="s.id">{{ s.libelle }}</option>
            </select>
          </label>
          <label>
            Agence
            <select v-model="form.agence" class="input" required>
              <option value="" disabled>Choisir une agence</option>
              <option v-for="a in agences" :key="a.id" :value="a.id">{{ a.nom }}</option>
            </select>
          </label>
          <label>
            Date echeance
            <input v-model="form.echeance" class="input" type="date" required />
          </label>
          <label>
            Montant HT
            <input v-model.number="form.montant" class="input" type="number" min="0" step="100" />
          </label>
        </template>
      </form>

      <template #footer>
        <button class="button button-secondary" type="button" @click="closeDrawer">Annuler</button>
        <button
          v-if="step === 1"
          class="button"
          type="button"
          :disabled="!canContinueStepOne || !canCreateDossier"
          @click="nextStep"
        >
          Continuer
        </button>
        <template v-else>
          <button class="button button-secondary" type="button" @click="previousStep">Precedent</button>
          <button class="button" type="button" :disabled="!canCreateDossier" @click="createDossier">Creer</button>
        </template>
      </template>
    </DrawerPanel>
  </section>
</template>
