<script setup lang="ts">

import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getAgences, getClients, getDossierById, getProcedures, getStatutsDossier, getTypesDossier, updateDossier } from '../services/api';
import type { Dossier, StatutDossier, TypeDossier, Agence, Client, ProcedureItem } from '../types/domain';

const route = useRoute();
const router = useRouter();

const dossierId = Number(route.params.id);
const dossier = ref<Dossier | undefined>(undefined);
const form = reactive({
  reference: '',
  client: null as number | null,
  type: null as number | null,
  statut: null as number | null,
  agence: null as number | null,
  ouverture: '',
  echeance: '',
  montant: 0,
});

const statuts = ref<StatutDossier[]>([]);
const types = ref<TypeDossier[]>([]);
const agences = ref<Agence[]>([]);
const clients = ref<Client[]>([]);
const procedures = ref<ProcedureItem[]>([]);
const isHydrating = ref(true);
const isSaving = ref(false);
const saveError = ref('');
const lastSavedAt = ref('');
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const unresolvedReferences = reactive({
  client: '',
  type: '',
  statut: '',
  agence: '',
});

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function resolveOptionId<T extends { id: number }>(
  options: T[],
  rawValue: unknown,
  rawId: unknown,
  getLabels: (option: T) => string[],
): number | null {
  const candidateId = toNullableNumber(rawId) ?? toNullableNumber(rawValue);

  if (candidateId !== null && options.some((option) => option.id === candidateId)) {
    return candidateId;
  }

  const normalizedValue = normalizeText(rawValue);
  if (!normalizedValue) {
    return null;
  }

  const match = options.find((option) =>
    getLabels(option).some((label) => normalizeText(label) === normalizedValue),
  );

  return match?.id ?? null;
}

function getUnresolvedReferenceLabel(rawValue: unknown, resolvedId: number | null): string {
  if (resolvedId !== null) {
    return '';
  }

  const rawLabel = String(rawValue ?? '').trim();
  return rawLabel.length > 0 ? rawLabel : '';
}

async function loadReferences() {
  [statuts.value, types.value, agences.value, clients.value] = await Promise.all([
    getStatutsDossier(),
    getTypesDossier(),
    getAgences(),
    getClients(),
  ]);
}

async function loadProcedures() {
  procedures.value = await getProcedures();
}

async function loadDossier() {
  isHydrating.value = true;
  await Promise.all([loadReferences(), loadProcedures()]);
  try {
    const apiDossier = await getDossierById(dossierId);
    // Prefer explicit relation IDs from API and fallback to label matching.
    const resolvedClientId = resolveOptionId(
      clients.value,
      apiDossier.client,
      apiDossier.clientId,
      (client) => [
        `${client.nom} ${client.prenom}`,
        `${client.prenom} ${client.nom}`,
      ],
    );
    const resolvedTypeId = resolveOptionId(
      types.value,
      apiDossier.type,
      apiDossier.typeId,
      (type) => [type.libelle],
    );
    const resolvedStatutId = resolveOptionId(
      statuts.value,
      apiDossier.statut,
      apiDossier.statutId,
      (statut) => [statut.libelle],
    );
    const resolvedAgenceId = resolveOptionId(
      agences.value,
      apiDossier.agence,
      apiDossier.agenceId,
      (agence) => [agence.nom],
    );

    form.reference = apiDossier.reference;
    form.client = resolvedClientId;
    form.type = resolvedTypeId;
    form.statut = resolvedStatutId;
    form.agence = resolvedAgenceId;
    form.ouverture = apiDossier.ouverture;
    form.echeance = apiDossier.echeance;
    form.montant = apiDossier.montant;
    unresolvedReferences.client = getUnresolvedReferenceLabel(apiDossier.client, resolvedClientId);
    unresolvedReferences.type = getUnresolvedReferenceLabel(apiDossier.type, resolvedTypeId);
    unresolvedReferences.statut = getUnresolvedReferenceLabel(apiDossier.statut, resolvedStatutId);
    unresolvedReferences.agence = getUnresolvedReferenceLabel(apiDossier.agence, resolvedAgenceId);
    dossier.value = apiDossier;
  } catch {
    unresolvedReferences.client = '';
    unresolvedReferences.type = '';
    unresolvedReferences.statut = '';
    unresolvedReferences.agence = '';
    dossier.value = undefined;
  } finally {
    isHydrating.value = false;
  }
}

onMounted(loadDossier);

onUnmounted(() => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
});

function canAutoSave(): boolean {
  return Boolean(
    dossier.value
    && form.reference.trim().length > 0
    && form.client !== null
    && form.type !== null
    && form.statut !== null
    && form.agence !== null,
  );
}

async function persistDossierChanges() {
  if (isHydrating.value || !canAutoSave()) {
    return;
  }

  isSaving.value = true;
  saveError.value = '';

  try {
    const updated = await updateDossier(dossierId, {
      reference: form.reference,
      client: String(form.client),
      type: String(form.type),
      statut: String(form.statut),
      agence: String(form.agence),
      ouverture: form.ouverture,
      echeance: form.echeance,
      montant: Number(form.montant ?? 0),
    });

    dossier.value = updated;
    lastSavedAt.value = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : 'Erreur lors de la sauvegarde automatique.';
  } finally {
    isSaving.value = false;
  }
}

function queueAutosave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    void persistDossierChanges();
  }, 500);
}

watch(form, () => {
  if (isHydrating.value) {
    return;
  }

  queueAutosave();
}, { deep: true });

const dossierProcedures = computed(() =>
  procedures.value.filter(p => p.dossierReference === form.reference)
);

const proceduresSummary = computed(() => {
  const total = dossierProcedures.value.length;
  return `${total} procedure${total > 1 ? 's' : ''} associee${total > 1 ? 's' : ''}`;
});

const selectedStatutLabel = computed(() => {
  if (form.statut === null) {
    return dossier.value?.statut ?? '';
  }

  return statuts.value.find((item) => item.id === form.statut)?.libelle ?? dossier.value?.statut ?? '';
});

function getStatusColorClass(status: string): 'status-ok' | 'status-warn' | 'status-alert' {
  const normalizedStatut = normalizeText(status);

  if (['cloture', 'terminee', 'valide', 'archive'].includes(normalizedStatut)) {
    return 'status-ok';
  }

  if (['urgent', 'a relire', 'en retard'].includes(normalizedStatut)) {
    return 'status-alert';
  }

  return 'status-warn';
}

const dossierStatusClass = computed(() => {
  return getStatusColorClass(selectedStatutLabel.value);
});

function goBackToDossiers() {
  router.push({ name: 'dossiers' });
}

function goToProcedure(procId: number) {
  router.push({ name: 'procedure-detail', params: { id: procId } });
}
</script>

<template>
  <section class="page-grid">
    <div v-if="dossier">
      <div class="action-bar card">
        <div>
          <p class="action-bar-title">Détail du dossier</p>
          <p class="action-bar-caption detail-caption">
            Référence : <strong>{{ dossier.reference }}</strong>
            <span :class="['status-pill', dossierStatusClass]">{{ selectedStatutLabel || 'Sans statut' }}</span>
          </p>
          <p v-if="isSaving" class="action-bar-caption autosave-caption">Enregistrement en cours...</p>
          <p v-else-if="saveError" class="action-bar-caption autosave-caption autosave-error">{{ saveError }}</p>
          <p v-else-if="lastSavedAt" class="action-bar-caption autosave-caption">Derniere sauvegarde: {{ lastSavedAt }}</p>
        </div>
        <div class="action-bar-actions">
          <button
            class="button button-secondary back-button"
            type="button"
            @click="goBackToDossiers"
          >
            <svg class="back-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Retour dossiers
          </button>
        </div>
      </div>
      <div class="detail-columns">
        <div class="card form-card">
          <form class="form-grid">
            <label>
              Référence
              <input v-model="form.reference" class="input" />
            </label>
            <label>
              Client
              <select v-model="form.client" class="input">
                <option value="" disabled>Choisir un client</option>
                <option v-for="c in clients" :key="c.id" :value="c.id">
                  {{ c.nom }} {{ c.prenom }}
                </option>
              </select>
              <p v-if="unresolvedReferences.client" class="field-warning">
                Le client "{{ unresolvedReferences.client }}" n'existe plus dans les references disponibles.
              </p>
            </label>
            <label>
              Type
              <select v-model="form.type" class="input">
                <option value="" disabled>Choisir un type</option>
                <option v-for="t in types" :key="t.id" :value="t.id">{{ t.libelle }}</option>
              </select>
              <p v-if="unresolvedReferences.type" class="field-warning">
                Le type "{{ unresolvedReferences.type }}" n'existe plus dans les references disponibles.
              </p>
            </label>
            <label>
              Statut
              <select v-model="form.statut" class="input">
                <option value="" disabled>Choisir un statut</option>
                <option v-for="s in statuts" :key="s.id" :value="s.id">{{ s.libelle }}</option>
              </select>
              <p v-if="unresolvedReferences.statut" class="field-warning">
                Le statut "{{ unresolvedReferences.statut }}" n'existe plus dans les references disponibles.
              </p>
            </label>
            <label>
              Agence
              <select v-model="form.agence" class="input" disabled>
                <option value="" disabled>Choisir une agence</option>
                <option v-for="a in agences" :key="a.id" :value="a.id">{{ a.nom }}</option>
              </select>
              <p class="action-bar-caption">Ce champ est verrouille et ne peut pas etre modifie.</p>
              <p v-if="unresolvedReferences.agence" class="field-warning">
                L'agence "{{ unresolvedReferences.agence }}" n'existe plus dans les references disponibles.
              </p>
            </label>
            <label>
              Ouverture
              <input v-model="form.ouverture" class="input" type="date" />
            </label>
            <label>
              Échéance
              <input v-model="form.echeance" class="input" type="date" />
            </label>
            <label>
              Montant
              <input v-model.number="form.montant" class="input" type="number" />
            </label>
          </form>
        </div>
        <div class="card procedures-card">
          <div class="block-header">
            <p class="action-bar-title">Procédures associées</p>
            <p class="action-bar-caption">{{ proceduresSummary }} au dossier {{ form.reference || dossier.reference }}</p>
          </div>
          <ul v-if="dossierProcedures.length > 0" class="list-rows">
            <li v-for="proc in dossierProcedures" :key="proc.id" class="list-row">
              <span class="list-row-title">{{ proc.type }}</span>
              <span :class="['status-pill', getStatusColorClass(proc.statut)]">{{ proc.statut }}</span>
              <button class="button button-secondary" @click.prevent="goToProcedure(proc.id)">Voir</button>
            </li>
          </ul>
          <p v-else class="action-bar-caption">Aucune procédure associée à ce dossier.</p>
        </div>
      </div>
    </div>
    <div v-else class="card" style="padding:2rem;text-align:center;">
      <p>Dossier introuvable.</p>
    </div>
  </section>
</template>

<style scoped>
.form-grid {
  max-width: 600px;
  margin: 0 auto;
}

.detail-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  gap: 1.2rem;
  align-items: start;
}

.form-card,
.procedures-card {
  margin-top: 1.2rem;
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
