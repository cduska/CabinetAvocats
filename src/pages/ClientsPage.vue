<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import DataTable from '../components/ui/DataTable.vue';
import { useAccessControl } from '../services/access';
import { createClient, getAgences, getClients } from '../services/api';
import { useSession } from '../services/session';
import type { Client, Agence } from '../types/domain';

const columns = [
  { key: 'id', label: 'ID', sortable: true, align: 'center' as const },
  { key: 'nomComplet', label: 'Client', sortable: true },
  { key: 'agence', label: 'Agence', sortable: true },
  { key: 'responsable', label: 'Responsable', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'telephone', label: 'Telephone' },
];

const rows = ref<Client[]>([]);
const agenceFilter = ref('all');
const drawerOpen = ref(false);
const dataSource = ref('');
const { canPerformAction } = useAccessControl();
const { state: sessionState } = useSession();
const canCreateClient = computed(() => canPerformAction('clients:create'));

const form = reactive({
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  agence: null as number | null,
  responsable: 'Claire Martin',
});

const agences = ref<Agence[]>([]);

const agencies = computed(() => ['all', ...agences.value.map(a => a.id)]);

const filteredRows = computed(() => {
  const current = agenceFilter.value;
  const source = current === 'all' ? rows.value : rows.value.filter((item) => item.agence === current);

  return source.map((item) => ({
    ...item,
    nomComplet: `${item.prenom} ${item.nom}`,
  }));
});

async function loadReferences() {
  agences.value = await getAgences();
}

async function loadClientsFromApi(): Promise<void> {
  try {
    await loadReferences();
    const remoteRows = await getClients();
    rows.value = remoteRows;
    dataSource.value = 'PostgreSQL local';
  } catch {
    dataSource.value = 'Erreur API';
  }
}

watch(
  () => [sessionState.agencyId, sessionState.metier, sessionState.userId],
  () => {
    void loadClientsFromApi();
  },
  { immediate: true },
);

function resetForm(): void {
  form.nom = '';
  form.prenom = '';
  form.email = '';
  form.telephone = '';
  form.agence = null;
  form.responsable = 'Claire Martin';
}

async function addClient(): Promise<void> {
  if (!canCreateClient.value) {
    return;
  }

  if (!form.nom || !form.prenom || !form.email) {
    return;
  }

  try {
    const created = await createClient({
      nom: form.nom,
      prenom: form.prenom,
      email: form.email,
      telephone: form.telephone,
      agence: form.agence ? String(form.agence) : '',
      responsable: form.responsable,
    });

    rows.value.unshift(created);
    dataSource.value = 'PostgreSQL local';
  } catch {
    dataSource.value = 'Erreur API';
  }

  drawerOpen.value = false;
  resetForm();
}

function openDrawer(): void {
  if (!canCreateClient.value) {
    return;
  }

  drawerOpen.value = true;
}
</script>

<template>
  <section class="page-grid" data-cy="clients-page">
    <div class="action-bar card">
      <div>
        <p class="action-bar-title">Gestion des clients</p>
        <p class="action-bar-caption">Source: {{ dataSource }}</p>
        <p v-if="!canCreateClient" class="action-bar-caption">Mode lecture seule sur la creation de client.</p>
      </div>
      <div class="action-bar-actions">
        <button class="button" type="button" :disabled="!canCreateClient" data-cy="add-client" @click="openDrawer">
          Nouveau client
        </button>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="filteredRows as Record<string, unknown>[]"
      :searchable-fields="['nomComplet', 'email', 'telephone', 'agence', 'responsable']"
      empty-message="Aucun client ne correspond aux filtres."
    >
      <template #filters>
        <label>
          Agence
          <select v-model="agenceFilter" class="select" aria-label="Filtre agence">
            <option v-for="agence in agencies" :key="agence" :value="agence">
              {{ agence === 'all' ? 'Toutes' : agence }}
            </option>
          </select>
        </label>
      </template>
    </DataTable>

    <DrawerPanel
      :open="drawerOpen"
      title="Nouveau client"
      description="Creation rapide avec les champs essentiels"
      @close="drawerOpen = false"
    >
      <form class="form-grid" @submit.prevent="addClient">
        <label>
          Nom
          <input v-model="form.nom" class="input" required />
        </label>
        <label>
          Prenom
          <input v-model="form.prenom" class="input" required />
        </label>
        <label>
          Email
          <input v-model="form.email" class="input" type="email" required />
        </label>
        <label>
          Telephone
          <input v-model="form.telephone" class="input" />
        </label>
        <label>
          Agence
          <select v-model="form.agence" class="input" required>
            <option value="" disabled>Choisir une agence</option>
            <option v-for="a in agences" :key="a.id" :value="a.id">{{ a.nom }}</option>
          </select>
        </label>
        <label>
          Responsable
          <input v-model="form.responsable" class="input" />
        </label>
      </form>

      <template #footer>
        <button class="button button-secondary" type="button" @click="drawerOpen = false">Annuler</button>
        <button class="button" type="button" :disabled="!canCreateClient" @click="addClient">Enregistrer</button>
      </template>
    </DrawerPanel>
  </section>
</template>
