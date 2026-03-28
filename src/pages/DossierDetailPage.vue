<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import {
  getAgences,
  getClients,
  getDossierById,
  getProcedureById,
  getProcedureHistory,
  getProcedureInstances,
  getProcedures,
  getStatutsInstance,
  getStatutsDossier,
  getStatutsProcedure,
  getTypesInstance,
  getTypesProcedure,
  updateProcedureInstance,
  getTypesDossier,
  updateProcedure,
  updateDossier,
} from '../services/api';
import { getStatusColorClass } from '../services/status';
import type {
  Agence,
  Client,
  Dossier,
  ProcedureHistoryItem,
  ProcedureInstance,
  ProcedureItem,
  StatutDossier,
  StatutInstance,
  TypeDossier,
  TypeInstance,
  TypeProcedure,
} from '../types/domain';

type ProcedureTab = 'procedure-detail' | 'history' | 'new-document' | 'notes';

const route = useRoute();
const router = useRouter();

const dossierId = Number(route.params.id);
const dossier = ref<Dossier | undefined>(undefined);
const statuts = ref<StatutDossier[]>([]);
const types = ref<TypeDossier[]>([]);
const agences = ref<Agence[]>([]);
const clients = ref<Client[]>([]);
const procedures = ref<ProcedureItem[]>([]);
const selectedProcedureId = ref<number | null>(null);
const selectedProcedure = ref<ProcedureItem | undefined>(undefined);
const selectedProcedureInstances = ref<ProcedureInstance[]>([]);
const selectedProcedureHistory = ref<ProcedureHistoryItem[]>([]);
const procedureStatusOptions = ref<StatutDossier[]>([]);
const procedureTypeOptions = ref<TypeProcedure[]>([]);
const instanceTypeOptions = ref<TypeInstance[]>([]);
const instanceStatusOptions = ref<StatutInstance[]>([]);
const activeTab = ref<ProcedureTab>('procedure-detail');
const isLoading = ref(true);
const isSaving = ref(false);
const saveError = ref('');
const lastSavedAt = ref('');
const isLoadingProcedurePanel = ref(false);
const procedurePanelError = ref('');
const editDrawerOpen = ref(false);
const procedureIsSaving = ref(false);
const procedureSaveError = ref('');
const procedureLastSavedAt = ref('');
const unresolvedProcedureStatut = ref('');
const unresolvedProcedureType = ref('');
const instanceDrawerOpen = ref(false);
const selectedInstanceId = ref<number | null>(null);
const isLoadingInstanceReferences = ref(false);
const hasLoadedInstanceReferences = ref(false);
const instanceReferencesError = ref('');
const isSavingInstance = ref(false);
const instanceSaveError = ref('');
const instanceLastSavedAt = ref('');
const unresolvedInstanceType = ref('');
const unresolvedInstanceStatut = ref('');

const procedureForm = reactive({
  type: '',
  statut: '',
  juridiction: '',
  debut: '',
  fin: '',
});

const instanceForm = reactive({
  type: '',
  statut: '',
  debut: '',
  fin: '',
});

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

function toDisplayDate(value: string | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return 'Non renseignee';
  }

  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return parsed.toLocaleDateString('fr-FR');
}

function toCurrency(value: number): string {
  return Number(value ?? 0).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  });
}

async function loadReferences() {
  [statuts.value, types.value, agences.value, clients.value] = await Promise.all([
    getStatutsDossier(),
    getTypesDossier(),
    getAgences(),
    getClients(),
  ]);
}

async function loadInstanceReferences(force = false) {
  if (hasLoadedInstanceReferences.value && !force) {
    return;
  }

  isLoadingInstanceReferences.value = true;
  instanceReferencesError.value = '';

  try {
    const [typesOptions, statusOptions] = await Promise.all([
      getTypesInstance(),
      getStatutsInstance(),
    ]);
    instanceTypeOptions.value = typesOptions;
    instanceStatusOptions.value = statusOptions;
    hasLoadedInstanceReferences.value = true;
  } catch (error) {
    instanceReferencesError.value = error instanceof Error
      ? error.message
      : 'Impossible de charger les references d\'instance.';
  } finally {
    isLoadingInstanceReferences.value = false;
  }
}

async function loadProcedures() {
  procedures.value = await getProcedures();
}

function hydrateFormFromDossier(apiDossier: Dossier) {
  const resolvedClientId = resolveOptionId(
    clients.value,
    apiDossier.client,
    apiDossier.clientId,
    (client) => [`${client.nom} ${client.prenom}`, `${client.prenom} ${client.nom}`],
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
}

async function loadDossierPage() {
  isLoading.value = true;

  try {
    await Promise.all([loadReferences(), loadProcedures()]);
    const apiDossier = await getDossierById(dossierId);
    dossier.value = apiDossier;
    hydrateFormFromDossier(apiDossier);
  } catch {
    dossier.value = undefined;
  } finally {
    isLoading.value = false;
  }
}

async function loadProcedurePanel(procedureId: number | null) {
  if (procedureId === null) {
    selectedProcedure.value = undefined;
    selectedProcedureInstances.value = [];
    selectedProcedureHistory.value = [];
    procedureForm.type = '';
    procedureForm.statut = '';
    procedureForm.juridiction = '';
    procedureForm.debut = '';
    procedureForm.fin = '';
    closeInstanceDrawer();
    procedurePanelError.value = '';
    return;
  }

  isLoadingProcedurePanel.value = true;
  procedurePanelError.value = '';

  try {
    const [procedureDetail, instances, history, statusOptions, typeOptions] = await Promise.all([
      getProcedureById(procedureId),
      getProcedureInstances(procedureId),
      getProcedureHistory(procedureId),
      getStatutsProcedure().catch(() => []),
      getTypesProcedure().catch(() => []),
    ]);

    selectedProcedure.value = procedureDetail;
    selectedProcedureInstances.value = instances;
    selectedProcedureHistory.value = history;
    procedureStatusOptions.value = statusOptions;
    procedureTypeOptions.value = typeOptions;
    procedureForm.type = procedureDetail.type;
    procedureForm.statut = procedureDetail.statut;
    procedureForm.juridiction = procedureDetail.juridiction;
    procedureForm.debut = procedureDetail.debut;
    procedureForm.fin = procedureDetail.fin ?? '';
    unresolvedProcedureType.value = '';
    unresolvedProcedureStatut.value = '';
  } catch (error) {
    selectedProcedure.value = undefined;
    selectedProcedureInstances.value = [];
    selectedProcedureHistory.value = [];
    procedurePanelError.value = error instanceof Error ? error.message : 'Impossible de charger les details de la procedure.';
  } finally {
    isLoadingProcedurePanel.value = false;
  }
}

onMounted(() => {
  void loadDossierPage();
  void loadInstanceReferences();
});

const dossierProcedures = computed(() => {
  const reference = dossier.value?.reference ?? '';
  if (!reference) {
    return [];
  }

  return procedures.value.filter((procedureItem) => procedureItem.dossierReference === reference);
});

watch(
  dossierProcedures,
  (nextProcedures) => {
    if (nextProcedures.length === 0) {
      selectedProcedureId.value = null;
      return;
    }

    const currentSelectionStillPresent = nextProcedures.some((item) => item.id === selectedProcedureId.value);
    if (!currentSelectionStillPresent) {
      selectedProcedureId.value = nextProcedures[0].id;
    }
  },
  { immediate: true },
);

watch(
  selectedProcedureId,
  (nextId) => {
    void loadProcedurePanel(nextId);
  },
  { immediate: true },
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

const dossierStatusClass = computed(() => getStatusColorClass(selectedStatutLabel.value));

const selectedClientLabel = computed(() => {
  if (form.client === null) {
    return unresolvedReferences.client || dossier.value?.client || 'Non renseigne';
  }

  const match = clients.value.find((client) => client.id === form.client);
  return match ? `${match.nom} ${match.prenom}` : unresolvedReferences.client || dossier.value?.client || 'Non renseigne';
});

const selectedTypeLabel = computed(() => {
  if (form.type === null) {
    return unresolvedReferences.type || dossier.value?.type || 'Non renseigne';
  }

  return (types.value.find((item) => item.id === form.type)?.libelle ?? unresolvedReferences.type)
    || dossier.value?.type
    || 'Non renseigne';
});

const selectedAgenceLabel = computed(() => {
  if (form.agence === null) {
    return unresolvedReferences.agence || dossier.value?.agence || 'Non renseignee';
  }

  return (agences.value.find((item) => item.id === form.agence)?.nom ?? unresolvedReferences.agence)
    || dossier.value?.agence
    || 'Non renseignee';
});

const detailFields = computed(() => {
  if (!dossier.value) {
    return [];
  }

  return [
    { label: 'Client', value: selectedClientLabel.value },
    { label: 'Type de dossier', value: selectedTypeLabel.value },
    { label: 'Statut', value: selectedStatutLabel.value || 'Sans statut' },
    { label: 'Agence', value: selectedAgenceLabel.value },
    { label: 'Date ouverture', value: toDisplayDate(dossier.value.ouverture) },
    { label: 'Date echeance', value: toDisplayDate(dossier.value.echeance) },
    { label: 'Montant HT', value: toCurrency(dossier.value.montant) },
  ];
});

const selectedProcedureStatusClass = computed(() =>
  getStatusColorClass(procedureForm.statut || (selectedProcedure.value?.statut ?? '')),
);

const selectableProcedureStatusOptions = computed(() => {
  const currentStatus = procedureForm.statut.trim();
  if (!currentStatus) {
    return procedureStatusOptions.value;
  }

  const hasCurrentStatus = procedureStatusOptions.value.some((option) =>
    normalizeText(option.libelle) === normalizeText(currentStatus),
  );

  if (hasCurrentStatus) {
    return procedureStatusOptions.value;
  }

  return [{ id: -1, libelle: currentStatus }, ...procedureStatusOptions.value];
});

const selectableProcedureTypeOptions = computed(() => {
  const currentType = procedureForm.type.trim();
  if (!currentType) {
    return procedureTypeOptions.value;
  }

  const hasCurrentType = procedureTypeOptions.value.some((option) =>
    normalizeText(option.libelle) === normalizeText(currentType),
  );

  if (hasCurrentType) {
    return procedureTypeOptions.value;
  }

  return [{ id: -1, libelle: currentType }, ...procedureTypeOptions.value];
});

const selectableInstanceTypeOptions = computed(() => {
  const currentType = instanceForm.type.trim();
  if (!currentType) {
    return instanceTypeOptions.value;
  }

  const hasCurrentType = instanceTypeOptions.value.some((option) =>
    normalizeText(option.libelle) === normalizeText(currentType),
  );

  if (hasCurrentType) {
    return instanceTypeOptions.value;
  }

  return [{ id: -1, libelle: currentType }, ...instanceTypeOptions.value];
});

const selectableInstanceStatusOptions = computed(() => {
  const currentStatus = instanceForm.statut.trim();
  if (!currentStatus) {
    return instanceStatusOptions.value;
  }

  const hasCurrentStatus = instanceStatusOptions.value.some((option) =>
    normalizeText(option.libelle) === normalizeText(currentStatus),
  );

  if (hasCurrentStatus) {
    return instanceStatusOptions.value;
  }

  return [{ id: -1, libelle: currentStatus }, ...instanceStatusOptions.value];
});

const historyEntries = computed(() => selectedProcedureHistory.value);

watch(
  () => procedureForm.statut,
  (value) => {
    const normalizedStatus = normalizeText(value);
    if (!normalizedStatus) {
      unresolvedProcedureStatut.value = '';
      return;
    }

    const exists = procedureStatusOptions.value.some((option) => normalizeText(option.libelle) === normalizedStatus);
    unresolvedProcedureStatut.value = exists ? '' : value.trim();
  },
);

watch(
  () => procedureForm.type,
  (value) => {
    const normalizedType = normalizeText(value);
    if (!normalizedType) {
      unresolvedProcedureType.value = '';
      return;
    }

    const exists = procedureTypeOptions.value.some((option) => normalizeText(option.libelle) === normalizedType);
    unresolvedProcedureType.value = exists ? '' : value.trim();
  },
);

watch(
  () => instanceForm.type,
  (value) => {
    const normalizedType = normalizeText(value);
    if (!normalizedType) {
      unresolvedInstanceType.value = '';
      return;
    }

    const exists = instanceTypeOptions.value.some((option) => normalizeText(option.libelle) === normalizedType);
    unresolvedInstanceType.value = exists ? '' : value.trim();
  },
);

watch(
  () => instanceForm.statut,
  (value) => {
    const normalizedStatus = normalizeText(value);
    if (!normalizedStatus) {
      unresolvedInstanceStatut.value = '';
      return;
    }

    const exists = instanceStatusOptions.value.some((option) => normalizeText(option.libelle) === normalizedStatus);
    unresolvedInstanceStatut.value = exists ? '' : value.trim();
  },
);

function openEditDrawer() {
  if (!dossier.value) {
    return;
  }

  saveError.value = '';
  hydrateFormFromDossier(dossier.value);
  editDrawerOpen.value = true;
}

function closeEditDrawer() {
  editDrawerOpen.value = false;
}

async function saveDossier() {
  if (
    !dossier.value
    || form.reference.trim().length === 0
    || form.client === null
    || form.type === null
    || form.statut === null
    || form.agence === null
  ) {
    saveError.value = 'Veuillez renseigner tous les champs obligatoires du dossier.';
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
    hydrateFormFromDossier(updated);
    await loadProcedures();
    lastSavedAt.value = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    editDrawerOpen.value = false;
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : 'Erreur lors de la sauvegarde du dossier.';
  } finally {
    isSaving.value = false;
  }
}

async function saveProcedureFromTab() {
  if (!selectedProcedure.value) {
    return;
  }

  if (!procedureForm.type.trim() || !procedureForm.statut.trim()) {
    procedureSaveError.value = 'Le type et le statut de la procedure sont obligatoires.';
    return;
  }

  procedureIsSaving.value = true;
  procedureSaveError.value = '';

  try {
    const updated = await updateProcedure(selectedProcedure.value.id, {
      type: procedureForm.type,
      statut: procedureForm.statut,
      debut: procedureForm.debut,
      fin: procedureForm.fin,
    });

    selectedProcedure.value = updated;
    procedureForm.type = updated.type;
    procedureForm.statut = updated.statut;
    procedureForm.juridiction = updated.juridiction;
    procedureForm.debut = updated.debut;
    procedureForm.fin = updated.fin ?? '';
    procedureLastSavedAt.value = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    await Promise.all([loadProcedures(), loadProcedurePanel(updated.id)]);
  } catch (error) {
    procedureSaveError.value = error instanceof Error ? error.message : 'Erreur lors de la sauvegarde de la procedure.';
  } finally {
    procedureIsSaving.value = false;
  }
}

function openInstanceDrawer(instance: ProcedureInstance) {
  selectedInstanceId.value = instance.id;
  instanceForm.type = instance.type;
  instanceForm.statut = instance.statut;
  instanceForm.debut = instance.debut;
  instanceForm.fin = instance.fin ?? '';
  instanceSaveError.value = '';
  instanceReferencesError.value = '';
  instanceDrawerOpen.value = true;
  void loadInstanceReferences();
}

function closeInstanceDrawer() {
  instanceDrawerOpen.value = false;
  selectedInstanceId.value = null;
  isLoadingInstanceReferences.value = false;
  instanceSaveError.value = '';
}

async function saveInstanceFromDrawer() {
  if (selectedInstanceId.value === null) {
    return;
  }

  if (!instanceForm.type.trim() || !instanceForm.statut.trim()) {
    instanceSaveError.value = 'Le type et le statut de l\'instance sont obligatoires.';
    return;
  }

  isSavingInstance.value = true;
  instanceSaveError.value = '';

  try {
    await updateProcedureInstance(selectedInstanceId.value, {
      type: instanceForm.type,
      statut: instanceForm.statut,
      debut: instanceForm.debut,
      fin: instanceForm.fin,
    });

    if (selectedProcedureId.value !== null) {
      await loadProcedurePanel(selectedProcedureId.value);
    }

    instanceLastSavedAt.value = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    closeInstanceDrawer();
  } catch (error) {
    instanceSaveError.value = error instanceof Error ? error.message : 'Erreur lors de la sauvegarde de l\'instance.';
  } finally {
    isSavingInstance.value = false;
  }
}

function goBackToDossiers() {
  router.push({ name: 'dossiers' });
}
</script>

<template>
  <section class="page-grid">
    <div v-if="isLoading" class="card state-card">
      <p>Chargement du dossier...</p>
    </div>

    <div v-else-if="dossier">
      <div class="action-bar card dossier-detail-bar">
        <div class="dossier-header-row">
          <div>
            <p class="action-bar-title">Detail du dossier</p>
            <p class="action-bar-caption detail-caption">
              Reference: <strong>{{ dossier.reference }}</strong>
              <span :class="['status-pill', dossierStatusClass]">{{ selectedStatutLabel || 'Sans statut' }}</span>
            </p>
            <p v-if="isSaving" class="action-bar-caption autosave-caption">Enregistrement en cours...</p>
            <p v-else-if="saveError" class="action-bar-caption autosave-caption autosave-error">{{ saveError }}</p>
            <p v-else-if="lastSavedAt" class="action-bar-caption autosave-caption">Derniere sauvegarde: {{ lastSavedAt }}</p>
          </div>

          <div class="action-bar-actions dossier-header-actions">
            <button class="button" type="button" @click="openEditDrawer">Modifier</button>
            <button class="button button-secondary back-button" type="button" @click="goBackToDossiers">
              <svg class="back-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              Retour dossiers
            </button>
          </div>
        </div>

        <div class="dossier-inline-details">
          <div v-for="field in detailFields" :key="field.label" class="dossier-inline-field">
            <p class="dossier-inline-label">{{ field.label }}</p>
            <p class="dossier-inline-value">{{ field.value }}</p>
          </div>
        </div>
      </div>

      <div class="detail-layout">
        <div class="card procedures-card compact-card">
          <div class="block-header">
            <p class="action-bar-title">Procedures associees</p>
            <p class="action-bar-caption">{{ proceduresSummary }}</p>
          </div>

          <ul v-if="dossierProcedures.length > 0" class="procedure-list">
            <li
              v-for="proc in dossierProcedures"
              :key="proc.id"
              :class="['procedure-list-item', selectedProcedureId === proc.id ? 'is-active' : '']"
              @click="selectedProcedureId = proc.id"
            >
              <span class="procedure-inline-text">{{ proc.type }} - {{ toDisplayDate(proc.debut) }}</span>
              <span :class="['status-pill', getStatusColorClass(proc.statut)]">{{ proc.statut }}</span>
            </li>
          </ul>
          <p v-else class="action-bar-caption">Aucune procedure associee a ce dossier.</p>
        </div>

        <div class="card procedure-workspace-card">
          <div class="block-header procedure-header-row">
            <div>
              <p class="action-bar-title">Espace procedure</p>
              <p v-if="selectedProcedure" class="action-bar-caption detail-caption">
                Procedure selectionnee: <strong>#{{ selectedProcedure.id }} - {{ selectedProcedure.type }}</strong>
                <span :class="['status-pill', selectedProcedureStatusClass]">{{ selectedProcedure.statut }}</span>
              </p>
              <p v-else class="action-bar-caption">Selectionnez une procedure pour afficher son detail.</p>
            </div>

            <div v-if="activeTab === 'procedure-detail' && selectedProcedure" class="action-bar-actions procedure-header-actions">
              <button class="button" type="button" :disabled="procedureIsSaving" @click="saveProcedureFromTab">
                {{ procedureIsSaving ? 'Enregistrement...' : 'Enregistrer la procedure' }}
              </button>
            </div>
          </div>

          <div class="tabs" role="tablist" aria-label="Navigation procedure">
            <button
              :class="['tab-button', activeTab === 'procedure-detail' ? 'is-active' : '']"
              type="button"
              role="tab"
              @click="activeTab = 'procedure-detail'"
            >
              Detail procedure
            </button>
            <button
              :class="['tab-button', activeTab === 'history' ? 'is-active' : '']"
              type="button"
              role="tab"
              @click="activeTab = 'history'"
            >
              Historique
            </button>
            <button
              :class="['tab-button', activeTab === 'new-document' ? 'is-active' : '']"
              type="button"
              role="tab"
              @click="activeTab = 'new-document'"
            >
              Nouveau document
            </button>
            <button
              :class="['tab-button', activeTab === 'notes' ? 'is-active' : '']"
              type="button"
              role="tab"
              @click="activeTab = 'notes'"
            >
              Bloc note
            </button>
          </div>

          <div class="tab-content">
            <template v-if="activeTab === 'procedure-detail'">
              <p v-if="isLoadingProcedurePanel" class="action-bar-caption">Chargement du detail procedure...</p>
              <p v-else-if="procedurePanelError" class="action-bar-caption autosave-error">{{ procedurePanelError }}</p>
              <template v-else-if="selectedProcedure">
                <form class="procedure-edit-grid" @submit.prevent="saveProcedureFromTab">
                  <label>
                    Type procedure
                    <select v-model="procedureForm.type" class="input">
                      <option value="" disabled>Choisir un type</option>
                      <option
                        v-for="procedureType in selectableProcedureTypeOptions"
                        :key="`${procedureType.id}-${procedureType.libelle}`"
                        :value="procedureType.libelle"
                      >
                        {{ procedureType.libelle }}
                      </option>
                    </select>
                    <p v-if="unresolvedProcedureType" class="field-warning">
                      Le type "{{ unresolvedProcedureType }}" n'existe plus dans les references disponibles.
                    </p>
                  </label>
                  <label>
                    Statut
                    <select v-model="procedureForm.statut" class="input">
                      <option value="" disabled>Choisir un statut</option>
                      <option
                        v-for="status in selectableProcedureStatusOptions"
                        :key="`${status.id}-${status.libelle}`"
                        :value="status.libelle"
                      >
                        {{ status.libelle }}
                      </option>
                    </select>
                    <p v-if="unresolvedProcedureStatut" class="field-warning">
                      Le statut "{{ unresolvedProcedureStatut }}" n'existe plus dans les references disponibles.
                    </p>
                  </label>
                  <label>
                    Date debut
                    <input v-model="procedureForm.debut" class="input" type="date" />
                  </label>
                  <label>
                    Date fin
                    <input v-model="procedureForm.fin" class="input" type="date" />
                  </label>
                  <label class="field-span-2">
                    Juridiction
                    <input v-model="procedureForm.juridiction" class="input" disabled />
                    <p class="action-bar-caption">Calculee depuis la derniere instance de la procedure.</p>
                  </label>
                </form>

                <p v-if="procedureIsSaving" class="action-bar-caption">Enregistrement en cours...</p>
                <p v-else-if="procedureSaveError" class="action-bar-caption autosave-error">{{ procedureSaveError }}</p>
                <p v-else-if="procedureLastSavedAt" class="action-bar-caption">Derniere sauvegarde procedure: {{ procedureLastSavedAt }}</p>

                <div class="instances-block">
                  <p class="action-bar-title">Instances associees</p>
                  <ul v-if="selectedProcedureInstances.length > 0" class="list-rows">
                    <li
                      v-for="instance in selectedProcedureInstances"
                      :key="instance.id"
                      class="list-row instance-row"
                      @click.stop="openInstanceDrawer(instance)"
                    >
                      <div>
                        <p class="list-row-title">{{ instance.type }}</p>
                        <p class="list-row-subtitle">
                          Debut: {{ toDisplayDate(instance.debut) }} / Fin: {{ toDisplayDate(instance.fin) }}
                        </p>
                      </div>
                      <div class="instance-row-meta">
                        <span class="instance-edit-hint" aria-hidden="true">
                          <svg class="instance-edit-icon" viewBox="0 0 24 24" fill="none">
                            <path d="M4 20H8L18.2 9.8C18.9 9.1 18.9 7.9 18.2 7.2L16.8 5.8C16.1 5.1 14.9 5.1 14.2 5.8L4 16V20Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                            <path d="M13 7L17 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                          Modifier
                        </span>
                        <span :class="['status-pill', getStatusColorClass(instance.statut)]">{{ instance.statut }}</span>
                      </div>
                    </li>
                  </ul>
                  <p v-else class="action-bar-caption">Aucune instance associee a cette procedure.</p>
                </div>
              </template>
              <p v-else class="action-bar-caption">Aucune procedure selectionnee.</p>
            </template>

            <template v-else-if="activeTab === 'history'">
              <p v-if="isLoadingProcedurePanel" class="action-bar-caption">Chargement de l'historique...</p>
              <ul v-else-if="historyEntries.length > 0" class="history-list">
                <li v-for="entry in historyEntries" :key="entry.id" class="history-item">
                  <p class="history-title">{{ entry.action }}</p>
                  <p class="history-meta">{{ entry.at ? toDisplayDate(entry.at.slice(0, 10)) : 'Date inconnue' }} - {{ entry.actor }}</p>
                  <p class="history-details">{{ entry.details }}</p>
                </li>
              </ul>
              <p v-else class="action-bar-caption">Aucun historique disponible pour la procedure selectionnee.</p>
            </template>

            <template v-else-if="activeTab === 'new-document'">
              <div class="placeholder-block">
                <p class="action-bar-title">Nouveau document</p>
                <p class="action-bar-caption">Bloc reserve. Les regles de creation seront precisees ulterieurement.</p>
              </div>
            </template>

            <template v-else>
              <div class="placeholder-block">
                <p class="action-bar-title">Bloc note</p>
                <p class="action-bar-caption">Bloc reserve. Le format des notes sera precise ulterieurement.</p>
              </div>
            </template>
          </div>
        </div>
      </div>

      <DrawerPanel
        :open="editDrawerOpen"
        title="Modification du dossier"
        description="Mise a jour des donnees metiers du dossier depuis un panneau lateral"
        @close="closeEditDrawer"
      >
        <form class="form-grid" @submit.prevent="saveDossier">
          <label>
            Reference dossier
            <input v-model="form.reference" class="input" required />
          </label>
          <label>
            Client principal
            <select v-model="form.client" class="input" required>
              <option value="" disabled>Choisir un client</option>
              <option v-for="client in clients" :key="client.id" :value="client.id">{{ client.nom }} {{ client.prenom }}</option>
            </select>
            <p v-if="unresolvedReferences.client" class="field-warning">
              Le client "{{ unresolvedReferences.client }}" n'existe plus dans les references disponibles.
            </p>
          </label>
          <label>
            Type de dossier
            <select v-model="form.type" class="input" required>
              <option value="" disabled>Choisir un type</option>
              <option v-for="type in types" :key="type.id" :value="type.id">{{ type.libelle }}</option>
            </select>
            <p v-if="unresolvedReferences.type" class="field-warning">
              Le type "{{ unresolvedReferences.type }}" n'existe plus dans les references disponibles.
            </p>
          </label>
          <label>
            Statut
            <select v-model="form.statut" class="input" required>
              <option value="" disabled>Choisir un statut</option>
              <option v-for="statut in statuts" :key="statut.id" :value="statut.id">{{ statut.libelle }}</option>
            </select>
            <p v-if="unresolvedReferences.statut" class="field-warning">
              Le statut "{{ unresolvedReferences.statut }}" n'existe plus dans les references disponibles.
            </p>
          </label>
          <label>
            Agence
            <select v-model="form.agence" class="input" disabled>
              <option value="" disabled>Choisir une agence</option>
              <option v-for="agence in agences" :key="agence.id" :value="agence.id">{{ agence.nom }}</option>
            </select>
            <p class="action-bar-caption">Ce champ est verrouille et ne peut pas etre modifie.</p>
            <p v-if="unresolvedReferences.agence" class="field-warning">
              L'agence "{{ unresolvedReferences.agence }}" n'existe plus dans les references disponibles.
            </p>
          </label>
          <label>
            Date ouverture
            <input v-model="form.ouverture" class="input" type="date" />
          </label>
          <label>
            Date echeance
            <input v-model="form.echeance" class="input" type="date" />
          </label>
          <label>
            Montant HT
            <input v-model.number="form.montant" class="input" type="number" min="0" step="100" />
          </label>
        </form>

        <template #footer>
          <button class="button button-secondary" type="button" @click="closeEditDrawer">Annuler</button>
          <button class="button" type="button" :disabled="isSaving" @click="saveDossier">
            {{ isSaving ? 'Enregistrement...' : 'Enregistrer' }}
          </button>
        </template>
      </DrawerPanel>

      <DrawerPanel
        :open="instanceDrawerOpen"
        title="Modification de l'instance"
        description="Mise a jour des informations de l'instance selectionnee"
        @close="closeInstanceDrawer"
      >
        <form class="form-grid" @submit.prevent="saveInstanceFromDrawer">
          <p v-if="isLoadingInstanceReferences" class="action-bar-caption">Chargement des references d'instance...</p>
          <p v-else-if="instanceReferencesError" class="action-bar-caption autosave-error">{{ instanceReferencesError }}</p>
          <label>
            Type d'instance
            <select v-model="instanceForm.type" class="input" required>
              <option value="" disabled>Choisir un type</option>
              <option
                v-for="instanceType in selectableInstanceTypeOptions"
                :key="`${instanceType.id}-${instanceType.libelle}`"
                :value="instanceType.libelle"
              >
                {{ instanceType.libelle }}
              </option>
            </select>
            <p v-if="unresolvedInstanceType" class="field-warning">
              Le type "{{ unresolvedInstanceType }}" n'existe plus dans les references disponibles.
            </p>
            <p v-if="!isLoadingInstanceReferences && !instanceReferencesError && instanceTypeOptions.length === 0" class="action-bar-caption">
              Aucune reference de type d'instance disponible.
            </p>
          </label>

          <label>
            Statut d'instance
            <select v-model="instanceForm.statut" class="input" required>
              <option value="" disabled>Choisir un statut</option>
              <option
                v-for="instanceStatut in selectableInstanceStatusOptions"
                :key="`${instanceStatut.id}-${instanceStatut.libelle}`"
                :value="instanceStatut.libelle"
              >
                {{ instanceStatut.libelle }}
              </option>
            </select>
            <p v-if="unresolvedInstanceStatut" class="field-warning">
              Le statut "{{ unresolvedInstanceStatut }}" n'existe plus dans les references disponibles.
            </p>
            <p v-if="!isLoadingInstanceReferences && !instanceReferencesError && instanceStatusOptions.length === 0" class="action-bar-caption">
              Aucune reference de statut d'instance disponible.
            </p>
          </label>

          <label>
            Date debut
            <input v-model="instanceForm.debut" class="input" type="date" />
          </label>

          <label>
            Date fin
            <input v-model="instanceForm.fin" class="input" type="date" />
          </label>
        </form>

        <p v-if="isSavingInstance" class="action-bar-caption">Enregistrement de l'instance en cours...</p>
        <p v-else-if="instanceSaveError" class="action-bar-caption autosave-error">{{ instanceSaveError }}</p>
        <p v-else-if="instanceLastSavedAt" class="action-bar-caption">Derniere sauvegarde instance: {{ instanceLastSavedAt }}</p>

        <template #footer>
          <button class="button button-secondary" type="button" @click="closeInstanceDrawer">Annuler</button>
          <button class="button" type="button" :disabled="isSavingInstance" @click="saveInstanceFromDrawer">
            {{ isSavingInstance ? 'Enregistrement...' : 'Enregistrer' }}
          </button>
        </template>
      </DrawerPanel>
    </div>

    <div v-else class="card state-card">
      <p>Dossier introuvable.</p>
    </div>
  </section>
</template>

<style scoped>
.state-card {
  padding: 2rem;
  text-align: center;
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

.dossier-detail-bar {
  display: block;
  width: 100%;
}

.dossier-header-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.9rem;
  align-items: start;
  width: 100%;
  margin-bottom: 0.85rem;
}

.dossier-header-actions {
  justify-self: end;
}

.dossier-inline-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem 0.85rem;
  width: 100%;
}

.dossier-inline-field {
  display: grid;
  grid-template-columns: 138px minmax(0, 1fr);
  align-items: center;
  gap: 0.55rem;
  padding: 0.33rem 0.48rem;
  border: 1px solid color-mix(in srgb, var(--border-color) 78%, transparent);
  border-radius: 0.42rem;
  background: color-mix(in srgb, var(--bg-muted) 64%, transparent);
  min-width: 0;
}

.dossier-inline-field:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}

.dossier-inline-label {
  margin: 0;
  color: var(--text-subtle);
  font-size: 0.78rem;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.dossier-inline-value {
  margin: 0;
  font-weight: 600;
  color: var(--text-main);
  font-size: 0.9rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(180px, 0.42fr) minmax(0, 1.58fr);
  gap: 1rem;
  align-items: start;
  margin-top: 1.1rem;
}

.block-header {
  display: grid;
  gap: 0.2rem;
  margin-bottom: 0.9rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid var(--border-color);
}

.procedure-header-row {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.9rem;
  align-items: start;
}

.procedure-header-actions {
  justify-self: end;
}

.detail-item {
  border: 1px solid var(--border-color);
  border-radius: 0.7rem;
  padding: 0.65rem 0.75rem;
  background: #f7f9fc;
}

.detail-item-label {
  margin: 0;
  color: #5b667f;
  font-size: 0.82rem;
}

.detail-item-value {
  margin: 0.3rem 0 0;
  font-weight: 600;
  color: #1d2a48;
}

.compact-card {
  min-width: 0;
}

.procedure-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
  max-height: 360px;
  overflow: auto;
}

.procedure-list-item {
  border: 1px solid var(--border-color);
  border-radius: 0.7rem;
  padding: 0.35rem 0.45rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  cursor: pointer;
}

.procedure-list-item.is-active {
  border-color: #4a7bf7;
  background: #eef4ff;
}

.instance-row {
  cursor: pointer;
}

.instance-row:hover {
  border-color: #4a7bf7;
  background: #eef4ff;
}

.instance-row-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.instance-edit-hint {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  font-size: 0.78rem;
  color: #516188;
  font-weight: 600;
}

.instance-edit-icon {
  width: 0.82rem;
  height: 0.82rem;
}

.procedure-inline-text {
  min-width: 0;
  font-size: 0.82rem;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
  margin-bottom: 0.85rem;
}

.tab-button {
  border: 1px solid var(--border-color);
  border-radius: 0.65rem;
  background: #fff;
  color: #35405f;
  font-weight: 600;
  font-size: 0.82rem;
  padding: 0.55rem 0.35rem;
  cursor: pointer;
}

.tab-button.is-active {
  border-color: #3f71eb;
  background: #e8efff;
  color: #1d3f96;
}

.tab-content {
  min-height: 320px;
}

.procedure-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.procedure-edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
  margin-bottom: 0.7rem;
}

.field-span-2 {
  grid-column: 1 / -1;
}

.instances-block {
  display: grid;
  gap: 0.6rem;
}

.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.6rem;
}

.history-item {
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  padding: 0.7rem;
}

.history-title {
  margin: 0;
  font-weight: 700;
}

.history-meta {
  margin: 0.25rem 0 0;
  color: #59627c;
  font-size: 0.84rem;
}

.history-details {
  margin: 0.35rem 0 0;
  color: #2d3550;
}

.placeholder-block {
  border: 1px dashed var(--border-color);
  border-radius: 0.75rem;
  padding: 0.9rem;
}

.form-grid {
  display: grid;
  gap: 0.9rem;
}

.field-warning {
  margin: 0.45rem 0 0;
  color: #8c5a00;
  font-size: 0.9rem;
}

@media (max-width: 1320px) {
  .detail-layout {
    grid-template-columns: minmax(170px, 0.42fr) minmax(0, 1.58fr);
  }

  .dossier-inline-details {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1020px) {
  .dossier-header-row {
    grid-template-columns: 1fr;
  }

  .dossier-header-actions {
    justify-self: start;
  }

  .detail-layout {
    grid-template-columns: 1fr;
  }

  .dossier-inline-details {
    grid-template-columns: 1fr;
  }

  .dossier-inline-field:last-child:nth-child(odd) {
    grid-column: auto;
  }

  .dossier-inline-field {
    grid-template-columns: 1fr;
    gap: 0.12rem;
    padding: 0.35rem 0.4rem;
  }

  .procedure-header-row {
    grid-template-columns: 1fr;
  }

  .procedure-header-actions {
    justify-self: start;
  }

}

@media (max-width: 640px) {
  .dossier-inline-field {
    border-radius: 0.38rem;
  }

  .procedure-detail-grid,
  .tabs {
    grid-template-columns: 1fr;
  }
}
</style>
