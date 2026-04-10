<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import DataTable from '../components/ui/DataTable.vue';
import { useAccessControl } from '../services/access';
import { createClient, updateClient, deleteClient, getAgences, getClients } from '../services/api';
import { useSession } from '../services/session';
import type { Client, Agence } from '../types/domain';

const columns = [
  { key: 'id', label: 'ID', sortable: true, align: 'center' as const },
  { key: 'nomComplet', label: 'Client', sortable: true },
  { key: 'agence', label: 'Agence', sortable: true },
  { key: 'responsable', label: 'Responsable', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'telephone', label: 'Telephone' },
  { key: 'actions', label: 'Actions', align: 'center' as const },
];

const rows = ref<Client[]>([]);
const agenceFilter = ref('all');
const drawerOpen = ref(false);
const editingId = ref<number | null>(null);
const dataSource = ref('');
const formError = ref('');
const confirmDeleteId = ref<number | null>(null);
const confirmDeleteLabel = ref('');
const deleteError = ref('');

const { canPerformAction } = useAccessControl();
const { state: sessionState } = useSession();

const canCreateClient = computed(() => canPerformAction('clients:create'));
const canEditClient = computed(() => canPerformAction('clients:edit'));
const canDeleteClient = computed(() => canPerformAction('clients:delete'));

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

const drawerTitle = computed(() => editingId.value === null ? 'Nouveau client' : 'Modifier le client');

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
  formError.value = '';
}

function openCreateDrawer(): void {
  if (!canCreateClient.value) return;
  editingId.value = null;
  resetForm();
  drawerOpen.value = true;
}

function openEditDrawer(row: Record<string, unknown>): void {
  if (!canEditClient.value) return;
  editingId.value = Number(row.id);
  form.nom = String(row.nom ?? '');
  form.prenom = String(row.prenom ?? '');
  form.email = String(row.email ?? '');
  form.telephone = String(row.telephone ?? '');
  const matchedAgence = agences.value.find((a) => a.nom === row.agence);
  form.agence = matchedAgence?.id ?? null;
  form.responsable = String(row.responsable ?? '');
  formError.value = '';
  drawerOpen.value = true;
}

async function saveClient(): Promise<void> {
  if (!form.nom || !form.prenom || !form.email) {
    formError.value = 'Nom, prÃ©nom et email sont obligatoires.';
    return;
  }

  formError.value = '';

  const payload = {
    nom: form.nom,
    prenom: form.prenom,
    email: form.email,
    telephone: form.telephone,
    agence: form.agence ? String(form.agence) : '',
    responsable: form.responsable,
  };

  try {
    if (editingId.value === null) {
      const created = await createClient(payload);
      rows.value.unshift(created);
    } else {
      const updated = await updateClient(editingId.value, payload);
      const idx = rows.value.findIndex((r) => r.id === editingId.value);
      if (idx !== -1) rows.value[idx] = updated;
    }

    drawerOpen.value = false;
    resetForm();
    dataSource.value = 'PostgreSQL local';
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Une erreur est survenue.';
    dataSource.value = 'Erreur API';
  }
}

function askDelete(row: Record<string, unknown>): void {
  confirmDeleteId.value = Number(row.id);
  confirmDeleteLabel.value = String(row.nomComplet ?? `#${row.id}`);
  deleteError.value = '';
}

function cancelDelete(): void {
  confirmDeleteId.value = null;
  confirmDeleteLabel.value = '';
  deleteError.value = '';
}

async function confirmDelete(): Promise<void> {
  if (confirmDeleteId.value === null) return;
  deleteError.value = '';

  try {
    await deleteClient(confirmDeleteId.value);
    rows.value = rows.value.filter((r) => r.id !== confirmDeleteId.value);
    cancelDelete();
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Impossible de supprimer ce client.';
  }
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
        <button class="button" type="button" :disabled="!canCreateClient" data-cy="add-client" @click="openCreateDrawer">
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

      <template #cell-actions="{ row }">
        <div class="row-actions">
          <button
            v-if="canEditClient"
            class="button button-secondary button-sm"
            type="button"
            title="Modifier"
            @click.stop="openEditDrawer(row)"
          >
            Modifier
          </button>
          <button
            v-if="canDeleteClient"
            class="button button-danger button-sm"
            type="button"
            title="Supprimer"
            @click.stop="askDelete(row)"
          >
            Supprimer
          </button>
        </div>
      </template>
    </DataTable>

    <DrawerPanel
      :open="drawerOpen"
      :title="drawerTitle"
      description="Renseignez les informations du client"
      @close="drawerOpen = false"
    >
      <form class="form-grid" @submit.prevent="saveClient">
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
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      </form>

      <template #footer>
        <button class="button button-secondary" type="button" @click="drawerOpen = false">Annuler</button>
        <button class="button" type="button" @click="saveClient">
          {{ editingId === null ? 'CrÃ©er' : 'Enregistrer' }}
        </button>
      </template>
    </DrawerPanel>

    <div v-if="confirmDeleteId !== null" class="confirm-overlay">
      <dialog class="confirm-dialog card" open aria-labelledby="confirm-client-title">
        <p id="confirm-client-title" class="confirm-title">Confirmer la suppression</p>
        <p class="confirm-body">
          Supprimer le client <strong>Â« {{ confirmDeleteLabel }} Â»</strong> ?
          Cette action est irrÃ©versible.
        </p>
        <p v-if="deleteError" class="form-error" role="alert">{{ deleteError }}</p>
        <div class="confirm-actions">
          <button class="button button-secondary" type="button" @click="cancelDelete">Annuler</button>
          <button class="button button-danger" type="button" @click="confirmDelete">Supprimer</button>
        </div>
      </dialog>
    </div>
  </section>
</template>

<style scoped>
.row-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.button-sm {
  padding: 0.25rem 0.625rem;
  font-size: 0.8125rem;
}

.button-danger {
  background: var(--color-danger, #dc2626);
  border-color: var(--color-danger, #dc2626);
  color: #fff;
}

.button-danger:hover {
  background: var(--color-danger-hover, #b91c1c);
  border-color: var(--color-danger-hover, #b91c1c);
}

.form-error {
  color: var(--color-danger, #dc2626);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-dialog {
  width: min(90vw, 28rem);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border: none;
  border-radius: 0.5rem;
}

.confirm-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
}

.confirm-body {
  margin: 0;
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.9375rem;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
