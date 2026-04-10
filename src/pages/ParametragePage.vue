<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import DataTable from '../components/ui/DataTable.vue';
import {
  createReferenceItem,
  updateReferenceItem,
  deleteReferenceItem,
  createAgence,
  updateAgence,
  deleteAgence,
  getStatutsDossier,
  getTypesDossier,
  getStatutsProcedure,
  getTypesProcedure,
  getStatutsInstance,
  getTypesInstance,
  getTypesDocument,
  getAgences,
} from '../services/api';
import { useSession } from '../services/session';
import type { Agence, RefItem } from '../types/domain';

// =========================================================
// Definition des sections
// =========================================================

interface Section {
  key: string;
  label: string;
  kind: 'libelle' | 'agence';
  table?: string;
}

const SECTIONS: Section[] = [
  { key: 'statut_dossier', label: 'Statuts de dossier', kind: 'libelle', table: 'statut_dossier' },
  { key: 'type_dossier', label: 'Types de dossier', kind: 'libelle', table: 'type_dossier' },
  { key: 'statut_procedure', label: 'Statuts de procédure', kind: 'libelle', table: 'statut_procedure' },
  { key: 'type_procedure', label: 'Types de procédure', kind: 'libelle', table: 'type_procedure' },
  { key: 'statut_instance', label: "Statuts d'instance", kind: 'libelle', table: 'statut_instance' },
  { key: 'type_instance', label: "Types d'instance", kind: 'libelle', table: 'type_instance' },
  { key: 'type_document', label: 'Types de document', kind: 'libelle', table: 'type_document' },
  { key: 'agence', label: 'Agences', kind: 'agence' },
];

async function loadSection(key: string): Promise<RefItem[] | Agence[]> {
  switch (key) {
    case 'statut_dossier': return getStatutsDossier();
    case 'type_dossier': return getTypesDossier();
    case 'statut_procedure': return getStatutsProcedure();
    case 'type_procedure': return getTypesProcedure();
    case 'statut_instance': return getStatutsInstance();
    case 'type_instance': return getTypesInstance();
    case 'type_document': return getTypesDocument();
    case 'agence': return getAgences();
    default: return [];
  }
}

// =========================================================
// State
// =========================================================

const { state: sessionState } = useSession();

const activeSection = ref<string>(SECTIONS[0].key);
const rows = ref<(RefItem | Agence)[]>([]);
const loading = ref(false);
const errorMessage = ref('');
const drawerOpen = ref(false);
const editingId = ref<number | null>(null);
const confirmDeleteId = ref<number | null>(null);
const confirmDeleteLabel = ref('');
const deleteError = ref('');

const formLibelle = reactive({ libelle: '' });
const formAgence = reactive({
  nom: '',
  adresse: '',
  ville: '',
  codePostal: '',
});

const currentSection = computed(() => SECTIONS.find((s) => s.key === activeSection.value)!);
const isAgenceSection = computed(() => currentSection.value.kind === 'agence');

const columnsLibelle = [
  { key: 'id', label: 'ID', sortable: true, align: 'center' as const },
  { key: 'libelle', label: 'Libellé', sortable: true },
  { key: 'actions', label: 'Actions', align: 'center' as const },
];

const columnsAgence = [
  { key: 'id', label: 'ID', sortable: true, align: 'center' as const },
  { key: 'nom', label: 'Nom', sortable: true },
  { key: 'ville', label: 'Ville', sortable: true },
  { key: 'adresse', label: 'Adresse', sortable: true },
  { key: 'codePostal', label: 'Code postal' },
  { key: 'actions', label: 'Actions', align: 'center' as const },
];

const activeColumns = computed(() => isAgenceSection.value ? columnsAgence : columnsLibelle);

const drawerTitle = computed(() => {
  const label = currentSection.value.label;
  return editingId.value === null ? `Ajouter – ${label}` : `Modifier – ${label}`;
});

// =========================================================
// Chargement des données
// =========================================================

async function loadRows(): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  try {
    rows.value = await loadSection(activeSection.value);
  } catch {
    errorMessage.value = 'Erreur lors du chargement des données.';
  } finally {
    loading.value = false;
  }
}

watch(
  [activeSection, () => sessionState.agencyId],
  () => { void loadRows(); },
  { immediate: true },
);

// =========================================================
// Drawer : ouverture / fermeture
// =========================================================

function openCreate(): void {
  editingId.value = null;
  formLibelle.libelle = '';
  formAgence.nom = '';
  formAgence.adresse = '';
  formAgence.ville = '';
  formAgence.codePostal = '';
  errorMessage.value = '';
  drawerOpen.value = true;
}

function openEdit(row: Record<string, unknown>): void {
  editingId.value = Number(row.id);
  if (isAgenceSection.value) {
    formAgence.nom = String(row.nom ?? '');
    formAgence.adresse = String(row.adresse ?? '');
    formAgence.ville = String(row.ville ?? '');
    formAgence.codePostal = String(row.codePostal ?? '');
  } else {
    formLibelle.libelle = String(row.libelle ?? '');
  }
  errorMessage.value = '';
  drawerOpen.value = true;
}

function closeDrawer(): void {
  drawerOpen.value = false;
  errorMessage.value = '';
}

// =========================================================
// Sauvegarde
// =========================================================

async function saveAgence(): Promise<void> {
  if (!formAgence.nom.trim()) {
    errorMessage.value = 'Le nom est requis.';
    return;
  }
  const payload = {
    nom: formAgence.nom.trim(),
    adresse: formAgence.adresse.trim() || undefined,
    ville: formAgence.ville.trim() || undefined,
    codePostal: formAgence.codePostal.trim() || undefined,
  };

  if (editingId.value === null) {
    const created = await createAgence(payload);
    rows.value.push(created);
  } else {
    const updated = await updateAgence(editingId.value, payload);
    const idx = rows.value.findIndex((r) => r.id === editingId.value);
    if (idx !== -1) rows.value[idx] = updated;
  }
}

async function saveLibelle(): Promise<void> {
  if (!formLibelle.libelle.trim()) {
    errorMessage.value = 'Le libellé est requis.';
    return;
  }
  const table = currentSection.value.table!;

  if (editingId.value === null) {
    const created = await createReferenceItem(table, formLibelle.libelle.trim());
    rows.value.push(created);
  } else {
    const updated = await updateReferenceItem(table, editingId.value, formLibelle.libelle.trim());
    const idx = rows.value.findIndex((r) => r.id === editingId.value);
    if (idx !== -1) rows.value[idx] = updated;
  }
}

async function save(): Promise<void> {
  errorMessage.value = '';
  try {
    if (isAgenceSection.value) {
      await saveAgence();
    } else {
      await saveLibelle();
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
  confirmDeleteLabel.value = String(row.libelle ?? row.nom ?? `#${row.id}`);
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
    if (isAgenceSection.value) {
      await deleteAgence(confirmDeleteId.value);
    } else {
      await deleteReferenceItem(currentSection.value.table!, confirmDeleteId.value);
    }

    rows.value = rows.value.filter((r) => r.id !== confirmDeleteId.value);
    cancelDelete();
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Impossible de supprimer cet élément.';
  }
}
</script>

<template>
  <section class="page-grid" data-cy="parametrage-page">
    <!-- Barre d'action -->
    <div class="action-bar card">
      <div>
        <p class="action-bar-title">Paramétrage – référentiels</p>
        <p class="action-bar-caption">Gestion des listes de valeurs utilisées dans l'application.</p>
      </div>
      <div class="action-bar-actions">
        <button class="button" type="button" data-cy="add-ref-item" @click="openCreate">
          Ajouter
        </button>
      </div>
    </div>

    <!-- Onglets -->
    <div class="card">
      <div class="ref-tabs" role="tablist" aria-label="Sections de paramétrage">
        <button
          v-for="section in SECTIONS"
          :key="section.key"
          class="ref-tab"
          :class="{ 'ref-tab--active': activeSection === section.key }"
          role="tab"
          :aria-selected="activeSection === section.key"
          type="button"
          @click="activeSection = section.key"
        >
          {{ section.label }}
        </button>
      </div>
    </div>

    <!-- Tableau -->
    <div v-if="loading" class="card" style="padding: 2rem; text-align: center;">Chargement…</div>

    <DataTable
      v-else
      :columns="activeColumns"
      :rows="rows as Record<string, unknown>[]"
      :searchable-fields="isAgenceSection ? ['nom', 'ville', 'adresse'] : ['libelle']"
      :empty-message="`Aucun élément dans « ${currentSection.label} »`"
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
      :description="isAgenceSection ? 'Renseignez les informations de l\'agence.' : 'Saisissez le libellé.'"
      @close="closeDrawer"
    >
      <form class="form-grid" @submit.prevent="save">
        <!-- Libellé simple -->
        <template v-if="!isAgenceSection">
          <label>
            Libellé
            <input v-model="formLibelle.libelle" class="input" required autofocus />
          </label>
        </template>

        <!-- Agence -->
        <template v-else>
          <label>
            Nom <span class="required">*</span>
            <input v-model="formAgence.nom" class="input" required autofocus />
          </label>
          <label>
            Adresse
            <input v-model="formAgence.adresse" class="input" />
          </label>
          <label>
            Ville
            <input v-model="formAgence.ville" class="input" />
          </label>
          <label>
            Code postal
            <input v-model="formAgence.codePostal" class="input" />
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
