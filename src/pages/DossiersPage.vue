<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import DataTable from '../components/ui/DataTable.vue';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import { dossiers } from '../data/mockData';
import { createDossier as createDossierApi, getDossiers } from '../services/api';
import type { Dossier } from '../types/domain';

const rows = ref<Dossier[]>([...dossiers]);
const drawerOpen = ref(false);
const step = ref(1);
const statusFilter = ref('all');
const agencyFilter = ref('all');
const dataSource = ref('Mock local');

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
  client: '',
  type: 'Contentieux',
  statut: 'A valider',
  agence: 'Paris',
  ouverture: new Date().toISOString().slice(0, 10),
  echeance: '',
  montant: 0,
});

const agencies = computed(() => ['all', ...new Set(rows.value.map((item) => item.agence))]);
const statuses = computed(() => ['all', ...new Set(rows.value.map((item) => item.statut))]);

const filteredRows = computed(() =>
  rows.value.filter((item) => {
    const statusMatch = statusFilter.value === 'all' || item.statut === statusFilter.value;
    const agencyMatch = agencyFilter.value === 'all' || item.agence === agencyFilter.value;
    return statusMatch && agencyMatch;
  }),
);

const canContinueStepOne = computed(() => Boolean(form.reference && form.client && form.type));

async function loadDossiersFromApi(): Promise<void> {
  try {
    const remoteRows = await getDossiers();
    if (remoteRows.length > 0) {
      rows.value = remoteRows;
    }
    dataSource.value = 'PostgreSQL local';
  } catch {
    dataSource.value = 'Mock local';
  }
}

onMounted(() => {
  void loadDossiersFromApi();
});

function resetForm(): void {
  form.reference = '';
  form.client = '';
  form.type = 'Contentieux';
  form.statut = 'A valider';
  form.agence = 'Paris';
  form.ouverture = new Date().toISOString().slice(0, 10);
  form.echeance = '';
  form.montant = 0;
  step.value = 1;
}

function openDrawer(): void {
  resetForm();
  drawerOpen.value = true;
}

function closeDrawer(): void {
  drawerOpen.value = false;
  step.value = 1;
}

function nextStep(): void {
  if (step.value === 1 && canContinueStepOne.value) {
    step.value = 2;
  }
}

function previousStep(): void {
  step.value = 1;
}

function createDossierLocally(): void {
  if (!form.reference || !form.client || !form.echeance) {
    return;
  }

  const nextId = rows.value.length > 0 ? Math.max(...rows.value.map((item) => item.id)) + 1 : 1;

  rows.value.unshift({
    id: nextId,
    reference: form.reference,
    client: form.client,
    type: form.type,
    statut: form.statut,
    agence: form.agence,
    ouverture: form.ouverture,
    echeance: form.echeance,
    montant: form.montant,
  });
}

async function createDossier(): Promise<void> {
  if (!form.reference || !form.client || !form.echeance) {
    return;
  }

  try {
    const created = await createDossierApi({
      reference: form.reference,
      client: form.client,
      type: form.type,
      statut: form.statut,
      agence: form.agence,
      ouverture: form.ouverture,
      echeance: form.echeance,
      montant: form.montant,
    });

    rows.value.unshift(created);
    dataSource.value = 'PostgreSQL local';
  } catch {
    createDossierLocally();
    dataSource.value = 'Mock local';
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
      </div>
      <div class="action-bar-actions">
        <button class="button" type="button" data-cy="add-dossier" @click="openDrawer">
          Creer un dossier
        </button>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="filteredRows as Record<string, unknown>[]"
      :searchable-fields="['reference', 'client', 'type', 'statut', 'agence']"
      empty-message="Aucun dossier pour les filtres en cours."
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
            <input v-model="form.client" class="input" placeholder="Prenom Nom" required />
          </label>
          <label>
            Type de dossier
            <input v-model="form.type" class="input" />
          </label>
        </template>

        <template v-else>
          <label>
            Statut
            <input v-model="form.statut" class="input" />
          </label>
          <label>
            Agence
            <input v-model="form.agence" class="input" />
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
          :disabled="!canContinueStepOne"
          @click="nextStep"
        >
          Continuer
        </button>
        <template v-else>
          <button class="button button-secondary" type="button" @click="previousStep">Precedent</button>
          <button class="button" type="button" @click="createDossier">Creer</button>
        </template>
      </template>
    </DrawerPanel>
  </section>
</template>
