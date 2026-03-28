<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getProcedureById, getProcedureInstances, getStatutsProcedure, updateProcedure } from '../services/api';
import { getStatusColorClass } from '../services/status';
import type { ProcedureItem, ProcedureInstance, StatutDossier } from '../types/domain';

const route = useRoute();
const router = useRouter();

const procedureId = Number(route.params.id);
const procedure = ref<ProcedureItem | undefined>(undefined);
const instances = ref<ProcedureInstance[]>([]);
const statusOptions = ref<StatutDossier[]>([]);
const unresolvedStatut = ref('');
const isHydrating = ref(true);
const isSaving = ref(false);
const saveError = ref('');
const lastSavedAt = ref('');
const error = ref('');

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

const form = reactive({
  type: '',
  statut: '',
  juridiction: '',
  debut: '',
  fin: '',
});

function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

const procedureStatusClass = computed(() => getStatusColorClass(form.statut || procedure.value?.statut || ''));

const instancesSummary = computed(() => {
  const total = instances.value.length;
  return `${total} instance${total > 1 ? 's' : ''} associee${total > 1 ? 's' : ''}`;
});

const selectableStatusOptions = computed(() => {
  const currentStatus = form.statut.trim();
  if (!currentStatus) {
    return statusOptions.value;
  }

  const hasCurrentStatus = statusOptions.value.some((option) =>
    normalizeText(option.libelle) === normalizeText(currentStatus),
  );

  if (hasCurrentStatus) {
    return statusOptions.value;
  }

  return [{ id: -1, libelle: currentStatus }, ...statusOptions.value];
});

function refreshUnresolvedStatus(rawStatus: string) {
  const normalizedStatus = normalizeText(rawStatus);
  if (!normalizedStatus) {
    unresolvedStatut.value = '';
    return;
  }

  const exists = statusOptions.value.some((option) => normalizeText(option.libelle) === normalizedStatus);
  unresolvedStatut.value = exists ? '' : rawStatus.trim();
}

async function loadProcedure() {
  isHydrating.value = true;
  saveError.value = '';
  unresolvedStatut.value = '';

  try {
    const [apiProcedure, apiInstances, apiStatusOptions] = await Promise.all([
      getProcedureById(procedureId),
      getProcedureInstances(procedureId),
      getStatutsProcedure().catch(() => []),
    ]);

    procedure.value = apiProcedure;
    instances.value = apiInstances;
    statusOptions.value = apiStatusOptions;
    form.type = apiProcedure.type;
    form.statut = apiProcedure.statut;
    form.juridiction = apiProcedure.juridiction;
    form.debut = apiProcedure.debut;
    form.fin = apiProcedure.fin ?? '';
    refreshUnresolvedStatus(apiProcedure.statut);
    error.value = '';
  } catch (caughtError) {
    procedure.value = undefined;
    instances.value = [];
    statusOptions.value = [];
    unresolvedStatut.value = '';
    error.value = caughtError instanceof Error ? caughtError.message : 'Procedure introuvable ou erreur API.';
  } finally {
    isHydrating.value = false;
  }
}

onMounted(() => {
  if (!Number.isFinite(procedureId)) {
    error.value = 'ID procedure invalide.';
    isHydrating.value = false;
    return;
  }

  void loadProcedure();
});

onUnmounted(() => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
});

function canAutoSave(): boolean {
  return Boolean(
    procedure.value
    && form.type.trim().length > 0
    && form.statut.trim().length > 0,
  );
}

async function persistProcedureChanges() {
  if (isHydrating.value || !canAutoSave()) {
    return;
  }

  isSaving.value = true;
  saveError.value = '';

  try {
    const updated = await updateProcedure(procedureId, {
      type: form.type,
      statut: form.statut,
      debut: form.debut,
      fin: form.fin,
    });

    procedure.value = updated;
    form.juridiction = updated.juridiction;
    lastSavedAt.value = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch (caughtError) {
    saveError.value = caughtError instanceof Error ? caughtError.message : 'Erreur lors de la sauvegarde automatique.';
  } finally {
    isSaving.value = false;
  }
}

function queueAutosave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    void persistProcedureChanges();
  }, 500);
}

watch(
  () => [form.type, form.statut, form.debut, form.fin],
  () => {
    if (isHydrating.value) {
      return;
    }

    queueAutosave();
  },
);

watch(
  () => form.statut,
  (value) => {
    refreshUnresolvedStatus(value);
  },
);

function goBack() {
  router.back();
}
</script>

<template>
  <section class="page-grid">
    <div v-if="procedure">
      <div class="action-bar card">
        <div>
          <p class="action-bar-title">Detail de la procedure</p>
          <p class="action-bar-caption detail-caption">
            Dossier : <strong>{{ procedure.dossierReference }}</strong>
            <span :class="['status-pill', procedureStatusClass]">{{ form.statut || 'Sans statut' }}</span>
          </p>
          <p v-if="isSaving" class="action-bar-caption autosave-caption">Enregistrement en cours...</p>
          <p v-else-if="saveError" class="action-bar-caption autosave-caption autosave-error">{{ saveError }}</p>
          <p v-else-if="lastSavedAt" class="action-bar-caption autosave-caption">Derniere sauvegarde: {{ lastSavedAt }}</p>
        </div>
        <div class="action-bar-actions">
          <button class="button button-secondary back-button" type="button" @click="goBack">
            <svg class="back-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Retour
          </button>
        </div>
      </div>

      <div class="detail-columns">
        <div class="card form-card">
          <div class="block-header">
            <p class="action-bar-title">Modification procedure</p>
            <p class="action-bar-caption">Le formulaire se sauvegarde automatiquement a chaque changement.</p>
          </div>

          <form class="form-grid" @submit.prevent>
            <label>
              Type de procedure
              <input v-model="form.type" class="input" />
            </label>
            <label>
              Statut
              <select v-model="form.statut" class="input">
                <option value="" disabled>Choisir un statut</option>
                <option
                  v-for="status in selectableStatusOptions"
                  :key="`${status.id}-${status.libelle}`"
                  :value="status.libelle"
                >
                  {{ status.libelle }}
                </option>
              </select>
              <p v-if="unresolvedStatut" class="field-warning">
                Le statut "{{ unresolvedStatut }}" n'existe plus dans les references disponibles.
              </p>
            </label>
            <label>
              Juridiction principale
              <input v-model="form.juridiction" class="input" disabled />
              <p class="action-bar-caption">Calculee depuis la derniere instance de la procedure.</p>
            </label>
            <label>
              Date de debut
              <input v-model="form.debut" class="input" type="date" />
            </label>
            <label>
              Date de fin
              <input v-model="form.fin" class="input" type="date" />
            </label>
          </form>
        </div>

        <div class="card instances-card">
          <div class="block-header">
            <p class="action-bar-title">Instances associees</p>
            <p class="action-bar-caption">{{ instancesSummary }} a cette procedure</p>
          </div>

          <ul v-if="instances.length > 0" class="list-rows">
            <li v-for="instance in instances" :key="instance.id" class="list-row">
              <div>
                <p class="list-row-title">{{ instance.type }}</p>
                <p class="list-row-subtitle">
                  Debut: {{ instance.debut || 'Non renseignee' }} / Fin: {{ instance.fin || 'En cours' }}
                </p>
              </div>
              <span :class="['status-pill', getStatusColorClass(instance.statut)]">{{ instance.statut }}</span>
            </li>
          </ul>
          <p v-else class="action-bar-caption">Aucune instance associee a cette procedure.</p>
        </div>
      </div>
    </div>

    <div v-else class="card" style="padding:2rem;text-align:center;">
      <p>{{ error || 'Procedure introuvable.' }}</p>
    </div>
  </section>
</template>

<style scoped>
.detail-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  gap: 1.2rem;
  align-items: start;
}

.form-card,
.instances-card {
  margin-top: 1.2rem;
}

.form-grid {
  max-width: 600px;
  margin: 0 auto;
}

.block-header {
  display: grid;
  gap: 0.2rem;
  margin-bottom: 0.9rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid var(--border-color);
}

.detail-caption {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
  margin-top: 0.15rem;
}

.autosave-caption {
  margin-top: 0.25rem;
}

.autosave-error {
  color: #ac1739;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.back-icon {
  width: 0.9rem;
  height: 0.9rem;
}

.field-warning {
  margin: 0.45rem 0 0;
  color: #8c5a00;
  font-size: 0.9rem;
}

@media (max-width: 1100px) {
  .detail-columns {
    grid-template-columns: 1fr;
  }
}
</style>
