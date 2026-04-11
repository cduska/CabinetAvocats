<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import DataTable from '../components/ui/DataTable.vue';
import {
  getCollaborateurs,
  createCollaborateur,
  updateCollaborateur,
  deleteCollaborateur,
  getMetiers,
  createMetier,
  updateMetier,
  deleteMetier,
  getAgences,
} from '../services/api';
import type { Agence, Collaborateur, Metier } from '../types/domain';

// =========================================================
// Onglets
// =========================================================

type Tab = 'collaborateurs' | 'metiers';
const activeTab = ref<Tab>('collaborateurs');

// =========================================================
// Données de référence (pour les selects)
// =========================================================

const agences = ref<Agence[]>([]);
const metiers = ref<Metier[]>([]);

async function loadReferences(): Promise<void> {
  const [a, m] = await Promise.all([getAgences(), getMetiers()]);
  agences.value = a;
  metiers.value = m;
}

// =========================================================
// État partagé
// =========================================================

const loading = ref(false);
const errorMessage = ref('');
const drawerOpen = ref(false);
const editingId = ref<number | null>(null);
const confirmDeleteId = ref<number | null>(null);
const confirmDeleteLabel = ref('');
const deleteError = ref('');

// =========================================================
// Collaborateurs
// =========================================================

const collaborateurs = ref<Collaborateur[]>([]);

const formCollab = reactive({
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  agenceId: null as number | null,
  metierId: null as number | null,
  dateEntree: '',
  actif: true,
});

async function loadCollaborateurs(): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  try {
    collaborateurs.value = await getCollaborateurs();
  } catch {
    errorMessage.value = 'Erreur lors du chargement des collaborateurs.';
  } finally {
    loading.value = false;
  }
}

const columnsCollab = [
  { key: 'id', label: 'ID', sortable: true, align: 'center' as const },
  { key: 'nom', label: 'Nom', sortable: true },
  { key: 'prenom', label: 'Prénom', sortable: true },
  { key: 'metierLabel', label: 'Métier', sortable: true },
  { key: 'agenceNom', label: 'Agence', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'actif', label: 'Actif', align: 'center' as const },
  { key: 'actions', label: 'Actions', align: 'center' as const },
];

function openCreateCollab(): void {
  editingId.value = null;
  formCollab.nom = '';
  formCollab.prenom = '';
  formCollab.email = '';
  formCollab.telephone = '';
  formCollab.agenceId = null;
  formCollab.metierId = null;
  formCollab.dateEntree = '';
  formCollab.actif = true;
  errorMessage.value = '';
  drawerOpen.value = true;
}

function openEditCollab(row: Record<string, unknown>): void {
  editingId.value = Number(row.id);
  formCollab.nom = String(row.nom ?? '');
  formCollab.prenom = String(row.prenom ?? '');
  formCollab.email = String(row.email ?? '');
  formCollab.telephone = String(row.telephone ?? '');
  formCollab.agenceId = row.agenceId == null ? null : Number(row.agenceId);
  formCollab.metierId = row.metierId == null ? null : Number(row.metierId);
  formCollab.dateEntree = row.dateEntree ? String(row.dateEntree).slice(0, 10) : '';
  formCollab.actif = Boolean(row.actif);
  errorMessage.value = '';
  drawerOpen.value = true;
}

async function saveCollab(): Promise<void> {
  if (!formCollab.nom.trim()) {
    errorMessage.value = 'Le nom est requis.';
    return;
  }

  const payload = {
    nom: formCollab.nom.trim(),
    prenom: formCollab.prenom.trim() || undefined,
    email: formCollab.email.trim() || undefined,
    telephone: formCollab.telephone.trim() || undefined,
    agenceId: formCollab.agenceId,
    metierId: formCollab.metierId,
    dateEntree: formCollab.dateEntree || null,
    actif: formCollab.actif,
  };

  if (editingId.value === null) {
    const created = await createCollaborateur(payload);
    collaborateurs.value.push(created);
  } else {
    const updated = await updateCollaborateur(editingId.value, payload);
    const idx = collaborateurs.value.findIndex((c) => c.id === editingId.value);
    if (idx !== -1) collaborateurs.value[idx] = updated;
  }
}

// =========================================================
// Métiers
// =========================================================

const formMetier = reactive({ libelle: '' });

const columnsMetier = [
  { key: 'id', label: 'ID', sortable: true, align: 'center' as const },
  { key: 'libelle', label: 'Libellé', sortable: true },
  { key: 'actions', label: 'Actions', align: 'center' as const },
];

function openCreateMetier(): void {
  editingId.value = null;
  formMetier.libelle = '';
  errorMessage.value = '';
  drawerOpen.value = true;
}

function openEditMetier(row: Record<string, unknown>): void {
  editingId.value = Number(row.id);
  formMetier.libelle = String(row.libelle ?? '');
  errorMessage.value = '';
  drawerOpen.value = true;
}

async function saveMetier(): Promise<void> {
  if (!formMetier.libelle.trim()) {
    errorMessage.value = 'Le libellé est requis.';
    return;
  }

  if (editingId.value === null) {
    const created = await createMetier(formMetier.libelle.trim());
    metiers.value.push(created);
  } else {
    const updated = await updateMetier(editingId.value, formMetier.libelle.trim());
    const idx = metiers.value.findIndex((m) => m.id === editingId.value);
    if (idx !== -1) metiers.value[idx] = updated;
  }
}

// =========================================================
// Drawer générique
// =========================================================

const drawerTitle = computed(() => {
  const base = activeTab.value === 'collaborateurs' ? 'Collaborateur' : 'Métier';
  return editingId.value === null ? `Ajouter – ${base}` : `Modifier – ${base}`;
});

const drawerDescription = computed(() =>
  activeTab.value === 'collaborateurs'
    ? 'Renseignez les informations du collaborateur.'
    : 'Saisissez le libellé du métier.',
);

function openCreate(): void {
  if (activeTab.value === 'collaborateurs') openCreateCollab();
  else openCreateMetier();
}

function openEdit(row: Record<string, unknown>): void {
  if (activeTab.value === 'collaborateurs') openEditCollab(row);
  else openEditMetier(row);
}

function closeDrawer(): void {
  drawerOpen.value = false;
  errorMessage.value = '';
}

async function save(): Promise<void> {
  errorMessage.value = '';
  try {
    if (activeTab.value === 'collaborateurs') {
      await saveCollab();
    } else {
      await saveMetier();
    }
    if (!errorMessage.value) {
      closeDrawer();
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Une erreur est survenue.';
  }
}

// =========================================================
// Suppression
// =========================================================

function askDelete(row: Record<string, unknown>): void {
  confirmDeleteId.value = Number(row.id);
  const label =
    activeTab.value === 'collaborateurs'
      ? `${row.prenom ?? ''} ${row.nom ?? ''}`.trim()
      : String(row.libelle ?? `#${row.id}`);
  confirmDeleteLabel.value = label || `#${row.id}`;
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
    if (activeTab.value === 'collaborateurs') {
      await deleteCollaborateur(confirmDeleteId.value);
      collaborateurs.value = collaborateurs.value.filter((c) => c.id !== confirmDeleteId.value);
    } else {
      await deleteMetier(confirmDeleteId.value);
      metiers.value = metiers.value.filter((m) => m.id !== confirmDeleteId.value);
    }
    cancelDelete();
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Impossible de supprimer cet élément.';
  }
}

// =========================================================
// Initialisation
// =========================================================

onMounted(async () => {
  await Promise.all([loadReferences(), loadCollaborateurs()]);
});
</script>

<template>
  <section class="page-grid" data-cy="collaborateurs-page">
    <!-- Barre d'action -->
    <div class="action-bar card">
      <div>
        <p class="action-bar-title">Collaborateurs &amp; Métiers</p>
        <p class="action-bar-caption">Gestion des collaborateurs du cabinet et des métiers/rôles associés.</p>
      </div>
      <div class="action-bar-actions">
        <button class="button" type="button" data-cy="add-item" @click="openCreate">
          Ajouter
        </button>
      </div>
    </div>

    <!-- Onglets -->
    <div class="card">
      <div class="ref-tabs" role="tablist" aria-label="Sections collaborateurs">
        <button
          class="ref-tab"
          :class="{ 'ref-tab--active': activeTab === 'collaborateurs' }"
          role="tab"
          :aria-selected="activeTab === 'collaborateurs'"
          type="button"
          @click="activeTab = 'collaborateurs'"
        >
          Collaborateurs
        </button>
        <button
          class="ref-tab"
          :class="{ 'ref-tab--active': activeTab === 'metiers' }"
          role="tab"
          :aria-selected="activeTab === 'metiers'"
          type="button"
          @click="activeTab = 'metiers'"
        >
          Métiers
        </button>
      </div>
    </div>

    <!-- Chargement -->
    <div v-if="loading" class="card" style="padding: 2rem; text-align: center;">Chargement…</div>

    <!-- Tableau Collaborateurs -->
    <DataTable
      v-else-if="activeTab === 'collaborateurs'"
      :columns="columnsCollab"
      :rows="collaborateurs as unknown as Record<string, unknown>[]"
      :searchable-fields="['nom', 'prenom', 'email', 'metierLabel', 'agenceNom']"
      empty-message="Aucun collaborateur enregistré"
    >
      <template #cell-actif="{ row }">
        <span :class="row.actif ? 'badge badge-active' : 'badge badge-inactive'">
          {{ row.actif ? 'Oui' : 'Non' }}
        </span>
      </template>
      <template #cell-actions="{ row }">
        <div class="row-actions">
          <button
            class="button button-secondary button-sm"
            type="button"
            title="Modifier"
            @click.stop="openEdit(row)"
          >
            Modifier
          </button>
          <button
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

    <!-- Tableau Métiers -->
    <DataTable
      v-else
      :columns="columnsMetier"
      :rows="metiers as unknown as Record<string, unknown>[]"
      :searchable-fields="['libelle']"
      empty-message="Aucun métier enregistré"
    >
      <template #cell-actions="{ row }">
        <div class="row-actions">
          <button
            class="button button-secondary button-sm"
            type="button"
            title="Modifier"
            @click.stop="openEdit(row)"
          >
            Modifier
          </button>
          <button
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

    <!-- Drawer création / édition -->
    <DrawerPanel
      :open="drawerOpen"
      :title="drawerTitle"
      :description="drawerDescription"
      @close="closeDrawer"
    >
      <form class="form-grid" @submit.prevent="save">
        <!-- Formulaire Collaborateur -->
        <template v-if="activeTab === 'collaborateurs'">
          <div class="form-row">
            <label>
              Nom <span class="required">*</span>
              <input v-model="formCollab.nom" class="input" required autofocus />
            </label>
            <label>
              Prénom
              <input v-model="formCollab.prenom" class="input" />
            </label>
          </div>
          <label>
            Email
            <input v-model="formCollab.email" class="input" type="email" />
          </label>
          <label>
            Téléphone
            <input v-model="formCollab.telephone" class="input" />
          </label>
          <label>
            Métier
            <select v-model="formCollab.metierId" class="input">
              <option :value="null">— Aucun —</option>
              <option v-for="m in metiers" :key="m.id" :value="m.id">{{ m.libelle }}</option>
            </select>
          </label>
          <label>
            Agence
            <select v-model="formCollab.agenceId" class="input">
              <option :value="null">— Aucune —</option>
              <option v-for="a in agences" :key="a.id" :value="a.id">{{ a.nom }}</option>
            </select>
          </label>
          <label>
            Date d'entrée
            <input v-model="formCollab.dateEntree" class="input" type="date" />
          </label>
          <label class="label-inline">
            <input v-model="formCollab.actif" type="checkbox" class="checkbox" />
            Collaborateur actif
          </label>
        </template>

        <!-- Formulaire Métier -->
        <template v-else>
          <label>
            Libellé <span class="required">*</span>
            <input v-model="formMetier.libelle" class="input" required autofocus />
          </label>
        </template>

        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      </form>

      <template #footer>
        <button class="button button-secondary" type="button" @click="closeDrawer">Annuler</button>
        <button class="button" type="button" @click="save">
          {{ editingId !== null ? 'Enregistrer' : 'Créer' }}
        </button>
      </template>
    </DrawerPanel>

    <!-- Modal de confirmation de suppression -->
    <div v-if="confirmDeleteId !== null" class="confirm-overlay">
      <dialog class="confirm-dialog card" open aria-labelledby="confirm-title">
        <p id="confirm-title" class="confirm-title">Confirmer la suppression</p>
        <p class="confirm-body">
          Supprimer <strong>« {{ confirmDeleteLabel }} »</strong> ?
          Cette action est irréversible.
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
/* --- Onglets --- */
.ref-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
}

.ref-tab {
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 0.375rem;
  background: transparent;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.ref-tab:hover {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--color-text, #111827);
}

.ref-tab--active {
  background: var(--color-primary, #1d4ed8);
  color: #fff;
  border-color: var(--color-primary, #1d4ed8);
  font-weight: 600;
}

/* --- Formulaire en deux colonnes --- */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

/* --- Checkbox inline --- */
.label-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9375rem;
}

.checkbox {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
}

/* --- Badges actif / inactif --- */
.badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-active {
  background: #dcfce7;
  color: #15803d;
}

.badge-inactive {
  background: #fee2e2;
  color: #b91c1c;
}

/* --- Actions inline dans le tableau --- */
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

/* --- Erreur dans le formulaire --- */
.form-error {
  color: var(--color-danger, #dc2626);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.required {
  color: var(--color-danger, #dc2626);
}

/* --- Modal de confirmation --- */
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
