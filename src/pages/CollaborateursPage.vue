<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import DataTable from '../components/ui/DataTable.vue';
import {
  getCollaborateurs,
  createCollaborateur,
  updateCollaborateur,
  deleteCollaborateur,
  getMetiers,
  getAgences,
  getRoleAffectations,
  getAffectations,
  addAffectationDossier,
  removeAffectationDossier,
  addAffectationProcedure,
  removeAffectationProcedure,
  getDossiers,
  getProcedures,
} from '../services/api';
import type {
  Agence,
  AffectationDossier,
  AffectationProcedure,
  Collaborateur,
  Dossier,
  Metier,
  ProcedureItem,
  RoleAffectation,
} from '../types/domain';

// =========================================================
// Données de référence (pour les selects)
// =========================================================

const agences = ref<Agence[]>([]);
const metiers = ref<Metier[]>([]);
const roles = ref<RoleAffectation[]>([]);
const dossiers = ref<Dossier[]>([]);
const procedures = ref<ProcedureItem[]>([]);

// =========================================================
// État principal
// =========================================================

const loading = ref(false);
const errorMessage = ref('');
const collaborateurs = ref<Collaborateur[]>([]);

const columnsCollab = [
  { key: 'nom', label: 'Nom', sortable: true },
  { key: 'prenom', label: 'Prénom', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'telephone', label: 'Téléphone' },
  { key: 'metierLabel', label: 'Métier', sortable: true },
  { key: 'agenceNom', label: 'Agence', sortable: true },
  { key: 'dateEntree', label: 'Entrée', sortable: true },
  { key: 'actif', label: 'Actif', align: 'center' as const },
  { key: 'actions', label: 'Actions', align: 'center' as const },
];

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

// =========================================================
// Drawer CRUD collaborateur
// =========================================================

const drawerOpen = ref(false);
const editingId = ref<number | null>(null);
const drawerError = ref('');

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

function openCreate(): void {
  editingId.value = null;
  formCollab.nom = '';
  formCollab.prenom = '';
  formCollab.email = '';
  formCollab.telephone = '';
  formCollab.agenceId = null;
  formCollab.metierId = null;
  formCollab.dateEntree = '';
  formCollab.actif = true;
  drawerError.value = '';
  drawerOpen.value = true;
}

function openEdit(row: Record<string, unknown>): void {
  editingId.value = Number(row.id);
  formCollab.nom = String(row.nom ?? '');
  formCollab.prenom = String(row.prenom ?? '');
  formCollab.email = String(row.email ?? '');
  formCollab.telephone = String(row.telephone ?? '');
  formCollab.agenceId = row.agenceId == null ? null : Number(row.agenceId);
  formCollab.metierId = row.metierId == null ? null : Number(row.metierId);
  formCollab.dateEntree = row.dateEntree ? String(row.dateEntree).slice(0, 10) : '';
  formCollab.actif = Boolean(row.actif);
  drawerError.value = '';
  drawerOpen.value = true;
}

async function saveCollab(): Promise<void> {
  drawerError.value = '';
  if (!formCollab.nom.trim()) {
    drawerError.value = 'Le nom est requis.';
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

  try {
    if (editingId.value === null) {
      const created = await createCollaborateur(payload);
      collaborateurs.value.push(created);
    } else {
      const updated = await updateCollaborateur(editingId.value, payload);
      const idx = collaborateurs.value.findIndex((c) => c.id === editingId.value);
      if (idx !== -1) collaborateurs.value[idx] = updated;
    }
    drawerOpen.value = false;
  } catch (err) {
    drawerError.value = err instanceof Error ? err.message : 'Une erreur est survenue.';
  }
}

// =========================================================
// Modal de confirmation de suppression
// =========================================================

const confirmDeleteId = ref<number | null>(null);
const confirmDeleteLabel = ref('');
const deleteError = ref('');

function askDelete(row: Record<string, unknown>): void {
  confirmDeleteId.value = Number(row.id);
  confirmDeleteLabel.value = `${row.prenom ?? ''} ${row.nom ?? ''}`.trim() || `#${row.id}`;
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
    await deleteCollaborateur(confirmDeleteId.value);
    collaborateurs.value = collaborateurs.value.filter((c) => c.id !== confirmDeleteId.value);
    cancelDelete();
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Impossible de supprimer ce collaborateur.';
  }
}

// =========================================================
// Modal affectations
// =========================================================

type AffectTab = 'dossiers' | 'procedures';
const affectModalOpen = ref(false);
const selectedCollab = ref<Collaborateur | null>(null);
const affectTab = ref<AffectTab>('dossiers');
const affectLoading = ref(false);
const affectError = ref('');

const affectDossiers = ref<AffectationDossier[]>([]);
const affectProcedures = ref<AffectationProcedure[]>([]);

// Sous-formulaire d'ajout
const showAddForm = ref(false);
const addError = ref('');
const addFormDossier = reactive({
  dossierId: null as number | null,
  roleId: null as number | null,
  dateDebut: '',
  dateFin: '',
});
const addFormProcedure = reactive({
  procedureId: null as number | null,
  roleId: null as number | null,
  dateDebut: '',
  dateFin: '',
});

async function openAffectations(row: Record<string, unknown>): Promise<void> {
  selectedCollab.value = collaborateurs.value.find((c) => c.id === Number(row.id)) ?? null;
  if (!selectedCollab.value) return;

  affectTab.value = 'dossiers';
  affectDossiers.value = [];
  affectProcedures.value = [];
  affectError.value = '';
  showAddForm.value = false;
  affectModalOpen.value = true;
  affectLoading.value = true;

  try {
    const data = await getAffectations(selectedCollab.value.id);
    affectDossiers.value = data.dossiers;
    affectProcedures.value = data.procedures;
  } catch {
    affectError.value = 'Erreur lors du chargement des affectations.';
  } finally {
    affectLoading.value = false;
  }
}

function closeAffectModal(): void {
  affectModalOpen.value = false;
  selectedCollab.value = null;
  showAddForm.value = false;
  addError.value = '';
}

function openAddForm(): void {
  addError.value = '';
  if (affectTab.value === 'dossiers') {
    addFormDossier.dossierId = null;
    addFormDossier.roleId = null;
    addFormDossier.dateDebut = '';
    addFormDossier.dateFin = '';
  } else {
    addFormProcedure.procedureId = null;
    addFormProcedure.roleId = null;
    addFormProcedure.dateDebut = '';
    addFormProcedure.dateFin = '';
  }
  showAddForm.value = true;
}

async function submitAddAffect(): Promise<void> {
  if (!selectedCollab.value) return;
  addError.value = '';

  try {
    if (affectTab.value === 'dossiers') {
      if (!addFormDossier.dossierId) {
        addError.value = 'Veuillez sélectionner un dossier.';
        return;
      }
      const created = await addAffectationDossier(selectedCollab.value.id, {
        dossierId: addFormDossier.dossierId,
        roleId: addFormDossier.roleId,
        dateDebut: addFormDossier.dateDebut || null,
        dateFin: addFormDossier.dateFin || null,
      });
      affectDossiers.value.unshift(created);
    } else {
      if (!addFormProcedure.procedureId) {
        addError.value = 'Veuillez sélectionner une procédure.';
        return;
      }
      const created = await addAffectationProcedure(selectedCollab.value.id, {
        procedureId: addFormProcedure.procedureId,
        roleId: addFormProcedure.roleId,
        dateDebut: addFormProcedure.dateDebut || null,
        dateFin: addFormProcedure.dateFin || null,
      });
      affectProcedures.value.unshift(created);
    }
    showAddForm.value = false;
  } catch (err) {
    addError.value = err instanceof Error ? err.message : "Erreur lors de l'ajout.";
  }
}

async function removeAffectDossier(id: number): Promise<void> {
  try {
    await removeAffectationDossier(id);
    affectDossiers.value = affectDossiers.value.filter((a) => a.id !== id);
  } catch (err) {
    affectError.value = err instanceof Error ? err.message : 'Erreur lors de la suppression.';
  }
}

async function removeAffectProcedure(id: number): Promise<void> {
  try {
    await removeAffectationProcedure(id);
    affectProcedures.value = affectProcedures.value.filter((a) => a.id !== id);
  } catch (err) {
    affectError.value = err instanceof Error ? err.message : 'Erreur lors de la suppression.';
  }
}

// =========================================================
// Initialisation
// =========================================================

onMounted(async () => {
  await Promise.all([
    loadCollaborateurs(),
    getAgences().then((r) => (agences.value = r)),
    getMetiers().then((r) => (metiers.value = r)),
    getRoleAffectations().then((r) => (roles.value = r)).catch(() => {}),
    getDossiers().then((r) => (dossiers.value = r)).catch(() => {}),
    getProcedures().then((r) => (procedures.value = r)).catch(() => {}),
  ]);
});
</script>

<template>
  <section class="page-grid" data-cy="collaborateurs-page">
    <!-- En-tête + bouton Ajouter -->
    <div class="action-bar card">
      <div>
        <p class="action-bar-title">Collaborateurs</p>
        <p class="action-bar-caption">Gérez les collaborateurs du cabinet, leurs informations et leurs affectations.</p>
      </div>
      <div class="action-bar-actions">
        <button class="button" type="button" data-cy="add-collab" @click="openCreate">
          Ajouter un collaborateur
        </button>
      </div>
    </div>

    <p v-if="errorMessage" class="form-error card" style="padding: 1rem;" role="alert">{{ errorMessage }}</p>
    <div v-if="loading" class="card" style="padding: 2rem; text-align: center;">Chargement…</div>

    <!-- Tableau collaborateurs -->
    <DataTable
      v-else
      :columns="columnsCollab"
      :rows="collaborateurs as unknown as Record<string, unknown>[]"
      :searchable-fields="['nom', 'prenom', 'email', 'metierLabel', 'agenceNom']"
      empty-message="Aucun collaborateur enregistré"
      @row-click="openAffectations"
    >
      <template #cell-actif="{ row }">
        <span :class="row.actif ? 'badge badge-active' : 'badge badge-inactive'">
          {{ row.actif ? 'Oui' : 'Non' }}
        </span>
      </template>
      <template #cell-dateEntree="{ row }">
        {{ row.dateEntree ? String(row.dateEntree).slice(0, 10) : '—' }}
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

    <!-- ================================================
         Drawer CRUD collaborateur
    ================================================ -->
    <DrawerPanel
      :open="drawerOpen"
      :title="editingId === null ? 'Ajouter un collaborateur' : 'Modifier le collaborateur'"
      description="Renseignez les informations du collaborateur."
      @close="drawerOpen = false"
    >
      <form class="form-grid" @submit.prevent="saveCollab">
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
        <p v-if="drawerError" class="form-error" role="alert">{{ drawerError }}</p>
      </form>
      <template #footer>
        <button class="button button-secondary" type="button" @click="drawerOpen = false">Annuler</button>
        <button class="button" type="button" @click="saveCollab">
          {{ editingId !== null ? 'Enregistrer' : 'Créer' }}
        </button>
      </template>
    </DrawerPanel>

    <!-- ================================================
         Modal suppression
    ================================================ -->
    <div v-if="confirmDeleteId !== null" class="overlay" @click.self="cancelDelete">
      <dialog class="confirm-dialog card" open aria-labelledby="del-title">
        <p id="del-title" class="confirm-title">Confirmer la suppression</p>
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

    <!-- ================================================
         Modal affectations
    ================================================ -->
    <div v-if="affectModalOpen" class="overlay" @click.self="closeAffectModal">
      <dialog class="affect-modal card" open aria-labelledby="affect-title">
        <!-- Entête modale -->
        <div class="affect-modal-header">
          <div>
            <p id="affect-title" class="affect-modal-title">
              Affectations — {{ selectedCollab?.prenom }} {{ selectedCollab?.nom }}
            </p>
            <p class="affect-modal-sub">{{ selectedCollab?.metierLabel || '—' }} · {{ selectedCollab?.agenceNom || '—' }}</p>
          </div>
          <button class="close-btn" type="button" aria-label="Fermer" @click="closeAffectModal">✕</button>
        </div>

        <!-- Onglets dossiers / procédures -->
        <div class="affect-tabs" role="tablist">
          <button
            class="affect-tab"
            :class="{ 'affect-tab--active': affectTab === 'dossiers' }"
            role="tab"
            type="button"
            @click="affectTab = 'dossiers'; showAddForm = false"
          >
            Dossiers <span class="tab-count">{{ affectDossiers.length }}</span>
          </button>
          <button
            class="affect-tab"
            :class="{ 'affect-tab--active': affectTab === 'procedures' }"
            role="tab"
            type="button"
            @click="affectTab = 'procedures'; showAddForm = false"
          >
            Procédures <span class="tab-count">{{ affectProcedures.length }}</span>
          </button>
        </div>

        <!-- Contenu -->
        <div class="affect-modal-body">
          <div v-if="affectLoading" class="affect-loading">Chargement…</div>

          <template v-else>
            <p v-if="affectError" class="form-error" role="alert">{{ affectError }}</p>

            <!-- ---- Onglet Dossiers ---- -->
            <template v-if="affectTab === 'dossiers'">
              <table v-if="affectDossiers.length" class="affect-table">
                <thead>
                  <tr>
                    <th>Dossier</th>
                    <th>Client</th>
                    <th>Rôle</th>
                    <th>Début</th>
                    <th>Fin</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="a in affectDossiers" :key="a.id">
                    <td class="ref-cell">{{ a.dossierReference }}</td>
                    <td>{{ a.dossierClient || '—' }}</td>
                    <td>{{ a.roleLibelle || '—' }}</td>
                    <td>{{ a.dateDebut || '—' }}</td>
                    <td>{{ a.dateFin || '—' }}</td>
                    <td>
                      <button class="button button-danger button-xs" type="button" @click="removeAffectDossier(a.id)">
                        Retirer
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="affect-empty">Aucune affectation sur un dossier.</p>
            </template>

            <!-- ---- Onglet Procédures ---- -->
            <template v-else>
              <table v-if="affectProcedures.length" class="affect-table">
                <thead>
                  <tr>
                    <th>Procédure</th>
                    <th>Dossier</th>
                    <th>Rôle</th>
                    <th>Début</th>
                    <th>Fin</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="a in affectProcedures" :key="a.id">
                    <td>{{ a.procedureType || '—' }}</td>
                    <td class="ref-cell">{{ a.dossierReference }}</td>
                    <td>{{ a.roleLibelle || '—' }}</td>
                    <td>{{ a.dateDebut || '—' }}</td>
                    <td>{{ a.dateFin || '—' }}</td>
                    <td>
                      <button class="button button-danger button-xs" type="button" @click="removeAffectProcedure(a.id)">
                        Retirer
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="affect-empty">Aucune affectation sur une procédure.</p>
            </template>

            <!-- ---- Formulaire d'ajout ---- -->
            <div v-if="showAddForm" class="add-form card-inner">
              <p class="add-form-title">
                {{ affectTab === 'dossiers' ? 'Affecter à un dossier' : 'Affecter à une procédure' }}
              </p>

              <!-- Ajout dossier -->
              <template v-if="affectTab === 'dossiers'">
                <div class="add-form-grid">
                  <label>
                    Dossier <span class="required">*</span>
                    <select v-model="addFormDossier.dossierId" class="input">
                      <option :value="null">— Choisir —</option>
                      <option v-for="d in dossiers" :key="d.id" :value="d.id">
                        {{ d.reference }} — {{ d.client }}
                      </option>
                    </select>
                  </label>
                  <label>
                    Rôle
                    <select v-model="addFormDossier.roleId" class="input">
                      <option :value="null">— Aucun —</option>
                      <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.libelle }}</option>
                    </select>
                  </label>
                  <label>
                    Date début
                    <input v-model="addFormDossier.dateDebut" class="input" type="date" />
                  </label>
                  <label>
                    Date fin
                    <input v-model="addFormDossier.dateFin" class="input" type="date" />
                  </label>
                </div>
              </template>

              <!-- Ajout procédure -->
              <template v-else>
                <div class="add-form-grid">
                  <label>
                    Procédure <span class="required">*</span>
                    <select v-model="addFormProcedure.procedureId" class="input">
                      <option :value="null">— Choisir —</option>
                      <option v-for="p in procedures" :key="p.id" :value="p.id">
                        {{ p.dossierReference }} — {{ p.type }}
                      </option>
                    </select>
                  </label>
                  <label>
                    Rôle
                    <select v-model="addFormProcedure.roleId" class="input">
                      <option :value="null">— Aucun —</option>
                      <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.libelle }}</option>
                    </select>
                  </label>
                  <label>
                    Date début
                    <input v-model="addFormProcedure.dateDebut" class="input" type="date" />
                  </label>
                  <label>
                    Date fin
                    <input v-model="addFormProcedure.dateFin" class="input" type="date" />
                  </label>
                </div>
              </template>

              <p v-if="addError" class="form-error" role="alert">{{ addError }}</p>
              <div class="add-form-actions">
                <button class="button button-secondary button-sm" type="button" @click="showAddForm = false">Annuler</button>
                <button class="button button-sm" type="button" @click="submitAddAffect">Confirmer</button>
              </div>
            </div>
          </template>
        </div>

        <!-- Pied de modale -->
        <div class="affect-modal-footer">
          <button v-if="!showAddForm" class="button button-secondary button-sm" type="button" @click="openAddForm">
            + Ajouter une affectation
          </button>
          <button class="button button-sm" type="button" @click="closeAffectModal">Fermer</button>
        </div>
      </dialog>
    </div>
  </section>
</template>

<style scoped>
/* ---- Badges ---- */
.badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.badge-active   { background: #dcfce7; color: #15803d; }
.badge-inactive { background: #fee2e2; color: #b91c1c; }

/* ---- Boutons ---- */
.button-sm  { padding: 0.25rem 0.625rem; font-size: 0.8125rem; }
.button-xs  { padding: 0.125rem 0.5rem;  font-size: 0.75rem; }
.button-danger {
  background: var(--color-danger, #dc2626);
  border-color: var(--color-danger, #dc2626);
  color: #fff;
}
.button-danger:hover {
  background: var(--color-danger-hover, #b91c1c);
  border-color: var(--color-danger-hover, #b91c1c);
}

/* ---- Tableau ---- */
.row-actions { display: flex; gap: 0.5rem; justify-content: center; }

/* ---- Formulaire ---- */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.label-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9375rem;
}
.checkbox  { width: 1rem; height: 1rem; cursor: pointer; }
.form-error { color: var(--color-danger, #dc2626); font-size: 0.875rem; margin-top: 0.25rem; }
.required   { color: var(--color-danger, #dc2626); }

/* ---- Overlay ---- */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

/* ---- Confirm dialog ---- */
.confirm-dialog {
  width: min(90vw, 28rem);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.confirm-title   { font-weight: 700; font-size: 1rem; }
.confirm-body    { font-size: 0.9375rem; color: var(--color-text-secondary, #6b7280); line-height: 1.5; }
.confirm-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }

/* ---- Modal affectations ---- */
.affect-modal {
  width: min(95vw, 780px);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.affect-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  flex-shrink: 0;
}

.affect-modal-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
}
.affect-modal-sub {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #6b7280);
  margin: 0.125rem 0 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  color: var(--color-text-secondary, #6b7280);
  line-height: 1;
  padding: 0.25rem;
  flex-shrink: 0;
}
.close-btn:hover { color: var(--color-text, #111827); }

/* ---- Onglets ---- */
.affect-tabs {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem 0;
  flex-shrink: 0;
}
.affect-tab {
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 0.375rem;
  background: transparent;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
  display: flex;
  align-items: center;
  gap: 0.375rem;
}
.affect-tab:hover {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--color-text, #111827);
}
.affect-tab--active {
  background: var(--color-primary, #1d4ed8);
  color: #fff;
  border-color: var(--color-primary, #1d4ed8);
  font-weight: 600;
}
.tab-count {
  background: rgba(255,255,255,0.25);
  border-radius: 9999px;
  padding: 0 0.375rem;
  font-size: 0.75rem;
}
.affect-tab:not(.affect-tab--active) .tab-count {
  background: var(--color-bg-surface, #f3f4f6);
  color: var(--color-text-secondary, #6b7280);
}

/* ---- Corps ---- */
.affect-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.affect-loading { text-align: center; color: var(--color-text-secondary, #6b7280); padding: 1.5rem 0; }
.affect-empty   { color: var(--color-text-secondary, #6b7280); font-size: 0.875rem; font-style: italic; }

/* ---- Tableau affectations ---- */
.affect-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.affect-table th {
  text-align: left;
  font-weight: 600;
  padding: 0.375rem 0.5rem;
  border-bottom: 2px solid var(--color-border, #e5e7eb);
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.affect-table td {
  padding: 0.5rem 0.5rem;
  border-bottom: 1px solid var(--color-border, #f3f4f6);
  vertical-align: middle;
}
.affect-table tr:last-child td { border-bottom: none; }
.ref-cell { font-family: monospace; font-weight: 600; }

/* ---- Formulaire d'ajout ---- */
.card-inner {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 0.5rem;
  padding: 1rem;
  background: var(--color-bg-surface, #f9fafb);
}
.add-form-title {
  font-weight: 600;
  font-size: 0.9rem;
  margin: 0 0 0.75rem;
}
.add-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
@media (max-width: 560px) {
  .add-form-grid { grid-template-columns: 1fr; }
}
.add-form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

/* ---- Pied de modale ---- */
.affect-modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.5rem;
  border-top: 1px solid var(--color-border, #e5e7eb);
  flex-shrink: 0;
}
</style>