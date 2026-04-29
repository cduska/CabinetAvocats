<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DrawerPanel from '../components/ui/DrawerPanel.vue';
import RichTextEditor from '../components/ui/RichTextEditor.vue';
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
  getTypesDocument,
} from '../services/api';
import { createProcedure, createProcedureInstance } from '../services/api/proceduresApi';
import { getDocumentsByDossier, getDocumentById as fetchDocumentById, updateDocument, deleteDocument } from '../services/api/documentsApi';
import { getModeles, getModeleById } from '../services/api/modelesApi';
import { decryptInformationsSecretes } from '../services/api/dossiersApi';
import { useSession } from '../services/session';
import { getStatusColorClass } from '../services/status';
import type {
  Agence,
  Client,
  DocumentItem,
  Dossier,
  ProcedureHistoryItem,
  ProcedureInstance,
  ProcedureItem,
  StatutDossier,
  StatutInstance,
  TypeDocument,
  TypeDossier,
  TypeInstance,
  TypeProcedure,
} from '../types/domain';

type ProcedureTab = 'procedure-detail' | 'history' | 'new-document' | 'notes';

const route = useRoute();
const router = useRouter();

const dossierId = Number(route.params.id);
const queryProcedureId = Number(route.query.procedureId) || null;
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

// Session & secret
const { state: sessionState } = useSession();
const isAssociee = computed(() => sessionState.metier === 'Associee');
const secretDecrypted = ref(false);
const secretLoading = ref(false);
const secretError = ref('');
const viewSecretValue = ref<string | null>(null);
const viewSecretDecrypted = ref(false);
const viewSecretLoading = ref(false);
const viewSecretError = ref('');
const instanceDrawerOpen = ref(false);
const selectedInstanceId = ref<number | null>(null);
const newProcedureDrawerOpen = ref(false);
const isCreatingProcedure = ref(false);
const newProcedureError = ref('');
const newProcedureForm = reactive({
  type: '',
  statut: '',
  debut: '',
  fin: '',
});
const newInstanceDrawerOpen = ref(false);
const isCreatingInstance = ref(false);
const newInstanceError = ref('');
const newInstanceForm = reactive({
  type: '',
  statut: '',
  debut: '',
  fin: '',
});
const dossierDocuments = ref<DocumentItem[]>([]);
const loadingDossierDocuments = ref(false);
const documentTypeOptions = ref<TypeDocument[]>([]);
const docDrawerOpen = ref(false);
const docDrawerDoc = ref<DocumentItem | null>(null);
const docDrawerType = ref('');
const docDrawerStatut = ref('');
const docDrawerContenu = ref<Record<string, unknown>>({});
const docDrawerIsLoading = ref(false);
const docDrawerIsSaving = ref(false);
const docDrawerError = ref('');
const docDrawerSavedAt = ref('');
const availableModeles = ref<any[]>([]);
const selectedTemplateId = ref('');
const isLoadingTemplate = ref(false);
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
  informationsSecretes: null as string | null,
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
  form.informationsSecretes = null;
  secretDecrypted.value = false;
  secretError.value = '';
  unresolvedReferences.client = getUnresolvedReferenceLabel(apiDossier.client, resolvedClientId);
  unresolvedReferences.type = getUnresolvedReferenceLabel(apiDossier.type, resolvedTypeId);
  unresolvedReferences.statut = getUnresolvedReferenceLabel(apiDossier.statut, resolvedStatutId);
  unresolvedReferences.agence = getUnresolvedReferenceLabel(apiDossier.agence, resolvedAgenceId);
}

async function loadDossierDocuments() {
  if (!dossier.value) return;
  loadingDossierDocuments.value = true;
  try {
    dossierDocuments.value = await getDocumentsByDossier(dossierId, dossier.value.reference ?? '');
  } catch {
    dossierDocuments.value = [];
  } finally {
    loadingDossierDocuments.value = false;
  }
}

async function openDocumentDrawer(doc: DocumentItem) {
  docDrawerDoc.value = doc;
  docDrawerType.value = doc.type;
  docDrawerStatut.value = doc.statut;
  docDrawerContenu.value = {};
  docDrawerError.value = '';
  docDrawerSavedAt.value = '';
  docDrawerOpen.value = true;
  docDrawerIsLoading.value = true;
  try {
    const full = await fetchDocumentById(doc.id);
    docDrawerDoc.value = full;
    docDrawerType.value = full.type;
    docDrawerStatut.value = full.statut;
    docDrawerContenu.value = full.contenuJson ?? {};
  } catch {
    docDrawerError.value = 'Impossible de charger le contenu du document.';
  } finally {
    docDrawerIsLoading.value = false;
  }
  if (documentTypeOptions.value.length === 0) {
    try {
      documentTypeOptions.value = await getTypesDocument();
    } catch {
      documentTypeOptions.value = [];
    }
  }
  if (availableModeles.value.length === 0) {
    void loadAvailableModeles();
  }
}

function closeDocumentDrawer() {
  docDrawerOpen.value = false;
  docDrawerDoc.value = null;
}

async function saveDocumentDrawer() {
  if (!docDrawerDoc.value || !docDrawerStatut.value.trim()) {
    docDrawerError.value = 'Le statut est obligatoire.';
    return;
  }

  docDrawerIsSaving.value = true;
  docDrawerError.value = '';

  try {
    const updated = await updateDocument(docDrawerDoc.value.id, {
      type: docDrawerType.value,
      statut: docDrawerStatut.value,
      contenuJson: docDrawerContenu.value,
    });
    const idx = dossierDocuments.value.findIndex((d) => d.id === updated.id);
    if (idx !== -1) {
      dossierDocuments.value[idx] = updated;
    }
    docDrawerSavedAt.value = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    closeDocumentDrawer();
  } catch (error) {
    docDrawerError.value = error instanceof Error ? error.message : 'Erreur lors de la sauvegarde.';
  } finally {
    docDrawerIsSaving.value = false;
  }
}

async function loadAvailableModeles() {
  try {
    const modeles = await getModeles({ publishedOnly: true });
    availableModeles.value = modeles;
  } catch {
    availableModeles.value = [];
  }
}

async function applyTemplate() {
  if (!selectedTemplateId.value || !docDrawerDoc.value) return;

  isLoadingTemplate.value = true;
  try {
    const modele = await getModeleById(Number(selectedTemplateId.value));
    if (modele?.contenuJson) {
      docDrawerContenu.value = { ...modele.contenuJson };
    }
    selectedTemplateId.value = '';
  } catch (error) {
    docDrawerError.value = error instanceof Error ? error.message : 'Erreur lors du chargement du modèle.';
  } finally {
    isLoadingTemplate.value = false;
  }
}

async function deleteDocumentFromList(docId: number) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
    return;
  }

  try {
    await deleteDocument(docId);
    dossierDocuments.value = dossierDocuments.value.filter((d) => d.id !== docId);
  } catch {
    // suppression silencieuse — l'absence de l'élément dans la liste suffit comme feedback
  }
}

async function loadDossierPage() {
  isLoading.value = true;

  try {
    await Promise.all([loadReferences(), loadProcedures()]);
    const apiDossier = await getDossierById(dossierId);
    dossier.value = apiDossier;
    hydrateFormFromDossier(apiDossier);
    void loadDossierDocuments();
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
      const preferred = queryProcedureId !== null && nextProcedures.some((item) => item.id === queryProcedureId)
        ? queryProcedureId
        : nextProcedures[0].id;
      selectedProcedureId.value = preferred;
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

async function decryptSecret() {
  secretLoading.value = true;
  secretError.value = '';
  try {
    const value = await decryptInformationsSecretes(dossierId);
    form.informationsSecretes = value ?? '';
    secretDecrypted.value = true;
  } catch (error) {
    secretError.value = error instanceof Error ? error.message : 'Erreur lors du déchiffrement.';
  } finally {
    secretLoading.value = false;
  }
}

async function decryptSecretView() {
  viewSecretLoading.value = true;
  viewSecretError.value = '';
  try {
    const value = await decryptInformationsSecretes(dossierId);
    viewSecretValue.value = value ?? '';
    viewSecretDecrypted.value = true;
  } catch (error) {
    viewSecretError.value = error instanceof Error ? error.message : 'Erreur lors du déchiffrement.';
  } finally {
    viewSecretLoading.value = false;
  }
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
      ...(isAssociee.value && secretDecrypted.value
        ? { informationsSecretes: form.informationsSecretes || null }
        : {}),
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

async function openNewInstanceDrawer() {
  newInstanceForm.type = '';
  newInstanceForm.statut = '';
  newInstanceForm.debut = '';
  newInstanceForm.fin = '';
  newInstanceError.value = '';
  newInstanceDrawerOpen.value = true;
  void loadInstanceReferences();
}

function closeNewInstanceDrawer() {
  newInstanceDrawerOpen.value = false;
}

async function saveNewInstance() {
  if (!selectedProcedureId.value) {
    return;
  }

  if (!newInstanceForm.type.trim() || !newInstanceForm.statut.trim()) {
    newInstanceError.value = 'Le type et le statut sont obligatoires.';
    return;
  }

  isCreatingInstance.value = true;
  newInstanceError.value = '';

  try {
    await createProcedureInstance({
      procedureId: selectedProcedureId.value,
      type: newInstanceForm.type,
      statut: newInstanceForm.statut,
      debut: newInstanceForm.debut,
      fin: newInstanceForm.fin,
    });

    await loadProcedurePanel(selectedProcedureId.value);
    closeNewInstanceDrawer();
  } catch (error) {
    newInstanceError.value = error instanceof Error ? error.message : 'Erreur lors de la creation de l\'instance.';
  } finally {
    isCreatingInstance.value = false;
  }
}

async function openNewProcedureDrawer() {
  newProcedureForm.type = '';
  newProcedureForm.statut = '';
  newProcedureForm.debut = '';
  newProcedureForm.fin = '';
  newProcedureError.value = '';
  newProcedureDrawerOpen.value = true;

  if (procedureTypeOptions.value.length === 0 || procedureStatusOptions.value.length === 0) {
    const [typeOpts, statusOpts] = await Promise.all([
      getTypesProcedure().catch(() => []),
      getStatutsProcedure().catch(() => []),
    ]);
    if (procedureTypeOptions.value.length === 0) {
      procedureTypeOptions.value = typeOpts;
    }
    if (procedureStatusOptions.value.length === 0) {
      procedureStatusOptions.value = statusOpts;
    }
  }
}

function closeNewProcedureDrawer() {
  newProcedureDrawerOpen.value = false;
}

async function saveNewProcedure() {
  if (!newProcedureForm.type.trim() || !newProcedureForm.statut.trim()) {
    newProcedureError.value = 'Le type et le statut sont obligatoires.';
    return;
  }

  isCreatingProcedure.value = true;
  newProcedureError.value = '';

  try {
    const created = await createProcedure({
      dossierId,
      type: newProcedureForm.type,
      statut: newProcedureForm.statut,
      debut: newProcedureForm.debut,
      fin: newProcedureForm.fin,
    });

    await loadProcedures();
    selectedProcedureId.value = created.id;
    closeNewProcedureDrawer();
  } catch (error) {
    newProcedureError.value = error instanceof Error ? error.message : 'Erreur lors de la creation de la procedure.';
  } finally {
    isCreatingProcedure.value = false;
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

      <div v-if="isAssociee && dossier?.informationsSecretesSet" class="card secret-view-card">
        <div class="block-header">
          <p class="action-bar-title">Informations confidentielles</p>
          <p class="action-bar-caption">Accès réservé aux associé(e)s — contenu chiffré AES-256.</p>
        </div>
        <template v-if="!viewSecretDecrypted">
          <div class="secret-view-locked">
            <span class="secret-view-placeholder">•••••••••••••••••••  (contenu chiffré)</span>
            <button
              class="button button-secondary"
              type="button"
              :disabled="viewSecretLoading"
              @click="decryptSecretView"
            >
              {{ viewSecretLoading ? 'Déchiffrement...' : 'Déchiffrer' }}
            </button>
          </div>
          <p v-if="viewSecretError" class="autosave-error">{{ viewSecretError }}</p>
        </template>
        <pre v-else class="secret-view-content">{{ viewSecretValue }}</pre>
      </div>

      <div class="detail-layout">
        <div class="card procedures-card compact-card">
          <div class="block-header">
            <div class="block-header-row">
              <div>
                <p class="action-bar-title">Procedures associees</p>
                <p class="action-bar-caption">{{ proceduresSummary }}</p>
              </div>
              <button class="button-add-procedure" type="button" title="Ajouter une procedure" @click="openNewProcedureDrawer">+</button>
            </div>
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

        <div class="card instances-timeline-card">
          <div class="block-header">
            <div class="block-header-row">
              <div>
                <p class="action-bar-title">Echeancier</p>
                <p v-if="selectedProcedure" class="action-bar-caption">
                  {{ selectedProcedureInstances.length }} instance{{ selectedProcedureInstances.length > 1 ? 's' : '' }}
                </p>
                <p v-else class="action-bar-caption">Selectionnez une procedure</p>
              </div>
              <button v-if="selectedProcedure" class="button-add-procedure" type="button" title="Ajouter une instance" @click="openNewInstanceDrawer">+</button>
            </div>
          </div>

          <template v-if="selectedProcedure">
            <div v-if="selectedProcedureInstances.length > 0" class="timeline">
              <div
                v-for="(instance, index) in selectedProcedureInstances"
                :key="instance.id"
                class="timeline-item"
                @click="openInstanceDrawer(instance)"
              >
                <div class="timeline-connector">
                  <div :class="['timeline-dot', getStatusColorClass(instance.statut)]"></div>
                  <div v-if="index < selectedProcedureInstances.length - 1" class="timeline-line"></div>
                </div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <p class="timeline-title">{{ instance.type }}</p>
                    <span :class="['status-pill', getStatusColorClass(instance.statut)]">{{ instance.statut }}</span>
                  </div>
                  <p class="timeline-dates">
                    <span>{{ toDisplayDate(instance.debut) }}</span>
                    <span v-if="instance.fin && instance.fin !== instance.debut"> → {{ toDisplayDate(instance.fin) }}</span>
                  </p>
                  <button class="timeline-edit-btn" type="button" tabindex="-1">Modifier →</button>
                </div>
              </div>
            </div>
            <p v-else class="action-bar-caption">Aucune instance associee.</p>
          </template>
        </div>
      </div>

      <div class="card documents-associes-card">
        <div class="block-header-row">
          <div>
            <p class="action-bar-title">Documents associes</p>
            <p class="action-bar-caption">
              <template v-if="loadingDossierDocuments">Chargement...</template>
              <template v-else>{{ dossierDocuments.length }} document{{ dossierDocuments.length > 1 ? 's' : '' }} lies au dossier</template>
            </p>
          </div>
        </div>

        <template v-if="!loadingDossierDocuments">
          <table v-if="dossierDocuments.length > 0" class="docs-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Procedure</th>
                <th>Instance</th>
                <th>Auteur</th>
                <th>Date</th>
                <th>Statut</th>
                <th style="width: 50px; text-align: center;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="doc in dossierDocuments" :key="doc.id" class="docs-table-row" @click="openDocumentDrawer(doc)">
                <td>{{ doc.type }}</td>
                <td>{{ doc.procedureId ? '#' + doc.procedureId : '—' }}</td>
                <td>{{ doc.instanceId ? '#' + doc.instanceId : '—' }}</td>
                <td>{{ doc.auteur }}</td>
                <td>{{ doc.dateCreation || '—' }}</td>
                <td><span :class="['status-pill', getStatusColorClass(doc.statut)]">{{ doc.statut }}</span></td>
                <td class="docs-table-actions">
                  <button
                    class="button button-danger button-xs"
                    type="button"
                    aria-label="Supprimer"
                    title="Supprimer le document"
                    @click.stop="deleteDocumentFromList(doc.id)"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="action-bar-caption">Aucun document associe a ce dossier.</p>
        </template>
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

          <template v-if="isAssociee">
            <div class="secret-field">
              <p class="secret-field-label">Informations confidentielles</p>
              <template v-if="!secretDecrypted">
                <div class="secret-field-locked">
                  <span class="secret-field-placeholder">
                    {{ dossier?.informationsSecretesSet ? '••••••••••••  (contenu chiffré)' : 'Aucune donnée confidentielle' }}
                  </span>
                  <button
                    class="button button-secondary secret-field-btn"
                    type="button"
                    :disabled="secretLoading"
                    @click="decryptSecret"
                  >
                    {{ secretLoading ? 'Déchiffrement...' : 'Déchiffrer' }}
                  </button>
                </div>
                <p v-if="secretError" class="autosave-error">{{ secretError }}</p>
              </template>
              <template v-else>
                <textarea
                  v-model="form.informationsSecretes"
                  class="input secret-field-textarea"
                  rows="5"
                  placeholder="Contenu confidentiel déchiffré. Vider le champ pour supprimer."
                />
                <p class="action-bar-caption">Champ déchiffré — sera rechiffré à l'enregistrement.</p>
              </template>
            </div>
          </template>
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

      <DrawerPanel
        :open="newInstanceDrawerOpen"
        title="Nouvelle instance"
        description="Creation d'une instance associee a la procedure selectionnee"
        @close="closeNewInstanceDrawer"
      >
        <form class="form-grid" @submit.prevent="saveNewInstance">
          <p v-if="isLoadingInstanceReferences" class="action-bar-caption">Chargement des references...</p>
          <label>
            Type d'instance
            <select v-model="newInstanceForm.type" class="input" required>
              <option value="" disabled>Choisir un type</option>
              <option
                v-for="instanceType in instanceTypeOptions"
                :key="`ni-${instanceType.id}-${instanceType.libelle}`"
                :value="instanceType.libelle"
              >
                {{ instanceType.libelle }}
              </option>
            </select>
          </label>
          <label>
            Statut
            <select v-model="newInstanceForm.statut" class="input" required>
              <option value="" disabled>Choisir un statut</option>
              <option
                v-for="status in instanceStatusOptions"
                :key="`ni-${status.id}-${status.libelle}`"
                :value="status.libelle"
              >
                {{ status.libelle }}
              </option>
            </select>
          </label>
          <label>
            Date debut
            <input v-model="newInstanceForm.debut" class="input" type="date" />
          </label>
          <label>
            Date fin
            <input v-model="newInstanceForm.fin" class="input" type="date" />
          </label>
        </form>
        <p v-if="newInstanceError" class="autosave-error">{{ newInstanceError }}</p>
        <template #footer>
          <button class="button button-secondary" type="button" @click="closeNewInstanceDrawer">Annuler</button>
          <button class="button" type="button" :disabled="isCreatingInstance" @click="saveNewInstance">
            {{ isCreatingInstance ? 'Creation...' : 'Creer l\'instance' }}
          </button>
        </template>
      </DrawerPanel>

      <DrawerPanel
        :open="newProcedureDrawerOpen"
        title="Nouvelle procedure"
        description="Creation d'une procedure associee au dossier courant"
        @close="closeNewProcedureDrawer"
      >
        <form class="form-grid" @submit.prevent="saveNewProcedure">
          <label>
            Type procedure
            <select v-model="newProcedureForm.type" class="input" required>
              <option value="" disabled>Choisir un type</option>
              <option
                v-for="procedureType in procedureTypeOptions"
                :key="`new-${procedureType.id}-${procedureType.libelle}`"
                :value="procedureType.libelle"
              >
                {{ procedureType.libelle }}
              </option>
            </select>
          </label>
          <label>
            Statut
            <select v-model="newProcedureForm.statut" class="input" required>
              <option value="" disabled>Choisir un statut</option>
              <option
                v-for="status in procedureStatusOptions"
                :key="`new-${status.id}-${status.libelle}`"
                :value="status.libelle"
              >
                {{ status.libelle }}
              </option>
            </select>
          </label>
          <label>
            Date debut
            <input v-model="newProcedureForm.debut" class="input" type="date" />
          </label>
          <label>
            Date fin
            <input v-model="newProcedureForm.fin" class="input" type="date" />
          </label>
        </form>
        <p v-if="newProcedureError" class="autosave-error">{{ newProcedureError }}</p>
        <template #footer>
          <button class="button button-secondary" type="button" @click="closeNewProcedureDrawer">Annuler</button>
          <button class="button" type="button" :disabled="isCreatingProcedure" @click="saveNewProcedure">
            {{ isCreatingProcedure ? 'Creation...' : 'Creer la procedure' }}
          </button>
        </template>
      </DrawerPanel>

      <Teleport to="body">
        <div v-if="docDrawerOpen" class="doc-modal-overlay" @mousedown.self="closeDocumentDrawer" @keydown.esc="closeDocumentDrawer">
          <div class="doc-modal" role="dialog" aria-modal="true" :aria-label="docDrawerDoc ? 'Edition: ' + docDrawerDoc.type : 'Edition du document'">
            <div class="doc-modal-header">
              <div>
                <p class="action-bar-title">{{ docDrawerDoc?.type ?? 'Document' }}</p>
                <p class="action-bar-caption">{{ docDrawerDoc?.dateCreation || '' }}</p>
              </div>
              <button class="doc-modal-close" type="button" aria-label="Fermer" @click="closeDocumentDrawer">✕</button>
            </div>

            <div class="doc-modal-body">
              <template v-if="docDrawerDoc">
                <div class="doc-drawer-type">
                  <label>
                    Type de document
                    <select v-model="docDrawerType" class="input" required>
                      <option value="" disabled>Choisir un type</option>
                      <option v-for="type in documentTypeOptions" :key="type.id" :value="type.libelle">
                        {{ type.libelle }}
                      </option>
                    </select>
                  </label>
                </div>

                <dl class="doc-drawer-info">
                  <dt>Auteur</dt>
                  <dd>{{ docDrawerDoc.auteur }}</dd>
                  <dt>Date creation</dt>
                  <dd>{{ docDrawerDoc.dateCreation || '—' }}</dd>
                  <dt>Procedure</dt>
                  <dd>{{ docDrawerDoc.procedureId ? '#' + docDrawerDoc.procedureId : '—' }}</dd>
                  <dt>Instance</dt>
                  <dd>{{ docDrawerDoc.instanceId ? '#' + docDrawerDoc.instanceId : '—' }}</dd>
                </dl>

                <div class="doc-drawer-statut">
                  <label>
                    Statut
                    <select v-model="docDrawerStatut" class="input" required>
                      <option value="" disabled>Choisir un statut</option>
                      <option value="brouillon">Brouillon</option>
                      <option value="A relire">A relire</option>
                      <option value="Valide">Valide</option>
                      <option value="Archive">Archive</option>
                    </select>
                  </label>
                </div>

                <div class="doc-model-selector">
                  <label>
                    Utiliser un modèle
                    <select v-model="selectedTemplateId" class="input">
                      <option value="" disabled>Choisir un modèle...</option>
                      <option v-for="modele in availableModeles" :key="modele.id" :value="String(modele.id)">
                        {{ modele.nomModele }}
                      </option>
                    </select>
                  </label>
                  <button
                    type="button"
                    class="button button-secondary"
                    :disabled="!selectedTemplateId || isLoadingTemplate"
                    @click="applyTemplate"
                  >
                    {{ isLoadingTemplate ? 'Application...' : 'Appliquer le modèle' }}
                  </button>
                </div>

                <p class="doc-editor-label">Contenu</p>
                <div v-if="docDrawerIsLoading" class="action-bar-caption">Chargement du contenu...</div>
                <RichTextEditor v-else v-model="docDrawerContenu" placeholder="Rédigez le contenu du document…" />
                <p v-if="docDrawerError" class="autosave-error">{{ docDrawerError }}</p>
              </template>
            </div>

            <div class="doc-modal-footer">
              <button class="button button-secondary" type="button" @click="closeDocumentDrawer">Fermer</button>
              <button class="button" type="button" :disabled="docDrawerIsSaving || docDrawerIsLoading" @click="saveDocumentDrawer">
                {{ docDrawerIsSaving ? 'Enregistrement...' : 'Enregistrer' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
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
  grid-template-columns: minmax(180px, 0.42fr) minmax(0, 1.2fr) minmax(160px, 0.5fr);
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

.block-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.instances-block-header {
  margin-bottom: 0.6rem;
}

.instances-timeline-card {
  /* dans la grille detail-layout, pas de marge supplémentaire */
}

.documents-associes-card {
  margin-top: 1rem;
}

.docs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.docs-table th {
  text-align: left;
  padding: 0.4rem 0.6rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-caption, #59627c);
  border-bottom: 1px solid var(--border-color);
}

.docs-table td {
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--color-text, #111);
}

.docs-table tbody tr:last-child td {
  border-bottom: none;
}

.docs-table tbody tr:hover td {
  background: var(--bg-muted);
}

.docs-table-row {
  cursor: pointer;
}

.docs-table-actions {
  padding: 0 !important;
  text-align: center;
}

.button-xs {
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
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

/* Document Modal */
.doc-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.doc-modal {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 80%;
  max-height: 90vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.doc-modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.doc-modal-header > div > p:first-child {
  margin: 0;
}

.doc-modal-header > div > p:last-child {
  margin: 0.3rem 0 0;
}

.doc-modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  color: var(--color-caption, #59627c);
  transition: color 0.2s;
}

.doc-modal-close:hover {
  color: var(--color-text, #111);
}

.doc-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.doc-modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 0.8rem;
}

@media (max-width: 768px) {
  .doc-modal {
    max-width: 95%;
    max-height: 95vh;
  }
}

.doc-drawer-info {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.3rem 0.8rem;
  font-size: 0.88rem;
  margin: 0;
}

.doc-drawer-info dt {
  font-weight: 600;
  color: var(--color-caption, #59627c);
}

.doc-drawer-info dd {
  margin: 0;
  color: var(--color-text, #111);
}

.doc-drawer-type {
  margin-top: 0.5rem;
  margin-bottom: 0.8rem;
}

.doc-drawer-type label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.88rem;
  font-weight: 500;
}

.doc-drawer-statut {
  margin-top: 1rem;
}

.doc-drawer-statut label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.88rem;
  font-weight: 500;
}

.doc-model-selector {
  margin-top: 1rem;
  display: flex;
  gap: 0.6rem;
  align-items: flex-end;
}

.doc-model-selector label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.88rem;
  font-weight: 500;
}

.doc-model-selector select {
  flex: 1;
}

.doc-editor-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-caption, #59627c);
  margin: 1rem 0 0.4rem;
}

/* Timeline */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-top: 0.25rem;
}

.timeline-item {
  display: grid;
  grid-template-columns: 2rem 1fr;
  gap: 0 0.75rem;
  cursor: pointer;
}

.timeline-item:hover .timeline-content {
  background: var(--bg-muted);
  border-radius: 8px;
}

.timeline-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 0.35rem;
}

.timeline-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid var(--border-color);
  background: var(--bg-panel);
}

.timeline-dot.status-ok      { background: var(--ok-bg);    border-color: var(--ok-text); }
.timeline-dot.status-warn     { background: var(--warn-bg);  border-color: var(--warn-text); }
.timeline-dot.status-alert    { background: var(--alert-bg); border-color: var(--alert-text); }
.timeline-dot.status-neutral  { background: var(--bg-hover); border-color: var(--text-muted); }

.timeline-line {
  width: 2px;
  flex: 1;
  min-height: 1.5rem;
  background: var(--border-color);
  margin-top: 0.2rem;
}

.timeline-content {
  padding: 0.35rem 0.6rem 0.8rem;
  transition: background 0.15s;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.timeline-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-main);
}

.timeline-dates {
  font-size: 0.78rem;
  color: var(--text-subtle);
  margin-top: 0.15rem;
}

.timeline-edit-btn {
  margin-top: 0.3rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.timeline-item:hover .timeline-edit-btn {
  color: var(--accent);
}

.button-add-procedure {
  display: inline-grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-muted);
  color: var(--text-main);
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  line-height: 1;
}

.button-add-procedure:hover {
  background: var(--bg-panel);
  border-color: var(--accent);
  color: var(--accent);
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

.secret-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.secret-field-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text, #111);
  margin: 0;
}

.secret-field-locked {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  background: #f5f0ff;
  border: 1px solid #c4aef0;
  border-radius: 6px;
}

.secret-field-placeholder {
  flex: 1;
  font-family: monospace;
  color: #6b44c4;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
}

.secret-field-btn {
  flex-shrink: 0;
  padding: 0.3rem 0.8rem;
  font-size: 0.85rem;
}

.secret-field-textarea {
  font-family: inherit;
  resize: vertical;
}

.secret-view-card {
  margin-top: 0;
}

.secret-view-locked {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.8rem;
  background: #f5f0ff;
  border: 1px solid #c4aef0;
  border-radius: 6px;
}

.secret-view-placeholder {
  flex: 1;
  font-family: monospace;
  color: #6b44c4;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
}

.secret-view-content {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1.6;
  padding: 0.75rem 0.9rem;
  background: #f9f7ff;
  border: 1px solid #e0d7f8;
  border-radius: 6px;
  margin: 0;
  color: #1a1a2e;
}

@media (max-width: 1320px) {
  .detail-layout {
    grid-template-columns: minmax(170px, 0.42fr) minmax(0, 1.2fr) minmax(150px, 0.45fr);
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
    grid-template-columns: 1fr 1fr;
  }

  .instances-timeline-card {
    grid-column: 1 / -1;
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
