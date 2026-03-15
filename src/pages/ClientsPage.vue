<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import DataTable from '../components/ui/DataTable.vue';
import { clients } from '../data/mockData';
import { createClient as createClientApi, getClients } from '../services/api';
import type { Client } from '../types/domain';

const columns = [
  { key: 'id', label: 'ID', sortable: true, align: 'center' as const },
  { key: 'nomComplet', label: 'Client', sortable: true },
  { key: 'agence', label: 'Agence', sortable: true },
  { key: 'responsable', label: 'Responsable', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'telephone', label: 'Telephone' },
];

const rows = ref<Client[]>([...clients]);
const agenceFilter = ref('all');
const drawerOpen = ref(false);
const dataSource = ref('Mock local');

const form = reactive({
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  agence: 'Paris',
  responsable: 'Claire Martin',
});

const agencies = computed(() => ['all', ...new Set(rows.value.map((item) => item.agence))]);

const filteredRows = computed(() => {
  const current = agenceFilter.value;
  const source = current === 'all' ? rows.value : rows.value.filter((item) => item.agence === current);

  return source.map((item) => ({
    ...item,
    nomComplet: `${item.prenom} ${item.nom}`,
  }));
});

async function loadClientsFromApi(): Promise<void> {
  try {
    const remoteRows = await getClients();
    if (remoteRows.length > 0) {
      rows.value = remoteRows;
    }
    dataSource.value = 'PostgreSQL local';
  } catch (error) {
    dataSource.value = 'Mock local';
  }
}

onMounted(() => {
  void loadClientsFromApi();
});

function resetForm(): void {
  form.nom = '';
  form.prenom = '';
  form.email = '';
  form.telephone = '';
  form.agence = 'Paris';
  form.responsable = 'Claire Martin';
}

function addClientLocally(): void {
  if (!form.nom || !form.prenom || !form.email) {
    return;
  }

  const nextId = rows.value.length > 0 ? Math.max(...rows.value.map((item) => item.id)) + 1 : 1;

  rows.value.unshift({
    id: nextId,
    nom: form.nom,
    prenom: form.prenom,
    email: form.email,
    telephone: form.telephone,
    agence: form.agence,
    responsable: form.responsable,
  });
}

async function addClient(): Promise<void> {
  if (!form.nom || !form.prenom || !form.email) {
    return;
  }

  try {
    const created = await createClientApi({
      nom: form.nom,
      prenom: form.prenom,
      email: form.email,
      telephone: form.telephone,
      agence: form.agence,
      responsable: form.responsable,
    });

    rows.value.unshift(created);
    dataSource.value = 'PostgreSQL local';
  } catch (error) {
    addClientLocally();
    dataSource.value = 'Mock local';
  }

  drawerOpen.value = false;
  resetForm();
}
</script>

<template>
  <section class="page-grid" data-cy="clients-page">
    <div class="action-bar card">
      <div>
        <p class="action-bar-title">Gestion des clients</p>
        <p class="action-bar-caption">Source: {{ dataSource }}</p>
      </div>
      <div class="action-bar-actions">
        <button class="button" type="button" data-cy="add-client" @click="drawerOpen = true">
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
          <input v-model="form.agence" class="input" />
        </label>
        <label>
          Responsable
          <input v-model="form.responsable" class="input" />
        </label>
      </form>

      <template #footer>
        <button class="button button-secondary" type="button" @click="drawerOpen = false">Annuler</button>
        <button class="button" type="button" @click="addClient">Enregistrer</button>
      </template>
    </DrawerPanel>
  </section>
</template>
